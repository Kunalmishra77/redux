-- E10-S01, S02, S04, S05, S06 · schema.sql §4 + §9 — versioned rate cards, three-price assessments
-- Prices are REDUX's (client input A9). Nothing here seeds a price.
--
-- Deviations from schema.sql (task tracker → Deviations):
--   * D9-02 enforced: once a version has been activated, its items and market prices can never be
--     changed or deleted — editing means new_rate_card_version(). activated_at records it.
--   * Uniqueness uses NULLS NOT DISTINCT, so "finish irrelevant" (null) cannot appear twice.
--   * market_prices keyed by fitting type + optional finish (the CSV template carries a market
--     price per finish; a PVD-gold mixer does not cost what a chrome one does). Lookup falls back
--     from the exact finish to the finish-less row.
--   * Review item 2: surveyors read the ACTIVE rate card, its items and market prices (they price
--     on site, offline). Executives do not (roles: no pricing outside a quote).
--   * Assessments are written only through upsert_assessment(), which prices from the active rate
--     card on the server (api-spec: "server re-prices"). you_save is generated; null = hidden (BR-A4).

-- ---------------------------------------------------------------------------
-- §4 Rate cards
-- ---------------------------------------------------------------------------
create table public.rate_cards (
  id             uuid primary key default gen_random_uuid(),
  version        int  not null unique check (version > 0),
  effective_from date not null,
  is_active      boolean not null default false,
  activated_at   timestamptz,                         -- set on first activation; freezes the version
  notes          text,
  created_by     uuid references public.profiles(id) default auth.uid(),
  created_at     timestamptz not null default now(),
  constraint rate_cards_active_was_activated check (not is_active or activated_at is not null)
);
-- D9-03: only one active version at a time
create unique index rate_cards_one_active on public.rate_cards (is_active) where is_active;

create table public.rate_card_items (
  id               uuid primary key default gen_random_uuid(),
  rate_card_id     uuid not null references public.rate_cards(id),
  fitting_type_id  uuid not null references public.fitting_types(id),
  work_type_id     uuid not null references public.work_types(id),
  finish_id        uuid references public.finishes(id),        -- null where finish is irrelevant
  price            numeric(12,2) not null check (price >= 0),
  gst_rate         numeric(5,2)  not null default 18.00 check (gst_rate between 0 and 28),  -- B11
  hsn_sac          text,                                        -- CA-confirmed (A11)
  constraint rate_card_items_uq unique nulls not distinct (rate_card_id, fitting_type_id, work_type_id, finish_id)
);
create index rate_card_items_rate_card_id_idx on public.rate_card_items (rate_card_id);

-- Market replacement price, so the quote can show "You save" (BR-A4). Never charged.
create table public.market_prices (
  id              uuid primary key default gen_random_uuid(),
  rate_card_id    uuid not null references public.rate_cards(id),
  fitting_type_id uuid not null references public.fitting_types(id),
  finish_id       uuid references public.finishes(id),
  price           numeric(12,2) not null check (price >= 0),
  constraint market_prices_uq unique nulls not distinct (rate_card_id, fitting_type_id, finish_id)
);
create index market_prices_rate_card_id_idx on public.market_prices (rate_card_id);

alter table public.rate_cards      enable row level security;
alter table public.rate_card_items enable row level security;
alter table public.market_prices   enable row level security;

create trigger trg_audit_rate_cards after insert or update or delete on public.rate_cards
  for each row execute function public.write_audit();
create trigger trg_audit_rate_card_items after insert or update or delete on public.rate_card_items
  for each row execute function public.write_audit();
create trigger trg_audit_market_prices after insert or update or delete on public.market_prices
  for each row execute function public.write_audit();

