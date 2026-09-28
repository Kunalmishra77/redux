-- E15-S06, S07, S08 · schema.sql §13 — stock and parts (D15) · BR-ST1, BR-ST2, BR-ST3
-- Item-level stock at Eurobrass: no serials, no warehouses, no valuation (assumption B10).
--
-- Deviations from schema.sql (task tracker → Deviations):
--   * Quantity changes ONLY through record_stock_movement(); a trigger rejects a user setting it
--     directly, and a new item starts at zero (opening stock is an 'in' movement).
--   * BR-ST3 lives in a trigger on stock_items, so a crossing is caught whether the quantity fell
--     or the minimum was raised. Each crossing writes one stock_alerts row — the outbox the TN13
--     notification (E5) will drain — and the alert re-arms when stock is back at or above minimum.
--   * Movements are append-only (an error is corrected by an 'adjusted' movement, with a reason).
--   * category is a checked list; 'adjusted' quantities are signed, the others positive.

create table public.stock_items (
  id              uuid primary key default gen_random_uuid(),
  sku             text not null unique,
  name            text not null,
  category        text check (category in ('cartridge','spare','finish','replacement')),
  uom             text not null default 'NOS',
  quantity        numeric(12,2) not null default 0 check (quantity >= 0),   -- BR-ST1
  min_level       numeric(12,2) not null default 0 check (min_level >= 0),
  is_active       boolean not null default true,
  -- BR-ST3: once per crossing
  below_min_since timestamptz,
  last_alert_at   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index stock_items_category_idx on public.stock_items (category);
create index stock_items_below_min_idx on public.stock_items (below_min_since) where below_min_since is not null;
create trigger trg_stock_items_updated before update on public.stock_items
  for each row execute function public.set_updated_at();
create trigger trg_audit_stock_items after insert or update or delete on public.stock_items
  for each row execute function public.write_audit();

create table public.stock_movements (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.stock_items(id),
  type        public.stock_move_type not null,
  quantity    numeric(12,2) not null,
  job_id      uuid references public.jobs(id),
  reason      text,
  actor_id    uuid not null references auth.users(id),           -- BR-ST2
  occurred_at timestamptz not null default now(),
  constraint stock_movement_sign check (
    (type = 'adjusted' and quantity <> 0) or (type <> 'adjusted' and quantity > 0)),
  constraint stock_adjust_needs_reason check (type <> 'adjusted' or length(trim(coalesce(reason, ''))) > 0)
);
create index stock_movements_item_idx on public.stock_movements (item_id, occurred_at desc);
create index stock_movements_job_id_idx on public.stock_movements (job_id);

-- TN13 outbox: one row per crossing below minimum
create table public.stock_alerts (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references public.stock_items(id),
  quantity   numeric(12,2) not null,
  min_level  numeric(12,2) not null,
  raised_at  timestamptz not null default now(),
  notified_at timestamptz
);
create index stock_alerts_item_id_idx on public.stock_alerts (item_id);
create index stock_alerts_pending_idx on public.stock_alerts (raised_at) where notified_at is null;

alter table public.stock_items     enable row level security;
alter table public.stock_movements enable row level security;
alter table public.stock_alerts    enable row level security;

create trigger trg_stock_movements_append_only before update or delete on public.stock_movements
  for each row execute function public.forbid_change();

-- Quantity is the ledger's, not a form field's
create or replace function public.guard_stock_quantity() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated'
     and ((tg_op = 'INSERT' and new.quantity <> 0)
          or (tg_op = 'UPDATE' and new.quantity is distinct from old.quantity)) then
    raise exception 'Stock quantity changes only through a stock movement (BR-ST2)' using errcode = '42501';
  end if;
  if current_user = 'authenticated' and tg_op = 'UPDATE'
     and (new.below_min_since is distinct from old.below_min_since or new.last_alert_at is distinct from old.last_alert_at) then
    raise exception 'Alert state is managed by the system (BR-ST3)' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_stock_items_guard before insert or update on public.stock_items
  for each row execute function public.guard_stock_quantity();

-- BR-ST3: alert once per crossing; re-arm when back at or above the minimum
create or replace function public.stock_crossing() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.is_active and new.quantity < new.min_level and new.below_min_since is null then
    update public.stock_items set below_min_since = now(), last_alert_at = now() where id = new.id;
    insert into public.stock_alerts (item_id, quantity, min_level) values (new.id, new.quantity, new.min_level);
  elsif new.below_min_since is not null and (new.quantity >= new.min_level or not new.is_active) then
    update public.stock_items set below_min_since = null where id = new.id;
  end if;
  return null;
end $$;
create trigger trg_stock_crossing after insert or update of quantity, min_level, is_active on public.stock_items
  for each row execute function public.stock_crossing();

-- ---------------------------------------------------------------------------
-- record_stock_movement(): D15-03 — in, out, consumed by a job, adjusted with a reason.
--   p: {item_id, type, quantity, job_id?, reason?}  Returns the new quantity.
-- ---------------------------------------------------------------------------
create or replace function public.record_stock_movement(p jsonb)
returns numeric language plpgsql security definer set search_path = '' as $$
declare
  v_item  public.stock_items%rowtype;
  v_type  public.stock_move_type := (p ->> 'type')::public.stock_move_type;
  v_qty   numeric := (p ->> 'quantity')::numeric;
  v_delta numeric;
  v_actor uuid := (select auth.uid());
begin
  if not public.is_system_caller() and not public.current_role_is('super_admin') then
    raise exception 'Only a super_admin records stock movements' using errcode = '42501';
  end if;
  if v_actor is null then
    raise exception 'A stock movement needs an actor (BR-ST2)' using errcode = '23502';
  end if;

  select * into v_item from public.stock_items where id = (p ->> 'item_id')::uuid for update;
  if not found then raise exception 'Stock item not found' using errcode = 'P0002'; end if;

  v_delta := case v_type when 'in' then v_qty when 'adjusted' then v_qty else -v_qty end;
  if v_item.quantity + v_delta < 0 then
    raise exception 'Only % % of % in stock — cannot take % (BR-ST1)',
      v_item.quantity, v_item.uom, v_item.name, abs(v_delta) using errcode = '23514';
  end if;
  if v_type = 'consumed' and nullif(p ->> 'job_id', '') is null then
    raise exception 'Consumption is recorded against a job (D15-04)' using errcode = '23514';
  end if;

  insert into public.stock_movements (item_id, type, quantity, job_id, reason, actor_id)
  values (v_item.id, v_type, v_qty, nullif(p ->> 'job_id', '')::uuid, nullif(trim(p ->> 'reason'), ''), v_actor);

  update public.stock_items set quantity = quantity + v_delta where id = v_item.id;
  return v_item.quantity + v_delta;
end $$;
revoke execute on function public.record_stock_movement(jsonb) from public, anon;
grant execute on function public.record_stock_movement(jsonb) to authenticated;

-- D14-05 / D15-02: what is below its minimum right now
create view public.v_low_stock with (security_invoker = true) as
select i.id, i.sku, i.name, i.category, i.uom, i.quantity, i.min_level, i.below_min_since
from public.stock_items i
where i.is_active and i.quantity < i.min_level;

-- ---------------------------------------------------------------------------
-- Policies: roles matrix — stock is super_admin only
-- ---------------------------------------------------------------------------
create policy stock_items_admin on public.stock_items for all to authenticated
  using ((select public.current_role_is('super_admin')))
  with check ((select public.current_role_is('super_admin')));
create policy stock_movements_admin_read on public.stock_movements for select to authenticated
  using ((select public.current_role_is('super_admin')));
create policy stock_alerts_admin_read on public.stock_alerts for select to authenticated
  using ((select public.current_role_is('super_admin')));
