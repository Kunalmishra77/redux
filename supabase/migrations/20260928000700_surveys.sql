-- E6-S03, E9 (tables) · schema.sql §8 — surveys, check-ins, fittings, conditions, photos
-- The survey is FREE: it has no price column, and never will (BR-S1).
--
-- Deviations from schema.sql (task tracker → Deviations):
--   * BR-S2 (review item 14): overlap is prevented by an exclusion constraint on the slot's time
--     range, not a unique index on the exact start time. slot_end_at is NOT NULL.
--   * BR-S8: surveys.property_id is NOT NULL — book_survey() creates the prospect + property.
--   * Review item 4: nothing under a survey cascades on delete, and no delete policy exists on
--     fittings or photos — a delete can never silently take the photos with it (rule 8/9).
--   * Review item 5: photos are visible to the surveyor who owns the survey, staff who can see the
--     survey, and the customer — not to every surveyor and executive.
--   * Review item 10: BR-S5 (all four slots) is enforced when the survey is SUBMITTED; it cannot be
--     enforced at fitting insert, because photo rows reference the fitting.
--   * BR-L6 completed: 'survey_booked' needs a live survey, 'surveyed' a submitted one.
--   * survey_checkins gains idem_key (offline outbox, ADR-006) and received_at (server clock).

create extension if not exists btree_gist with schema extensions;

insert into public.settings (key, value, description) values
  ('survey_slot_minutes',   '120', 'D4-04: length of a free-survey slot (screen B6 shows 11:00–13:00)'),
  ('impossible_travel_kmh', '150', 'BR-S4: check-ins implying faster travel than this are flagged. Placeholder — REDUX to confirm')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Great-circle distance in metres (haversine) — geofence and travel checks
-- ---------------------------------------------------------------------------
create or replace function public.distance_m(lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric)
returns numeric language sql immutable set search_path = '' as $$
  select (2 * 6371000 * asin(sqrt(
      power(sin(radians((lat2 - lat1)::float8) / 2), 2)
    + cos(radians(lat1::float8)) * cos(radians(lat2::float8))
    * power(sin(radians((lng2 - lng1)::float8) / 2), 2))))::numeric(12,2);
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.surveys (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid references public.leads(id),
  property_id   uuid not null references public.properties(id),     -- BR-S8
  surveyor_id   uuid not null references public.profiles(id),
  booked_by     uuid references public.profiles(id),
  scheduled_at  timestamptz not null,
  slot_end_at   timestamptz not null,
  status        public.survey_status not null default 'scheduled',
  submitted_at  timestamptz,
  cancel_reason text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint surveys_slot_order check (slot_end_at > scheduled_at),
  constraint surveys_cancel_needs_reason check (status <> 'cancelled' or cancel_reason is not null),
  -- BR-S2: a surveyor cannot hold two overlapping slots
  constraint surveys_no_double_book exclude using gist
    (surveyor_id with =, tstzrange(scheduled_at, slot_end_at) with &&)
    where (status <> 'cancelled')
);
create index surveys_surveyor_sched_idx on public.surveys (surveyor_id, scheduled_at);
create index surveys_surveyor_id_idx    on public.surveys (surveyor_id);
create index surveys_lead_id_idx        on public.surveys (lead_id);
create index surveys_property_id_idx    on public.surveys (property_id);
create index surveys_status_idx         on public.surveys (status);
create trigger trg_surveys_updated before update on public.surveys
  for each row execute function public.set_updated_at();
create trigger trg_audit_surveys after update on public.surveys
  for each row when (old.status is distinct from new.status
                     or old.surveyor_id is distinct from new.surveyor_id
                     or old.scheduled_at is distinct from new.scheduled_at)
  execute function public.write_audit();