-- D9-02 / BR-A3: an activated version is frozen — old quotes never re-price
create or replace function public.guard_rate_card_frozen() returns trigger
language plpgsql set search_path = '' as $$
declare v_card public.rate_cards%rowtype;
begin
  if tg_table_name = 'rate_cards' then
    if tg_op = 'DELETE' and old.activated_at is not null then
      raise exception 'Rate card v% has been used and cannot be deleted (D9-02)', old.version using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and old.activated_at is not null
       and (new.version is distinct from old.version or new.effective_from is distinct from old.effective_from
            or new.activated_at is distinct from old.activated_at) then
      raise exception 'Rate card v% has been activated; create a new version instead (D9-02)', old.version
        using errcode = '42501';
    end if;
    return coalesce(new, old);
  end if;

  select * into v_card from public.rate_cards
  where id = case when tg_op = 'DELETE' then old.rate_card_id else new.rate_card_id end;
  if v_card.activated_at is not null
     or (tg_op = 'UPDATE' and old.rate_card_id is distinct from new.rate_card_id) then
    raise exception 'Rate card v% has been activated; its prices are frozen — create a new version (D9-02)',
      v_card.version using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
create trigger trg_rate_card_frozen before update or delete on public.rate_cards
  for each row execute function public.guard_rate_card_frozen();
create trigger trg_rate_card_items_frozen before insert or update or delete on public.rate_card_items
  for each row execute function public.guard_rate_card_frozen();
create trigger trg_market_prices_frozen before insert or update or delete on public.market_prices
  for each row execute function public.guard_rate_card_frozen();

-- D9-02: "editing creates a new version" — a draft copy of an existing version (default: active)
create or replace function public.new_rate_card_version(
  p_effective_from date, p_from uuid default null, p_notes text default null)
returns uuid language plpgsql set search_path = '' as $$
declare
  v_from uuid := coalesce(p_from, (select id from public.rate_cards where is_active));
  v_new  uuid;
begin
  insert into public.rate_cards (version, effective_from, notes)
  values ((select coalesce(max(version), 0) + 1 from public.rate_cards), p_effective_from, p_notes)
  returning id into v_new;

  if v_from is not null then
    insert into public.rate_card_items (rate_card_id, fitting_type_id, work_type_id, finish_id, price, gst_rate, hsn_sac)
    select v_new, fitting_type_id, work_type_id, finish_id, price, gst_rate, hsn_sac
    from public.rate_card_items where rate_card_id = v_from;
    insert into public.market_prices (rate_card_id, fitting_type_id, finish_id, price)
    select v_new, fitting_type_id, finish_id, price
    from public.market_prices where rate_card_id = v_from;
  end if;
  return v_new;
end $$;
-- SECURITY INVOKER: RLS limits it to super_admin
revoke execute on function public.new_rate_card_version(date, uuid, text) from public, anon;
grant execute on function public.new_rate_card_version(date, uuid, text) to authenticated;

-- D9-03: activate a version; the previous active one steps down in the same transaction
create or replace function public.activate_rate_card(p_id uuid)
returns void language plpgsql set search_path = '' as $$
begin
  if not public.current_role_is('super_admin') and current_user = 'authenticated' then
    raise exception 'Only a super_admin activates a rate card' using errcode = '42501';
  end if;
  if not exists (select 1 from public.rate_card_items where rate_card_id = p_id) then
    raise exception 'A rate card with no prices cannot be activated' using errcode = '23514';
  end if;
  update public.rate_cards set is_active = false where is_active and id <> p_id;
  update public.rate_cards
  set is_active = true, activated_at = coalesce(activated_at, now())
  where id = p_id;
  if not found then
    raise exception 'Rate card not found' using errcode = 'P0002';
  end if;
end $$;
revoke execute on function public.activate_rate_card(uuid) from public, anon;
grant execute on function public.activate_rate_card(uuid) to authenticated;

