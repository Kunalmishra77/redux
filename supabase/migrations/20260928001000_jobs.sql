-- E12-S01, S05, S06, S08, S09, S10 · E11-S09, S10 · schema.sql §11 — jobs, and the OTP approval
-- that creates them. BR-Q4, BR-Q5, BR-Q6 · BR-J1…J6 · review item 9.
--
-- Deviations from schema.sql (task tracker → Deviations):
--   * verify_quote_otp() is the approval: in ONE transaction it records the evidence, approves the
--     quote, converts the prospect, marks the lead won, and creates the job and its units (BR-Q6).
--     A wrong code is not an exception — the attempt must be counted and kept (BR-Q5).
--   * Review item 9: blocked time lives in unit_blocks (many blocks per unit, open-ended while
--     blocked), so the delay clock stops while a unit is CURRENTLY blocked and across repeat blocks.
--   * Stage and status move only through functions (BR-J1); a trigger rejects direct edits by users.
--   * A unit reaches 'handover' only through record_handover(), with all three checks passed (D11-07),
--     which generates the warranty cards (BR-J4/J5) and moves the unit to 'warranty_active'.
--   * Warranty kind per work type (blueprint silent — REDUX to confirm): repair → mechanical,
--     restore finish → finish, Eurobrass replacement → both. Periods come from the QUOTE's snapshot.
--   * One job per approved quote (unique quotation_id). Nothing cascades on delete.
--   * Portal link: a new auth user whose phone matches a customer contact is linked to it.

create sequence public.job_no_seq;
create sequence public.warranty_card_seq;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.jobs (
  id            uuid primary key default gen_random_uuid(),
  job_no        text not null unique,                      -- J-2027-0012
  quotation_id  uuid not null unique references public.quotations(id),
  customer_id   uuid not null references public.customers(id),
  property_id   uuid not null references public.properties(id),
  -- BR-J6: pilot → wider project
  is_pilot      boolean not null default false,
  parent_job_id uuid references public.jobs(id),
  status        public.job_status not null default 'planned',
  current_stage public.job_stage not null default 'dates_confirmed',   -- the least advanced unit
  planned_start date,
  planned_end   date,
  actual_start  date,
  actual_end    date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint jobs_not_own_parent check (parent_job_id is distinct from id),
  constraint jobs_planned_order check (planned_end is null or planned_start is null or planned_end >= planned_start)
);
create index jobs_customer_id_idx   on public.jobs (customer_id);
create index jobs_property_id_idx   on public.jobs (property_id);
create index jobs_status_idx        on public.jobs (status);
create index jobs_parent_job_id_idx on public.jobs (parent_job_id);
create index jobs_current_stage_idx on public.jobs (current_stage) where status <> 'completed';
create trigger trg_jobs_updated before update on public.jobs
  for each row execute function public.set_updated_at();
create trigger trg_audit_jobs after insert or update on public.jobs
  for each row execute function public.write_audit();

create table public.job_batches (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references public.jobs(id),
  name         text not null,                               -- 'Batch 2 · Rooms 204–207'
  planned_from date,
  planned_to   date,
  sort_order   int not null default 0,
  constraint job_batches_order check (planned_to is null or planned_from is null or planned_to >= planned_from)
);
create index job_batches_job_id_idx on public.job_batches (job_id);

create table public.job_units (
  id                     uuid primary key default gen_random_uuid(),
  job_id                 uuid not null references public.jobs(id),
  batch_id               uuid references public.job_batches(id),
  property_unit_id       uuid not null references public.property_units(id),
  status                 public.unit_status not null default 'scheduled',
  current_stage          public.job_stage not null default 'dates_confirmed',
  downtime_from          timestamptz,                        -- out of service (removal)
  downtime_to            timestamptz,
  planned_downtime_hours numeric(6,2) check (planned_downtime_hours is null or planned_downtime_hours > 0),
  back_in_service_at     timestamptz,
  unique (job_id, property_unit_id)
);
create index job_units_job_id_idx   on public.job_units (job_id);
create index job_units_batch_id_idx on public.job_units (batch_id);
create index job_units_status_idx   on public.job_units (status);

