-- E14-S15 · schema.sql §14 — service requests (D13-07), with the E-Commerce Rules clock:
-- acknowledge within 48 hours, resolve within 1 month (compliance §5).
--
-- Deviations from schema.sql (task tracker → Deviations):
--   * ticket_no → request_no. Glossary: REDUX is not a helpdesk; never "ticket".
--   * Raised only through raise_service_request(), which checks the customer owns every referenced
--     property / unit / warranty and sets both SLA deadlines from settings.
--   * Status moves only through acknowledge / resolve / close functions, forward only; the clock
--     columns are set by the system.
--   * Routing: the care team shares one queue (TN12 goes to cc_exec); assigned_to is who took it.

insert into public.settings (key, value, description) values
  ('service_ack_hours',    '48', 'E-Commerce Rules / D13-07: acknowledge a service request within this many hours'),
  ('service_resolve_days', '30', 'E-Commerce Rules: resolve within one month')
on conflict (key) do nothing;

create sequence public.service_request_no_seq;

create table public.service_requests (
  id              uuid primary key default gen_random_uuid(),
  request_no      text not null unique,                      -- SR-2027-00012
  customer_id     uuid not null references public.customers(id),
  property_id     uuid references public.properties(id),
  job_unit_id     uuid references public.job_units(id),
  warranty_id     uuid references public.warranties(id),
  raised_by       uuid references auth.users(id),
  subject         text not null check (length(trim(subject)) between 3 and 200),
  body            text,
  status          text not null default 'open'
                  check (status in ('open','acknowledged','in_progress','resolved','closed')),
  assigned_to     uuid references public.profiles(id),
  ack_due_at      timestamptz not null,
  acknowledged_at timestamptz,
  resolve_due_at  timestamptz not null,
  resolved_at     timestamptz,
  resolution_note text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint sr_resolved_has_note check (resolved_at is null or length(trim(coalesce(resolution_note, ''))) > 0)
);
create index service_requests_customer_id_idx on public.service_requests (customer_id);
create index service_requests_status_idx      on public.service_requests (status);
create index service_requests_assigned_to_idx on public.service_requests (assigned_to);
create index service_requests_ack_due_idx     on public.service_requests (ack_due_at) where acknowledged_at is null;
create trigger trg_service_requests_updated before update on public.service_requests
  for each row execute function public.set_updated_at();
create trigger trg_audit_service_requests after insert or update on public.service_requests
  for each row execute function public.write_audit();

alter table public.service_requests enable row level security;

create or replace function public.guard_service_request() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' then
    raise exception 'Service requests change through their actions (acknowledge, resolve, close)' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_service_requests_guard before update or delete on public.service_requests
  for each row execute function public.guard_service_request();