-- Price lookups: exact finish first, then the finish-irrelevant row
create or replace function public.rate_card_price(
  p_rate_card uuid, p_fitting_type uuid, p_work_type_code text, p_finish uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select i.price
  from public.rate_card_items i
  join public.work_types w on w.id = i.work_type_id and w.code = p_work_type_code
  where i.rate_card_id = p_rate_card and i.fitting_type_id = p_fitting_type
    and (i.finish_id = p_finish or i.finish_id is null)
  order by (i.finish_id is null)            -- exact finish wins
  limit 1;
$$;

create or replace function public.market_price(p_rate_card uuid, p_fitting_type uuid, p_finish uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select m.price from public.market_prices m
  where m.rate_card_id = p_rate_card and m.fitting_type_id = p_fitting_type
    and (m.finish_id = p_finish or m.finish_id is null)
  order by (m.finish_id is null)
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- §9 Assessments — all three options always priced (BR-A2)
-- ---------------------------------------------------------------------------
create table public.assessments (
  id                       uuid primary key default gen_random_uuid(),
  fitting_id               uuid not null unique references public.fittings(id),
  recommended              public.treatment not null,
  finish_id                uuid references public.finishes(id),     -- target finish if restoring
  -- the three prices, frozen against a rate card version (BR-A3)
  rate_card_id             uuid not null references public.rate_cards(id),
  price_recommended        numeric(12,2) not null check (price_recommended >= 0),
  price_replace_eurobrass  numeric(12,2) not null check (price_replace_eurobrass >= 0),
  price_market_replacement numeric(12,2) not null check (price_market_replacement >= 0),
  -- BR-A4: market − recommended; null when it would not be positive → the UI hides it
  you_save                 numeric(12,2) generated always as (
                             case when price_market_replacement > price_recommended
                                  then price_market_replacement - price_recommended end) stored,
  part_unavailable_note    text,                                     -- D8-06 "Eurobrass can re-machine this"
  surveyor_note            text,
  -- BR-A5: any price not from the rate card must be justified
  is_manual_override       boolean not null default false,
  override_reason          text,
  created_by               uuid references public.profiles(id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint assessment_override_needs_reason
    check (not is_manual_override or length(trim(coalesce(override_reason, ''))) > 0)
);
create index assessments_rate_card_id_idx on public.assessments (rate_card_id);
create trigger trg_assessments_updated before update on public.assessments
  for each row execute function public.set_updated_at();
-- BR-A5: overrides (and every re-price) are in audit_log with actor and reason
create trigger trg_audit_assessments after insert or update on public.assessments
  for each row execute function public.write_audit();

alter table public.assessments enable row level security;

-- ---------------------------------------------------------------------------
-- upsert_assessment(): the surveyor records the recommendation; the SERVER prices it.
--   p: {fitting_id, recommended, finish_id?, surveyor_note?, part_unavailable_note?,
--       override?: {reason, price_recommended?, price_replace_eurobrass?, price_market_replacement?}}
-- Idempotent on fitting_id (one assessment per fitting) — safe for the offline outbox.
-- ---------------------------------------------------------------------------
create or replace function public.upsert_assessment(p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_role     text := (select auth.jwt()) ->> 'user_role';
  v_caller   uuid := (select auth.uid());
  v_fitting  record;
  v_card     uuid;
  v_rec      public.treatment := (p ->> 'recommended')::public.treatment;
  v_finish   uuid := nullif(p ->> 'finish_id', '')::uuid;
  v_override jsonb := p -> 'override';
  v_price_rec numeric;
  v_price_rep numeric;
  v_price_mkt numeric;
  v_missing  text[] := '{}';
  v_id       uuid;
begin
  select f.id, f.fitting_type_id, f.current_finish_id, s.surveyor_id, s.status
  into v_fitting
  from public.fittings f join public.surveys s on s.id = f.survey_id
  where f.id = (p ->> 'fitting_id')::uuid;
  if v_fitting.id is null then
    raise exception 'Fitting not found' using errcode = 'P0002';
  end if;
  if not (v_role = 'super_admin'
          or (v_role = 'surveyor' and v_fitting.surveyor_id = v_caller
              and v_fitting.status in ('checked_in','in_progress','submitted'))) then
    raise exception 'Only the assigned surveyor assesses this fitting' using errcode = '42501';
  end if;

  select id into v_card from public.rate_cards where is_active;
  if v_card is null then
    raise exception 'No active rate card — REDUX''s prices have not been loaded (D9)' using errcode = '55000';
  end if;

  -- BR-A2/A3: all three prices from the active version, on the server
  v_price_rec := case when v_rec = 'no_action' then 0
                      else public.rate_card_price(v_card, v_fitting.fitting_type_id, v_rec::text,
                                                  coalesce(v_finish, v_fitting.current_finish_id)) end;
  v_price_rep := public.rate_card_price(v_card, v_fitting.fitting_type_id, 'replace_eurobrass',
                                        coalesce(v_finish, v_fitting.current_finish_id));
  v_price_mkt := public.market_price(v_card, v_fitting.fitting_type_id,
                                     coalesce(v_finish, v_fitting.current_finish_id));

  -- BR-A5: a price not on the card needs a manual override with a reason
  if v_override is not null then
    if length(trim(coalesce(v_override ->> 'reason', ''))) = 0 then
      raise exception 'A manual price needs a reason (BR-A5)' using errcode = '23514';
    end if;
    v_price_rec := coalesce((v_override ->> 'price_recommended')::numeric, v_price_rec);
    v_price_rep := coalesce((v_override ->> 'price_replace_eurobrass')::numeric, v_price_rep);
    v_price_mkt := coalesce((v_override ->> 'price_market_replacement')::numeric, v_price_mkt);
  end if;

  if v_price_rec is null then v_missing := v_missing || 'recommended work'::text; end if;
  if v_price_rep is null then v_missing := v_missing || 'Eurobrass replacement'::text; end if;
  if v_price_mkt is null then v_missing := v_missing || 'market replacement'::text; end if;
  if cardinality(v_missing) > 0 then
    raise exception 'No rate-card price for: % — enter a manual price with a reason (BR-A2, BR-A5)',
      array_to_string(v_missing, ', ') using errcode = '23514';
  end if;

  insert into public.assessments (
    fitting_id, recommended, finish_id, rate_card_id,
    price_recommended, price_replace_eurobrass, price_market_replacement,
    part_unavailable_note, surveyor_note, is_manual_override, override_reason, created_by)
  values (
    v_fitting.id, v_rec, v_finish, v_card,
    v_price_rec, v_price_rep, v_price_mkt,
    nullif(trim(p ->> 'part_unavailable_note'), ''), nullif(trim(p ->> 'surveyor_note'), ''),
    v_override is not null, nullif(trim(v_override ->> 'reason'), ''), v_caller)
  on conflict (fitting_id) do update set
    recommended = excluded.recommended, finish_id = excluded.finish_id,
    rate_card_id = excluded.rate_card_id,
    price_recommended = excluded.price_recommended,
    price_replace_eurobrass = excluded.price_replace_eurobrass,
    price_market_replacement = excluded.price_market_replacement,
    part_unavailable_note = excluded.part_unavailable_note, surveyor_note = excluded.surveyor_note,
    is_manual_override = excluded.is_manual_override, override_reason = excluded.override_reason
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.upsert_assessment(jsonb) from public, anon;
grant execute on function public.upsert_assessment(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Policies (ADR-004)
-- ---------------------------------------------------------------------------
create policy rate_cards_admin on public.rate_cards for all to authenticated
  using ((select public.current_role_is('super_admin')))
  with check ((select public.current_role_is('super_admin')));
create policy rate_cards_read_surveyor on public.rate_cards for select to authenticated
  using ((select public.current_role_is('surveyor')) and is_active);

create policy rate_card_items_admin on public.rate_card_items for all to authenticated
  using ((select public.current_role_is('super_admin')))
  with check ((select public.current_role_is('super_admin')));
create policy rate_card_items_read_surveyor on public.rate_card_items for select to authenticated
  using ((select public.current_role_is('surveyor'))
         and exists (select 1 from public.rate_cards rc where rc.id = rate_card_items.rate_card_id and rc.is_active));

create policy market_prices_admin on public.market_prices for all to authenticated
  using ((select public.current_role_is('super_admin')))
  with check ((select public.current_role_is('super_admin')));
create policy market_prices_read_surveyor on public.market_prices for select to authenticated
  using ((select public.current_role_is('surveyor'))
         and exists (select 1 from public.rate_cards rc where rc.id = market_prices.rate_card_id and rc.is_active));

-- Assessments: the pricing surveyor and super_admin. Executives and customers see prices only on
-- a quote (roles matrix).
create policy assessments_select on public.assessments for select to authenticated
using (
  (select public.current_role_is('super_admin'))
  or ((select public.current_role_is('surveyor'))
      and exists (select 1 from public.fittings f join public.surveys s on s.id = f.survey_id
                  where f.id = assessments.fitting_id and s.surveyor_id = (select auth.uid())))
);