create table public.survey_checkins (
  id            uuid primary key default gen_random_uuid(),
  survey_id     uuid not null references public.surveys(id),
  surveyor_id   uuid not null references public.profiles(id),
  idem_key      text not null unique,                 -- offline outbox (ADR-006)
  lat           numeric(9,6) not null check (lat between -90 and 90),
  lng           numeric(9,6) not null check (lng between -180 and 180),
  accuracy_m    numeric(8,2),                         -- BR-S3: poor accuracy flagged, never blocked
  is_mocked     boolean not null default false,
  device_id     text,
  checked_in_at timestamptz not null,                 -- device clock, captured offline
  received_at   timestamptz not null default now(),   -- server clock
  -- server-side integrity (BR-S4) — set by trigger, never by the client
  geofence_ok   boolean,
  distance_m    numeric(10,2),
  flagged       boolean not null default false,
  flag_reason   text
);
create index survey_checkins_survey_id_idx   on public.survey_checkins (survey_id);
create index survey_checkins_surveyor_idx    on public.survey_checkins (surveyor_id, checked_in_at desc);
create index survey_checkins_flagged_idx     on public.survey_checkins (received_at desc) where flagged;

create table public.fittings (
  id                uuid primary key default gen_random_uuid(),
  survey_id         uuid not null references public.surveys(id),
  property_unit_id  uuid references public.property_units(id),
  unit_label        text,                             -- captured on site if the unit was new
  fitting_type_id   uuid not null references public.fitting_types(id),
  brand_id          uuid references public.brands(id),
  model             text,
  current_finish_id uuid references public.finishes(id),
  notes             text,
  idem_key          text not null unique,             -- offline outbox (ADR-006)
  captured_at       timestamptz not null,
  created_at        timestamptz not null default now(),
  constraint fittings_has_unit check (property_unit_id is not null or unit_label is not null)
);
create index fittings_survey_id_idx        on public.fittings (survey_id);
create index fittings_property_unit_id_idx on public.fittings (property_unit_id);

create table public.fitting_conditions (
  fitting_id        uuid not null references public.fittings(id),
  condition_flag_id uuid not null references public.condition_flags(id),
  primary key (fitting_id, condition_flag_id)
);
create index fitting_conditions_flag_idx on public.fitting_conditions (condition_flag_id);

-- BR-S5: four slots · BR-S7: immutable once synced — insert-only, never updated or deleted
create table public.fitting_photos (
  id           uuid primary key default gen_random_uuid(),
  fitting_id   uuid not null references public.fittings(id),
  slot         text not null check (slot in ('front','side','top','close_up')),
  storage_path text not null,                         -- surveys/{sid}/{fid}/{slot}/{sha256}.jpg
  sha256       text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  bytes        int check (bytes > 0),
  width        int,
  height       int,
  lat          numeric(9,6),
  lng          numeric(9,6),
  accuracy_m   numeric(8,2),
  device_id    text,
  captured_at  timestamptz not null,
  uploaded_at  timestamptz not null default now(),
  -- BR-P3: site photos may not be used for marketing without separate consent
  marketing_use_consented boolean not null default false,
  unique (fitting_id, slot, sha256)
);
create index fitting_photos_fitting_id_idx on public.fitting_photos (fitting_id);

-- A fitting is complete only with all four slots. security_invoker: the view obeys RLS.
create view public.v_incomplete_fittings with (security_invoker = true) as
select f.id as fitting_id, f.survey_id, count(distinct p.slot)::int as slots_filled
from public.fittings f
left join public.fitting_photos p on p.fitting_id = f.id
group by f.id, f.survey_id
having count(distinct p.slot) < 4;

alter table public.surveys            enable row level security;
alter table public.survey_checkins    enable row level security;
alter table public.fittings           enable row level security;
alter table public.fitting_conditions enable row level security;
alter table public.fitting_photos     enable row level security;

-- ---------------------------------------------------------------------------
-- Surveyor reach into §5 and §7: leads and customers behind their own surveys
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER on purpose: surveys' own policy reads leads, so reading surveys through RLS
-- from a leads policy would be a policy cycle ("infinite recursion detected in policy").
create or replace function public.is_my_survey_lead(p_lead_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.surveys s
                 where s.lead_id = p_lead_id and s.surveyor_id = (select auth.uid()));
$$;