-- ---------------------------------------------------------------------------
-- D13-07: a customer raises a request from the portal; staff may raise one on their behalf
--   p: {customer_id?, property_id?, job_unit_id?, warranty_id?, subject, body?}
-- ---------------------------------------------------------------------------
create or replace function public.raise_service_request(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_role     text := coalesce((select auth.jwt()) ->> 'user_role', '');
  v_mine     uuid[] := public.my_customer_ids();
  v_customer uuid := nullif(p ->> 'customer_id', '')::uuid;
  v_id       uuid;
  v_no       text;
  v_ack      int := coalesce((select (value #>> '{}')::int from public.settings where key = 'service_ack_hours'), 48);
  v_resolve  int := coalesce((select (value #>> '{}')::int from public.settings where key = 'service_resolve_days'), 30);
begin
  if v_role = 'customer' then
    if cardinality(v_mine) = 1 and v_customer is null then v_customer := v_mine[1]; end if;
    if v_customer is null or not v_customer = any (v_mine) then
      raise exception 'Choose one of your own accounts' using errcode = '42501';
    end if;
  elsif not (public.is_system_caller() or v_role in ('super_admin','cc_exec')) then
    raise exception 'Not allowed to raise service requests' using errcode = '42501';
  elsif v_customer is null then
    raise exception 'Which customer is this for?' using errcode = '22023';
  end if;

  -- everything referenced must belong to that customer (P1)
  if (p ? 'property_id' and not exists (select 1 from public.properties where id = (p ->> 'property_id')::uuid and customer_id = v_customer))
  or (p ? 'job_unit_id' and not exists (select 1 from public.job_units u join public.jobs j on j.id = u.job_id
                                        where u.id = (p ->> 'job_unit_id')::uuid and j.customer_id = v_customer))
  or (p ? 'warranty_id' and not exists (select 1 from public.warranties w join public.jobs j on j.id = w.job_id
                                        where w.id = (p ->> 'warranty_id')::uuid and j.customer_id = v_customer)) then
    raise exception 'That property, room or warranty is not on this account' using errcode = '42501';
  end if;

  v_no := 'SR-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY') || '-' || lpad(nextval('public.service_request_no_seq')::text, 5, '0');
  insert into public.service_requests (request_no, customer_id, property_id, job_unit_id, warranty_id, raised_by,
                                       subject, body, ack_due_at, resolve_due_at)
  values (v_no, v_customer, nullif(p ->> 'property_id', '')::uuid, nullif(p ->> 'job_unit_id', '')::uuid,
          nullif(p ->> 'warranty_id', '')::uuid, (select auth.uid()),
          trim(p ->> 'subject'), nullif(trim(p ->> 'body'), ''),
          now() + make_interval(hours => v_ack), now() + make_interval(days => v_resolve))
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'request_no', v_no);
end $$;
revoke execute on function public.raise_service_request(jsonb) from public, anon;
grant execute on function public.raise_service_request(jsonb) to authenticated, service_role;

-- Care team actions: forward only (open → acknowledged → in_progress → resolved → closed)
create or replace function public.progress_service_request(p_id uuid, p_to text, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r      public.service_requests%rowtype;
  v_from int;
  v_to   int;
  v_order text[] := array['open','acknowledged','in_progress','resolved','closed'];
begin
  if not public.is_system_caller() and coalesce((select auth.jwt()) ->> 'user_role', '') not in ('super_admin','cc_exec') then
    raise exception 'Only the care team handles service requests' using errcode = '42501';
  end if;
  select * into r from public.service_requests where id = p_id for update;
  if not found then raise exception 'Service request not found' using errcode = 'P0002'; end if;
  v_from := array_position(v_order, r.status);
  v_to   := array_position(v_order, p_to);
  if v_to is null or v_to <= v_from then
    raise exception 'A request moves forward: % → % is not allowed', r.status, p_to using errcode = '22023';
  end if;
  if p_to = 'resolved' and length(trim(coalesce(p_note, ''))) = 0 then
    raise exception 'Say how it was resolved' using errcode = '23514';
  end if;

  update public.service_requests set
    status          = p_to,
    assigned_to     = coalesce(assigned_to, (select auth.uid())),
    acknowledged_at = coalesce(acknowledged_at, now()),              -- any step forward acknowledges
    resolved_at     = case when v_to >= 4 then coalesce(resolved_at, now()) else resolved_at end,
    resolution_note = case when p_to = 'resolved' then trim(p_note) else resolution_note end
  where id = p_id;
end $$;
revoke execute on function public.progress_service_request(uuid, text, text) from public, anon;
grant execute on function public.progress_service_request(uuid, text, text) to authenticated;

-- D13-07: requests past their acknowledgement deadline (feeds the SLA sweep / TN12 escalation)
create view public.v_service_requests_overdue with (security_invoker = true) as
select id, request_no, customer_id, status, ack_due_at, resolve_due_at,
       (acknowledged_at is null and now() > ack_due_at) as ack_overdue,
       (resolved_at is null and now() > resolve_due_at) as resolve_overdue
from public.service_requests
where (acknowledged_at is null and now() > ack_due_at) or (resolved_at is null and now() > resolve_due_at);

-- ---------------------------------------------------------------------------
-- Policies: care team and super_admin see all; a customer sees their own (P1)
-- ---------------------------------------------------------------------------
create policy service_requests_select on public.service_requests for select to authenticated
using (
  ((select auth.jwt()) ->> 'user_role') in ('super_admin','cc_exec')
  or customer_id = any ((select public.my_customer_ids())::uuid[])
);