-- Item 9 / BR-J2: every block is its own interval; an open one (blocked_to null) is running now
create table public.unit_blocks (
  id           uuid primary key default gen_random_uuid(),
  job_unit_id  uuid not null references public.job_units(id),
  reason       text not null check (reason in ('civil_work','access','parts','customer_hold','other')),
  note         text,
  blocked_from timestamptz not null default now(),
  blocked_to   timestamptz,
  created_by   uuid references auth.users(id),
  constraint unit_blocks_order check (blocked_to is null or blocked_to >= blocked_from),
  constraint unit_blocks_other_note check (reason <> 'other' or length(trim(coalesce(note, ''))) > 0)
);
create index unit_blocks_job_unit_id_idx on public.unit_blocks (job_unit_id);
create unique index unit_blocks_one_open on public.unit_blocks (job_unit_id) where blocked_to is null;

create table public.job_stage_events (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null references public.jobs(id),
  job_unit_id     uuid references public.job_units(id),
  from_stage      public.job_stage,
  to_stage        public.job_stage not null,
  actor_id        uuid references auth.users(id),
  note            text,
  is_backward     boolean not null default false,
  backward_reason text,
  occurred_at     timestamptz not null default now(),
  constraint backward_needs_reason check (not is_backward or length(trim(coalesce(backward_reason, ''))) > 0)
);
create index job_stage_events_job_id_idx      on public.job_stage_events (job_id);
create index job_stage_events_job_unit_id_idx on public.job_stage_events (job_unit_id);

create table public.handovers (
  id              uuid primary key default gen_random_uuid(),
  job_unit_id     uuid not null unique references public.job_units(id),
  surveyor_id     uuid references public.profiles(id),
  leak_check      boolean not null,
  operation_check boolean not null,
  finish_check    boolean not null,
  customer_name   text not null,
  signature_path  text,
  notes           text,
  completed_at    timestamptz not null default now(),
  constraint handover_checks_passed check (leak_check and operation_check and finish_check)   -- D11-07
);

-- After-photos: insert-only, like survey photos
create table public.handover_photos (
  id           uuid primary key default gen_random_uuid(),
  handover_id  uuid not null references public.handovers(id),
  fitting_id   uuid references public.fittings(id),
  storage_path text not null,                          -- jobs/{job_id}/{unit_id}/{sha256}.jpg
  sha256       text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  captured_at  timestamptz not null default now(),
  unique (handover_id, sha256)
);
create index handover_photos_handover_id_idx on public.handover_photos (handover_id);

-- BR-J4/J5: generated at handover, separate periods
create table public.warranties (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.jobs(id),
  job_unit_id uuid not null references public.job_units(id),
  fitting_id  uuid not null references public.fittings(id),
  kind        text not null check (kind in ('mechanical','finish')),
  valid_from  date not null,
  valid_until date not null,
  terms_text  text not null,
  card_no     text not null unique,
  created_at  timestamptz not null default now(),
  unique (fitting_id, job_id, kind),
  constraint warranties_order check (valid_until >= valid_from)
);
create index warranties_job_id_idx      on public.warranties (job_id);
create index warranties_job_unit_id_idx on public.warranties (job_unit_id);
create index warranties_valid_until_idx on public.warranties (valid_until);

alter table public.jobs             enable row level security;
alter table public.job_batches      enable row level security;
alter table public.job_units        enable row level security;
alter table public.unit_blocks      enable row level security;
alter table public.job_stage_events enable row level security;
alter table public.handovers        enable row level security;
alter table public.handover_photos  enable row level security;
alter table public.warranties       enable row level security;

create trigger trg_handover_photos_append_only before update or delete on public.handover_photos
  for each row execute function public.forbid_change();
create trigger trg_warranties_append_only before update or delete on public.warranties
  for each row execute function public.forbid_change();

-- ---------------------------------------------------------------------------
-- BR-J1: stage and status are moved only by the functions below
-- ---------------------------------------------------------------------------
create or replace function public.guard_job_progress() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated'
     and (new.status is distinct from old.status or new.current_stage is distinct from old.current_stage) then
    raise exception 'Stage and status move through the job functions, not by hand (BR-J1)' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_jobs_progress_guard before update on public.jobs
  for each row execute function public.guard_job_progress();