create policy leads_select_surveyor on public.leads for select to authenticated
  using ((select public.current_role_is('surveyor')) and public.is_my_survey_lead(id));

create or replace function public.staff_can_see_customer(p_customer_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case ((select auth.jwt()) ->> 'user_role')
    when 'super_admin' then true
    when 'cc_exec' then exists (
      select 1 from public.customers c
      left join public.leads l on l.id = c.lead_id
      where c.id = p_customer_id
        and (not c.is_prospect or l.assigned_to = (select auth.uid())))
    when 'surveyor' then exists (
      select 1 from public.surveys s
      join public.properties p on p.id = s.property_id
      where p.customer_id = p_customer_id and s.surveyor_id = (select auth.uid()))
    else false
  end;
$$;

-- D7-03: the surveyor adds units found on site to properties they are surveying
create policy property_units_insert_surveyor on public.property_units for insert to authenticated
  with check ((select public.current_role_is('surveyor'))
              and exists (select 1 from public.surveys s
                          where s.property_id = property_units.property_id
                            and s.surveyor_id = (select auth.uid())
                            and s.status in ('scheduled','checked_in','in_progress')));

-- ---------------------------------------------------------------------------
-- BR-L6 complete: survey_booked needs a live survey; surveyed needs a submitted one
-- ---------------------------------------------------------------------------
create or replace function public.guard_lead_status() returns trigger
language plpgsql set search_path = '' as $$
declare v_requires_note boolean;
begin
  -- BR-L5: the SLA clock is the system's, not the executive's — nobody hides a breach by hand
  if current_user = 'authenticated'
     and not public.current_role_is('super_admin')
     and (new.sla_due_at       is distinct from old.sla_due_at
          or new.assigned_at      is distinct from old.assigned_at
          or new.previous_lead_id is distinct from old.previous_lead_id) then
    raise exception 'sla_due_at, assigned_at and previous_lead_id are system-managed'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if current_user = 'authenticated'
       and new.status in ('survey_booked','surveyed','quoted','won') then
      raise exception 'Status % is set by the system, not by hand (BR-L6)', new.status
        using errcode = '42501';
    end if;

    if new.status = 'survey_booked' and not exists (
         select 1 from public.surveys where lead_id = new.id and status <> 'cancelled') then
      raise exception 'A lead cannot be survey_booked without a survey (BR-L6)' using errcode = '23514';
    end if;
    if new.status = 'surveyed' and not exists (
         select 1 from public.surveys where lead_id = new.id and status = 'submitted') then
      raise exception 'A lead cannot be surveyed without a submitted survey (BR-L6)' using errcode = '23514';
    end if;

    if new.status = 'lost' then
      select requires_note into v_requires_note from public.lost_reasons where id = new.lost_reason_id;
      if v_requires_note and coalesce(trim(new.lost_note), '') = '' then
        raise exception 'This lost reason needs a note (BR-L7)' using errcode = '23514';
      end if;
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- D4-05: who can take this slot? Active surveyors with no overlapping survey. "Nearest" is
-- approximated as same city first, then least-loaded that day — surveyors have no base location
-- in the schema yet (task tracker, open item).
-- ---------------------------------------------------------------------------
create or replace function public.available_surveyors(p_property_id uuid, p_start timestamptz)
returns table (surveyor_id uuid, full_name text, same_city boolean, surveys_that_day int)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_end  timestamptz;
  v_city uuid;
  v_role text := (select auth.jwt()) ->> 'user_role';
begin
  if v_role is not null and v_role not in ('super_admin','cc_exec') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select p.city_id into v_city from public.properties p where p.id = p_property_id;
  v_end := p_start + make_interval(mins => coalesce(
    (select (value #>> '{}')::int from public.settings where key = 'survey_slot_minutes'), 120));

  return query
  select pr.id, pr.full_name,
         (v_city is not null and pr.city_id = v_city),
         (select count(*)::int from public.surveys s2
          where s2.surveyor_id = pr.id and s2.status <> 'cancelled'
            and (s2.scheduled_at at time zone 'Asia/Kolkata')::date = (p_start at time zone 'Asia/Kolkata')::date)
  from public.profiles pr
  join public.user_roles r on r.user_id = pr.id and r.role = 'surveyor'
  where pr.is_active
    and not exists (
      select 1 from public.surveys s
      where s.surveyor_id = pr.id and s.status <> 'cancelled'
        and tstzrange(s.scheduled_at, s.slot_end_at) && tstzrange(p_start, v_end))
  order by 3 desc, 4 asc, 2 asc;
end $$;
revoke execute on function public.available_surveyors(uuid, timestamptz) from public, anon;
grant execute on function public.available_surveyors(uuid, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- book_survey(): D4-04 — one call from the lead screen books the free survey.
--   p: {lead_id, surveyor_id, scheduled_at, property: {id | name, address, city_id, lat, lng}}
--   BR-S8 prospect + property · BR-S2 no overlap · BR-L6 lead → survey_booked.
-- Returns {survey_id, customer_id, property_id}.
-- ---------------------------------------------------------------------------
create or replace function public.book_survey(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_caller    uuid := nullif(((select auth.jwt()) ->> 'sub'), '')::uuid;
  v_lead_id   uuid := (p ->> 'lead_id')::uuid;
  v_surveyor  uuid := (p ->> 'surveyor_id')::uuid;
  v_start     timestamptz := (p ->> 'scheduled_at')::timestamptz;
  v_prospect  jsonb;
  v_survey_id uuid;
  v_status    public.lead_status;
begin
  if v_start is null or v_start < now() then
    raise exception 'Pick a slot in the future' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles pr
                 join public.user_roles r on r.user_id = pr.id and r.role = 'surveyor'
                 where pr.id = v_surveyor and pr.is_active) then
    raise exception 'That person is not an active surveyor' using errcode = '22023';
  end if;

  -- Permission (owner of the lead, super_admin or service role) is enforced in here (P3)
  v_prospect := public.ensure_prospect(v_lead_id, coalesce(p -> 'property', '{}'::jsonb));

  begin
    insert into public.surveys (lead_id, property_id, surveyor_id, booked_by, scheduled_at, slot_end_at)
    values (
      v_lead_id, (v_prospect ->> 'property_id')::uuid, v_surveyor, v_caller, v_start,
      v_start + make_interval(mins => coalesce(
        (select (value #>> '{}')::int from public.settings where key = 'survey_slot_minutes'), 120))
    ) returning id into v_survey_id;
  exception when exclusion_violation then
    raise exception 'That surveyor already has a survey in this slot (BR-S2)' using errcode = '23P01';
  end;

  select status into v_status from public.leads where id = v_lead_id;
  if v_status in ('new','contacted') then
    update public.leads set status = 'survey_booked' where id = v_lead_id;   -- BR-L6
  end if;

  return v_prospect - 'created_customer' || jsonb_build_object('survey_id', v_survey_id);
end $$;
revoke execute on function public.book_survey(jsonb) from public, anon;
grant execute on function public.book_survey(jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- BR-S3 / BR-S4: check-in integrity, computed on the server — flag, never block
-- ---------------------------------------------------------------------------
create or replace function public.check_in_integrity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_prop      record;
  v_prev      record;
  v_radius    numeric := coalesce((select (value #>> '{}')::numeric from public.settings where key = 'geofence_radius_m'), 500);
  v_accuracy  numeric := coalesce((select (value #>> '{}')::numeric from public.settings where key = 'gps_accuracy_flag_m'), 50);
  v_max_kmh   numeric := coalesce((select (value #>> '{}')::numeric from public.settings where key = 'impossible_travel_kmh'), 150);
  v_reasons   text[] := '{}';
  v_hours     numeric;
begin
  -- The client never sets these
  new.geofence_ok := null; new.distance_m := null; new.flagged := false; new.flag_reason := null;
  new.received_at := now();

  if new.accuracy_m is null or new.accuracy_m > v_accuracy then
    v_reasons := v_reasons || format('GPS accuracy %s m (limit %s m)', coalesce(new.accuracy_m::text, 'unknown'), v_accuracy);
  end if;
  if new.is_mocked then
    v_reasons := v_reasons || 'Mock location reported by the device'::text;
  end if;

  select p.lat, p.lng into v_prop
  from public.surveys s join public.properties p on p.id = s.property_id where s.id = new.survey_id;
  if v_prop.lat is not null then
    new.distance_m  := public.distance_m(new.lat, new.lng, v_prop.lat, v_prop.lng);
    new.geofence_ok := new.distance_m <= v_radius;
    if not new.geofence_ok then
      v_reasons := v_reasons || format('%s m from the property (geofence %s m)', round(new.distance_m), v_radius);
    end if;
  else
    v_reasons := v_reasons || 'Property has no location on record'::text;
  end if;

  select c.lat, c.lng, c.checked_in_at into v_prev
  from public.survey_checkins c
  where c.surveyor_id = new.surveyor_id and c.checked_in_at < new.checked_in_at
  order by c.checked_in_at desc limit 1;
  if v_prev.checked_in_at is not null then
    v_hours := extract(epoch from (new.checked_in_at - v_prev.checked_in_at)) / 3600;
    if v_hours > 0 and public.distance_m(new.lat, new.lng, v_prev.lat, v_prev.lng) / 1000 / v_hours > v_max_kmh then
      v_reasons := v_reasons || format('Impossible travel: over %s km/h since the previous check-in', v_max_kmh);
    end if;
  end if;

  new.flagged     := cardinality(v_reasons) > 0;
  new.flag_reason := nullif(array_to_string(v_reasons, '; '), '');
  return new;
end $$;
create trigger trg_checkin_integrity before insert on public.survey_checkins
  for each row execute function public.check_in_integrity();

-- A check-in moves a scheduled survey to checked_in
create or replace function public.checkin_advances_survey() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.surveys set status = 'checked_in'
  where id = new.survey_id and status = 'scheduled';
  return null;
end $$;
create trigger trg_checkin_advances after insert on public.survey_checkins
  for each row execute function public.checkin_advances_survey();

-- ---------------------------------------------------------------------------
-- submit_survey(): BR-S5 — every fitting has all four slots; at least one fitting.
-- BR-S6 (no unsynced attachment) is the app's gate; the server sees only confirmed photos,
-- so a missing slot here is exactly what an unsynced photo looks like.
-- ---------------------------------------------------------------------------
create or replace function public.submit_survey(p_survey_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_survey  public.surveys%rowtype;
  v_missing int;
begin
  select * into v_survey from public.surveys where id = p_survey_id for update;
  if not found then
    raise exception 'Survey not found' using errcode = 'P0002';
  end if;
  if coalesce((select auth.jwt()) ->> 'user_role', '') <> 'super_admin'
     and v_survey.surveyor_id is distinct from (select auth.uid()) then
    raise exception 'Only the assigned surveyor submits this survey' using errcode = '42501';
  end if;
  if v_survey.status not in ('checked_in','in_progress') then
    raise exception 'A % survey cannot be submitted', v_survey.status using errcode = '22023';
  end if;
  if not exists (select 1 from public.fittings where survey_id = p_survey_id) then
    raise exception 'A survey needs at least one fitting' using errcode = '23514';
  end if;

  select count(*) into v_missing
  from public.fittings f
  where f.survey_id = p_survey_id
    and (select count(distinct slot) from public.fitting_photos p where p.fitting_id = f.id) < 4;
  if v_missing > 0 then
    raise exception '% fitting(s) are missing photo slots (BR-S5)', v_missing using errcode = '23514';
  end if;

  update public.surveys set status = 'submitted', submitted_at = now() where id = p_survey_id;
  if v_survey.lead_id is not null then
    update public.leads set status = 'surveyed'
    where id = v_survey.lead_id and status = 'survey_booked';
  end if;
end $$;
revoke execute on function public.submit_survey(uuid) from public, anon;
grant execute on function public.submit_survey(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Policies (ADR-004)
-- ---------------------------------------------------------------------------
-- surveys: super_admin all; cc_exec those behind leads they can see; surveyor their own (P2).
-- Created by book_survey(); status moves through check-in / submit functions.
create policy surveys_select on public.surveys for select to authenticated
using (
  (select public.current_role_is('super_admin'))
  or ((select public.current_role_is('surveyor')) and surveyor_id = (select auth.uid()))
  or ((select public.current_role_is('cc_exec'))
      and exists (select 1 from public.leads l where l.id = surveys.lead_id))
);
-- D13-03: a customer sees the surveys of their own properties (and, through them, the fittings
-- and photos). Prospects have no portal access, so my_customer_ids() excludes them.
create policy surveys_select_customer on public.surveys for select to authenticated
  using (exists (select 1 from public.properties p
                 where p.id = surveys.property_id
                   and p.customer_id = any ((select public.my_customer_ids())::uuid[])));
create policy surveys_write_admin on public.surveys for all to authenticated
  using ((select public.current_role_is('super_admin')))
  with check ((select public.current_role_is('super_admin')));

-- check-ins: the surveyor records their own on their own open survey; staff who see the survey read
create policy survey_checkins_select on public.survey_checkins for select to authenticated
  using (exists (select 1 from public.surveys s where s.id = survey_checkins.survey_id));
create policy survey_checkins_insert on public.survey_checkins for insert to authenticated
  with check (surveyor_id = (select auth.uid())
              and exists (select 1 from public.surveys s
                          where s.id = survey_checkins.survey_id
                            and s.surveyor_id = (select auth.uid())
                            and s.status in ('scheduled','checked_in','in_progress')));

-- fittings: the surveyor writes on their own open survey; no delete policy (review item 4)
create policy fittings_select on public.fittings for select to authenticated
  using (exists (select 1 from public.surveys s where s.id = fittings.survey_id));
create policy fittings_insert on public.fittings for insert to authenticated
  with check (exists (select 1 from public.surveys s
                      where s.id = fittings.survey_id and s.surveyor_id = (select auth.uid())
                        and s.status in ('checked_in','in_progress')));
create policy fittings_update on public.fittings for update to authenticated
  using (exists (select 1 from public.surveys s
                 where s.id = fittings.survey_id and s.surveyor_id = (select auth.uid())
                   and s.status in ('checked_in','in_progress')))
  with check (exists (select 1 from public.surveys s
                      where s.id = fittings.survey_id and s.surveyor_id = (select auth.uid())
                        and s.status in ('checked_in','in_progress')));

-- conditions: a checklist, so the surveyor may untick while the survey is open
create policy fitting_conditions_select on public.fitting_conditions for select to authenticated
  using (exists (select 1 from public.fittings f where f.id = fitting_conditions.fitting_id));
create policy fitting_conditions_write on public.fitting_conditions for all to authenticated
  using (exists (select 1 from public.fittings f join public.surveys s on s.id = f.survey_id
                 where f.id = fitting_conditions.fitting_id and s.surveyor_id = (select auth.uid())
                   and s.status in ('checked_in','in_progress')))
  with check (exists (select 1 from public.fittings f join public.surveys s on s.id = f.survey_id
                      where f.id = fitting_conditions.fitting_id and s.surveyor_id = (select auth.uid())
                        and s.status in ('checked_in','in_progress')));

-- photos: insert-only (BR-S7). Visible to whoever can see the fitting — i.e. its survey:
-- the owning surveyor, staff behind the lead, super_admin, and the customer (P1/P2, item 5).
create policy fitting_photos_insert on public.fitting_photos for insert to authenticated
  with check (exists (select 1 from public.fittings f join public.surveys s on s.id = f.survey_id
                      where f.id = fitting_photos.fitting_id and s.surveyor_id = (select auth.uid())
                        and s.status in ('checked_in','in_progress')));
create policy fitting_photos_select on public.fitting_photos for select to authenticated
  using (exists (select 1 from public.fittings f where f.id = fitting_photos.fitting_id));