create trigger trg_job_units_progress_guard before update on public.job_units
  for each row execute function public.guard_job_progress();

-- The job follows its units: current_stage = least advanced unit; planned → in_progress →
-- completed only when EVERY unit has been handed over (BR-J3).
create or replace function public.rollup_job(p_job uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_min public.job_stage; v_all_done boolean; v_any_started boolean;
begin
  select min(current_stage),
         bool_and(current_stage >= 'handover'),
         bool_or(current_stage > 'dates_confirmed')
  into v_min, v_all_done, v_any_started
  from public.job_units where job_id = p_job;

  update public.jobs set
    current_stage = coalesce(v_min, current_stage),
    status = case when status = 'cancelled' then status
                  when v_all_done then 'completed'
                  when v_any_started then 'in_progress'
                  else 'planned' end,
    actual_start = case when v_any_started then coalesce(actual_start, (now() at time zone 'Asia/Kolkata')::date) else actual_start end,
    actual_end   = case when v_all_done then coalesce(actual_end, (now() at time zone 'Asia/Kolkata')::date) else null end
  where id = p_job;
end $$;
revoke execute on function public.rollup_job(uuid) from public, anon, authenticated;

create or replace function public.can_run_job(p_job uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  -- super_admin runs every job; the surveyor who surveyed it does the handover (J1 step 17)
  select coalesce((select auth.jwt()) ->> 'user_role', '') = 'super_admin'
      or exists (select 1 from public.jobs j
                 join public.quotations q on q.id = j.quotation_id
                 join public.surveys s on s.id = q.survey_id
                 where j.id = p_job and s.surveyor_id = (select auth.uid()));
$$;

-- ---------------------------------------------------------------------------
-- BR-J1: one stage forward at a time; back only with a reason. 'handover' and beyond are
-- reached through record_handover(), never here.
-- ---------------------------------------------------------------------------
create or replace function public.move_unit_stage(p_unit uuid, p_to public.job_stage,
                                                  p_note text default null, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  u        public.job_units%rowtype;
  v_stages public.job_stage[] := enum_range(null::public.job_stage);
  v_from_i int;
  v_to_i   int;
  v_back   boolean;
begin
  select * into u from public.job_units where id = p_unit for update;
  if not found then raise exception 'Unit not found' using errcode = 'P0002'; end if;
  if coalesce((select auth.jwt()) ->> 'user_role', '') <> 'super_admin' and current_user = 'authenticated' then
    raise exception 'Only a super_admin moves job stages' using errcode = '42501';
  end if;
  if p_to in ('handover','warranty_active') then
    raise exception 'Handover is recorded with the handover checks, not by moving the stage (D11-07)' using errcode = '22023';
  end if;
  if u.status = 'blocked' then
    raise exception 'The unit is blocked — unblock it first (BR-J2)' using errcode = '22023';
  end if;

  v_from_i := array_position(v_stages, u.current_stage);
  v_to_i   := array_position(v_stages, p_to);
  v_back   := v_to_i < v_from_i;
  if v_to_i = v_from_i then
    raise exception 'The unit is already at %', p_to using errcode = '22023';
  end if;
  if not v_back and v_to_i <> v_from_i + 1 then
    raise exception 'Stages move one at a time: % → % skips a stage (BR-J1)', u.current_stage, p_to using errcode = '23514';
  end if;
  if v_back and length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Moving a unit back needs a reason (BR-J1)' using errcode = '23514';
  end if;

  update public.job_units set
    current_stage = p_to,
    status = (case when p_to = 'dates_confirmed' then 'scheduled' else 'in_progress' end)::public.unit_status,
    -- the room leaves service at removal (D11 downtime)
    downtime_from = case when p_to = 'removal_pickup' then coalesce(downtime_from, now()) else downtime_from end
  where id = p_unit;

  insert into public.job_stage_events (job_id, job_unit_id, from_stage, to_stage, actor_id, note, is_backward, backward_reason)
  values (u.job_id, p_unit, u.current_stage, p_to, (select auth.uid()), p_note, v_back, nullif(trim(p_reason), ''));

  perform public.rollup_job(u.job_id);
end $$;
revoke execute on function public.move_unit_stage(uuid, public.job_stage, text, text) from public, anon;
grant execute on function public.move_unit_stage(uuid, public.job_stage, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- BR-J2 / item 9: blocking stops the delay clock
-- ---------------------------------------------------------------------------
create or replace function public.block_unit(p_unit uuid, p_reason text, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare u public.job_units%rowtype;
begin
  select * into u from public.job_units where id = p_unit for update;
  if not found then raise exception 'Unit not found' using errcode = 'P0002'; end if;
  if not public.can_run_job(u.job_id) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if u.current_stage >= 'handover' then
    raise exception 'A handed-over unit cannot be blocked' using errcode = '22023';
  end if;
  insert into public.unit_blocks (job_unit_id, reason, note, created_by)
  values (p_unit, p_reason, nullif(trim(p_note), ''), (select auth.uid()));
  update public.job_units set status = 'blocked' where id = p_unit;
end $$;
revoke execute on function public.block_unit(uuid, text, text) from public, anon;
grant execute on function public.block_unit(uuid, text, text) to authenticated;

create or replace function public.unblock_unit(p_unit uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare u public.job_units%rowtype;
begin
  select * into u from public.job_units where id = p_unit for update;
  if not found then raise exception 'Unit not found' using errcode = 'P0002'; end if;
  if not public.can_run_job(u.job_id) then raise exception 'Not allowed' using errcode = '42501'; end if;
  update public.unit_blocks set blocked_to = now() where job_unit_id = p_unit and blocked_to is null;
  if not found then raise exception 'The unit is not blocked' using errcode = '22023'; end if;
  update public.job_units
  set status = (case when current_stage = 'dates_confirmed' then 'scheduled' else 'in_progress' end)::public.unit_status
  where id = p_unit;
end $$;
revoke execute on function public.unblock_unit(uuid) from public, anon;
grant execute on function public.unblock_unit(uuid) to authenticated;

-- Hours out of service that count against REDUX: downtime minus every block (open ones run to now)
create or replace function public.unit_effective_downtime_hours(p_unit uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select round(greatest(0,
    extract(epoch from (coalesce(u.back_in_service_at, now()) - u.downtime_from)) / 3600
    - coalesce((
        select sum(extract(epoch from (
                 least(coalesce(b.blocked_to, now()), coalesce(u.back_in_service_at, now()))
               - greatest(b.blocked_from, u.downtime_from))) / 3600)
        from public.unit_blocks b
        where b.job_unit_id = u.id
          and coalesce(b.blocked_to, now()) > u.downtime_from
          and b.blocked_from < coalesce(u.back_in_service_at, now())), 0))::numeric, 2)
  from public.job_units u where u.id = p_unit and u.downtime_from is not null;
$$;

-- D11-04: units past their planned downtime and not blocked right now (feeds job_delay_sweep)
create view public.v_delayed_units with (security_invoker = true) as
select u.id as job_unit_id, u.job_id, u.planned_downtime_hours,
       public.unit_effective_downtime_hours(u.id) as effective_downtime_hours
from public.job_units u
where u.downtime_from is not null and u.back_in_service_at is null and u.status <> 'blocked'
  and u.planned_downtime_hours is not null
  and public.unit_effective_downtime_hours(u.id) > u.planned_downtime_hours;

-- ---------------------------------------------------------------------------
-- D11-07 + BR-J4/J5: handover with all checks → warranty cards → warranty_active
-- ---------------------------------------------------------------------------
create or replace function public.record_handover(p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  u          public.job_units%rowtype;
  q          public.quotations%rowtype;
  v_handover uuid;
  v_today    date := (now() at time zone 'Asia/Kolkata')::date;
begin
  select * into u from public.job_units where id = (p ->> 'job_unit_id')::uuid for update;
  if not found then raise exception 'Unit not found' using errcode = 'P0002'; end if;
  if not public.can_run_job(u.job_id) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if u.status = 'blocked' then raise exception 'The unit is blocked' using errcode = '22023'; end if;
  if u.current_stage <> 'refit_test' then
    raise exception 'Handover follows refit & test (BR-J1); the unit is at %', u.current_stage using errcode = '23514';
  end if;
  if not (coalesce((p ->> 'leak_check')::boolean, false) and coalesce((p ->> 'operation_check')::boolean, false)
          and coalesce((p ->> 'finish_check')::boolean, false)) then
    raise exception 'Leak, operation and finish must all pass before the room returns to service (D11-07)'
      using errcode = '23514';
  end if;

  insert into public.handovers (job_unit_id, surveyor_id, leak_check, operation_check, finish_check,
                                customer_name, signature_path, notes)
  values (u.id, (select auth.uid()), true, true, true,
          coalesce(nullif(trim(p ->> 'customer_name'), ''), 'Not recorded'),
          p ->> 'signature_path', nullif(trim(p ->> 'notes'), ''))
  returning id into v_handover;

  update public.job_units set current_stage = 'handover', status = 'back_in_service',
    back_in_service_at = now(), downtime_to = now()
  where id = u.id;
  insert into public.job_stage_events (job_id, job_unit_id, from_stage, to_stage, actor_id, note)
  values (u.job_id, u.id, 'refit_test', 'handover', (select auth.uid()), 'Handover signed off');

  -- BR-J4: the warranty starts when the fitting is back in service, from the QUOTE's terms (BR-Q3)
  select qt.* into q from public.quotations qt join public.jobs j on j.quotation_id = qt.id where j.id = u.job_id;
  insert into public.warranties (job_id, job_unit_id, fitting_id, kind, valid_from, valid_until, terms_text, card_no)
  select u.job_id, u.id, l.fitting_id, k.kind, v_today, v_today + k.days, q.terms_text,
         'W-' || to_char(v_today, 'YYYY') || '-' || lpad(nextval('public.warranty_card_seq')::text, 5, '0')
  from public.quotation_lines l
  join public.fittings f on f.id = l.fitting_id
  join public.work_types w on w.id = l.work_type_id
  cross join lateral (values
      ('mechanical', q.warranty_mechanical_days, w.code in ('repair_function','replace_eurobrass')),
      ('finish',     q.warranty_finish_days,     w.code in ('restore_finish','replace_eurobrass'))
    ) k(kind, days, applies)
  where l.quotation_id = q.id and f.property_unit_id = u.property_unit_id
    and k.applies and k.days is not null
  on conflict (fitting_id, job_id, kind) do nothing;

  update public.job_units set current_stage = 'warranty_active' where id = u.id;
  insert into public.job_stage_events (job_id, job_unit_id, from_stage, to_stage, actor_id, note)
  values (u.job_id, u.id, 'handover', 'warranty_active', (select auth.uid()), 'Warranty cards generated');

  perform public.rollup_job(u.job_id);
  return v_handover;
end $$;
revoke execute on function public.record_handover(jsonb) from public, anon;
grant execute on function public.record_handover(jsonb) to authenticated;

-- BR-J6: link a wider project to the pilot it grew from (same customer; the parent is a pilot)
create or replace function public.link_to_pilot(p_job uuid, p_pilot uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce((select auth.jwt()) ->> 'user_role', '') <> 'super_admin' and current_user = 'authenticated' then
    raise exception 'Only a super_admin links projects' using errcode = '42501';
  end if;
  if not exists (select 1 from public.jobs p join public.jobs j on j.customer_id = p.customer_id
                 where p.id = p_pilot and p.is_pilot and j.id = p_job and j.id <> p.id) then
    raise exception 'The parent must be a pilot job of the same customer (BR-J6)' using errcode = '23514';
  end if;
  update public.jobs set parent_job_id = p_pilot where id = p_job;
end $$;
revoke execute on function public.link_to_pilot(uuid, uuid) from public, anon;
grant execute on function public.link_to_pilot(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- verify_quote_otp(): THE approval (api-spec: "the most important action in the system").
--   BR-Q5  wrong code → attempt counted and KEPT (no exception); 5 attempts → locked; 10 min expiry
--   BR-Q1  quote must be sent and in validity
--   BR-Q4  full evidence, server timestamps
--   BR-Q6  approval + customer + job in one transaction: any failure → none of it happened
-- Server only. Returns {ok, reason?, attempts_left?, job_id?, customer_id?}.
-- (Confirmation WhatsApp CN4 and CAPI job_won are enqueued here once E4/E5 queues exist.)
-- ---------------------------------------------------------------------------
create or replace function public.verify_quote_otp(p_otp uuid, p_code text, p jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  v_max    int := coalesce((select (value #>> '{}')::int from public.settings where key = 'otp_max_attempts'), 5);
  o        public.quote_otps%rowtype;
  q        public.quotations%rowtype;
  v_job    uuid;
  v_name   text := nullif(trim(p ->> 'approver_name'), '');
begin
  if v_claims is not null and coalesce(v_claims ->> 'role', '') <> 'service_role' then
    raise exception 'Approvals are verified by the server only' using errcode = '42501';
  end if;

  select * into o from public.quote_otps where id = p_otp for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'unknown_code'); end if;
  if o.verified_at is not null then return jsonb_build_object('ok', false, 'reason', 'already_used'); end if;
  if o.locked_at is not null then return jsonb_build_object('ok', false, 'reason', 'locked'); end if;
  if now() > o.expires_at then return jsonb_build_object('ok', false, 'reason', 'expired_code'); end if;

  -- BR-Q5: count the attempt first; it stays counted whatever happens next
  update public.quote_otps set attempts = attempts + 1 where id = o.id returning * into o;
  if encode(extensions.digest(o.id::text || ':' || coalesce(p_code, ''), 'sha256'), 'hex') <> o.otp_hash then
    update public.quote_otps set failed_attempts = failed_attempts + 1,
      locked_at = case when attempts >= v_max then now() end
    where id = o.id returning * into o;
    return jsonb_build_object('ok', false,
      'reason', case when o.locked_at is not null then 'locked' else 'wrong_code' end,
      'attempts_left', greatest(v_max - o.attempts, 0));
  end if;

  select * into q from public.quotations where id = o.quotation_id for update;
  if q.status <> 'sent' or q.valid_until < (now() at time zone 'Asia/Kolkata')::date then
    return jsonb_build_object('ok', false, 'reason', 'quote_not_approvable');   -- BR-Q1
  end if;

  -- ── from here, all or nothing (BR-Q6) ─────────────────────────────────────
  update public.quote_otps set verified_at = now() where id = o.id;

  insert into public.quote_approvals (quotation_id, quotation_version, pdf_sha256, approver_name, approver_phone,
    otp_hash, otp_generated_at, otp_delivered_at, otp_verified_at, delivery_channel, gateway_message_id,
    dlt_template_id, attempt_count, failed_attempts, ip_address, user_agent, geolocation, terms_text)
  values (q.id, q.version, q.pdf_sha256,
    coalesce(v_name, (select name from public.customer_contacts where customer_id = q.customer_id and phone = o.phone limit 1), o.phone),
    o.phone, o.otp_hash, o.generated_at, o.delivered_at, now(), o.channel, o.gateway_message_id,
    o.dlt_template_id, o.attempts, o.failed_attempts,
    nullif(p ->> 'ip_address', '')::inet, p ->> 'user_agent', p -> 'geolocation', q.terms_text);

  update public.quotations set status = 'approved' where id = q.id;

  -- the prospect becomes a customer (BR-S8: converted, never recreated) with the approver as a contact
  update public.customers set is_prospect = false, converted_at = coalesce(converted_at, now())
  where id = q.customer_id and is_prospect;
  insert into public.customer_contacts (customer_id, name, phone)
  values (q.customer_id, coalesce(v_name, o.phone), o.phone)
  on conflict (customer_id, phone) do nothing;

  if q.lead_id is not null then
    update public.leads set status = 'won' where id = q.lead_id and status not in ('won','lost');
  end if;

  -- units: every unit named on the quote exists as a property unit, and fittings point at it
  insert into public.property_units (property_id, label)
  select distinct q.property_id, l.unit_label from public.quotation_lines l
  where l.quotation_id = q.id and l.unit_label is not null
  on conflict (property_id, label) do nothing;
  update public.fittings f set property_unit_id = pu.id
  from public.quotation_lines l
  join public.property_units pu on pu.property_id = q.property_id and pu.label = l.unit_label
  where l.quotation_id = q.id and f.id = l.fitting_id and f.property_unit_id is null;

  insert into public.jobs (job_no, quotation_id, customer_id, property_id)
  values ('J-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY') || '-' || lpad(nextval('public.job_no_seq')::text, 4, '0'),
          q.id, q.customer_id, q.property_id)
  returning id into v_job;

  insert into public.job_units (job_id, property_unit_id)
  select distinct v_job, pu.id
  from public.quotation_lines l
  join public.property_units pu on pu.property_id = q.property_id and pu.label = l.unit_label
  where l.quotation_id = q.id;

  if not exists (select 1 from public.job_units where job_id = v_job) then
    raise exception 'The approved quote names no units — nothing can be scheduled' using errcode = '23514';
  end if;

  insert into public.job_stage_events (job_id, to_stage, note)
  values (v_job, 'dates_confirmed', 'Job created from quote ' || q.quote_no || ' v' || q.version);

  return jsonb_build_object('ok', true, 'job_id', v_job, 'customer_id', q.customer_id);
end $$;
revoke execute on function public.verify_quote_otp(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.verify_quote_otp(uuid, text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Portal accounts: a new login whose phone matches a customer contact is linked to it
-- (auth.users.phone is stored without the leading '+').
-- ---------------------------------------------------------------------------
create or replace function public.link_portal_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.phone is not null and new.phone <> '' then
    update public.customer_contacts cc set user_id = new.id
    from public.customers c
    where cc.customer_id = c.id and not c.is_prospect and cc.is_active and cc.user_id is null
      and cc.phone = '+' || ltrim(new.phone, '+');
  end if;
  return new;
end $$;
create trigger trg_link_portal_user after insert or update of phone on auth.users
  for each row execute function public.link_portal_user();

-- ---------------------------------------------------------------------------
-- Policies (ADR-004). Writes go through the functions; super_admin maintains plans and batches.
-- ---------------------------------------------------------------------------
create policy jobs_select on public.jobs for select to authenticated
using (
  (select public.current_role_is('super_admin'))
  or (select public.current_role_is('cc_exec'))                  -- roles: executives track every job
  or ((select public.current_role_is('surveyor')) and public.can_run_job(id))
  or customer_id = any ((select public.my_customer_ids())::uuid[])
);
create policy jobs_plan_admin on public.jobs for update to authenticated
  using ((select public.current_role_is('super_admin')))
  with check ((select public.current_role_is('super_admin')));

create policy job_batches_select on public.job_batches for select to authenticated
  using (exists (select 1 from public.jobs j where j.id = job_batches.job_id));
create policy job_batches_admin on public.job_batches for all to authenticated
  using ((select public.current_role_is('super_admin')))
  with check ((select public.current_role_is('super_admin')));

create policy job_units_select on public.job_units for select to authenticated
  using (exists (select 1 from public.jobs j where j.id = job_units.job_id));
create policy job_units_plan_admin on public.job_units for update to authenticated
  using ((select public.current_role_is('super_admin')))
  with check ((select public.current_role_is('super_admin')));

create policy unit_blocks_select on public.unit_blocks for select to authenticated
  using (exists (select 1 from public.job_units u where u.id = unit_blocks.job_unit_id));
create policy job_stage_events_select on public.job_stage_events for select to authenticated
  using (exists (select 1 from public.jobs j where j.id = job_stage_events.job_id));
create policy handovers_select on public.handovers for select to authenticated
  using (exists (select 1 from public.job_units u where u.id = handovers.job_unit_id));
create policy handover_photos_select on public.handover_photos for select to authenticated
  using (exists (select 1 from public.handovers h where h.id = handover_photos.handover_id));
create policy handover_photos_insert on public.handover_photos for insert to authenticated
  with check (exists (select 1 from public.handovers h join public.job_units u on u.id = h.job_unit_id
                      where h.id = handover_photos.handover_id and public.can_run_job(u.job_id)));
create policy warranties_select on public.warranties for select to authenticated
  using (exists (select 1 from public.jobs j where j.id = warranties.job_id));
