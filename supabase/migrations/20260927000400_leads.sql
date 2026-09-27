-- E3-S01 … E3-S05 · schema.sql §5 — leads, touches, history, notes, follow-ups, campaigns (D2)
--
-- Deviations from schema.sql (task tracker → Deviations):
--   * BR-L1 (decision 27 Sep 2026): phone is unique among OPEN leads only. A repeat enquiry
--     attaches to the open lead as a touch; if the number's lead is won/lost, a NEW lead is created
--     and linked through previous_lead_id.
--   * Leads are created only through ingest_lead() — never a direct INSERT — so dedup,
--     assignment and the SLA clock happen atomically for every source (web, webhooks, manual).
--   * BR-L3 immutability also covers campaign_id, meta_leadgen_id, google_lead_id, utm, raw_payload.
--   * assignment_state is keyed by scope ('city:<uuid>' | 'global'), so the no-city round-robin
--     has somewhere to keep its pointer.
--   * Pipeline stages after 'contacted' (survey_booked, surveyed, quoted, won) are set by system
--     functions only; BR-L6 is enforced when surveys exist (§8).

-- ---------------------------------------------------------------------------
-- Sources and campaigns
-- ---------------------------------------------------------------------------
create table public.lead_sources (
  id        uuid primary key default gen_random_uuid(),
  code      text not null unique,
  name      text not null,
  is_active boolean not null default true
);

insert into public.lead_sources (code, name) values
  ('website',           'Website form'),
  ('dealer',            'Dealer enquiry'),
  ('meta_lead_ad',      'Meta lead ad'),
  ('whatsapp_chat',     'WhatsApp chat'),
  ('whatsapp_campaign', 'WhatsApp campaign'),
  ('google_ads',        'Google Ads lead form'),
  ('call',              'Phone call'),
  ('walk_in',           'Walk-in')
on conflict (code) do nothing;

create table public.campaigns (
  id            uuid primary key default gen_random_uuid(),
  source_id     uuid not null references public.lead_sources(id),
  external_id   text,                          -- Meta campaign_id / Google campaign_id
  name          text not null,
  spend_to_date numeric(12,2),                 -- manually maintained; powers cost-per-won-job
  started_on    date,
  ended_on      date,
  unique (source_id, external_id)
);

-- ---------------------------------------------------------------------------
-- Leads
-- ---------------------------------------------------------------------------
create table public.leads (
  id             uuid primary key default gen_random_uuid(),
  -- identity: BR-L1, E.164 — normalised by lib/services/phone.ts before it gets here
  phone          text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  name           text,
  email          text,
  city_id        uuid references public.cities(id),
  previous_lead_id uuid references public.leads(id),   -- the closed lead this repeat enquiry follows

  -- classification
  customer_type  text check (customer_type in ('home','hotel','dealer','other')),
  property_name  text,
  unit_count     int check (unit_count is null or unit_count > 0),
  enquirer_role  text,
  firm_gstin     text,                          -- dealer form, optional (D1-04)

  -- attribution: BR-L3, immutable after insert
  source_id      uuid not null references public.lead_sources(id),
  campaign_id    uuid references public.campaigns(id),
  meta_ad_id     text,
  meta_form_id   text,
  meta_leadgen_id text,
  google_lead_id text,
  ctwa_clid      text,                          -- cannot be backfilled — capture at creation
  utm            jsonb,
  raw_payload    jsonb,

  -- workflow
  status         public.lead_status not null default 'new',
  assigned_to    uuid references public.profiles(id),
  assigned_at    timestamptz,
  sla_due_at     timestamptz,                   -- BR-L5: from creation, not assignment
  lost_reason_id uuid references public.lost_reasons(id),
  lost_note      text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint leads_lost_needs_reason check (status <> 'lost' or lost_reason_id is not null)
);
-- BR-L1: one OPEN lead per phone
create unique index leads_open_phone_uq on public.leads (phone) where status not in ('won','lost');
create index leads_phone_idx            on public.leads (phone);
create index leads_assigned_to_idx      on public.leads (assigned_to);
create index leads_status_idx           on public.leads (status);
create index leads_source_id_idx        on public.leads (source_id);
create index leads_city_id_idx          on public.leads (city_id);
create index leads_created_at_idx       on public.leads (created_at desc);
create index leads_sla_due_idx          on public.leads (sla_due_at) where status in ('new','contacted');
create index leads_previous_lead_idx    on public.leads (previous_lead_id);
create unique index leads_meta_leadgen_uq on public.leads (meta_leadgen_id) where meta_leadgen_id is not null;
create unique index leads_google_lead_uq  on public.leads (google_lead_id)  where google_lead_id  is not null;

create trigger trg_leads_updated before update on public.leads
  for each row execute function public.set_updated_at();

-- A repeat enquiry is a TOUCH, not a new lead (BR-L1/L2). The creating enquiry is a touch too,
-- so every source that ever reached this lead is on record.
create table public.lead_touches (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads(id),
  source_id   uuid not null references public.lead_sources(id),
  campaign_id uuid references public.campaigns(id),
  payload     jsonb,
  occurred_at timestamptz not null default now()
);
create index lead_touches_lead_id_idx on public.lead_touches (lead_id);

create table public.lead_status_history (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads(id),
  from_status public.lead_status,
  to_status   public.lead_status not null,
  actor_id    uuid references public.profiles(id),
  note        text,
  changed_at  timestamptz not null default now()
);
create index lead_status_history_lead_id_idx on public.lead_status_history (lead_id);

create table public.lead_notes (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references public.leads(id),
  author_id  uuid references public.profiles(id),
  body       text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);
create index lead_notes_lead_id_idx on public.lead_notes (lead_id);

create table public.follow_ups (
  id           uuid primary key default gen_random_uuid(),
  lead_id      uuid not null references public.leads(id),
  assigned_to  uuid not null references public.profiles(id),
  due_at       timestamptz not null,
  note         text,
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);
create index follow_ups_assigned_due_idx on public.follow_ups (assigned_to, due_at) where completed_at is null;
create index follow_ups_lead_id_idx      on public.follow_ups (lead_id);
create index follow_ups_assigned_to_idx  on public.follow_ups (assigned_to);

alter table public.lead_sources        enable row level security;
alter table public.campaigns           enable row level security;
alter table public.leads               enable row level security;
alter table public.lead_touches        enable row level security;
alter table public.lead_status_history enable row level security;
alter table public.lead_notes          enable row level security;
alter table public.follow_ups          enable row level security;

-- ---------------------------------------------------------------------------
-- assignment_state keyed by scope (was: city_id primary key). Empty table, safe to replace.
-- ---------------------------------------------------------------------------
drop table public.assignment_state;
create table public.assignment_state (
  scope         text primary key,               -- 'city:<uuid>' | 'global'
  last_user_id  uuid references public.profiles(id),
  updated_at    timestamptz not null default now()
);
alter table public.assignment_state enable row level security;
create policy assignment_state_admin on public.assignment_state for select to authenticated
  using ((select public.current_role_is('super_admin')));

-- ---------------------------------------------------------------------------
-- BR-L4: auto-assignment — by city if a cc_exec covers it, else round-robin across all active
-- executives. Inactive executives are never picked. Serialised per scope by a row lock.
-- ---------------------------------------------------------------------------
create or replace function public.assign_lead(p_city_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_scope text;
  v_candidates uuid[];
  v_last uuid;
  v_next uuid;
begin
  if p_city_id is not null then
    select array_agg(p.id order by p.id) into v_candidates
    from public.profiles p
    join public.user_roles r on r.user_id = p.id and r.role = 'cc_exec'
    where p.is_active and p.city_id = p_city_id;
    v_scope := 'city:' || p_city_id;
  end if;

  if v_candidates is null then
    select array_agg(p.id order by p.id) into v_candidates
    from public.profiles p
    join public.user_roles r on r.user_id = p.id and r.role = 'cc_exec'
    where p.is_active;
    v_scope := 'global';
  end if;

  if v_candidates is null then
    return null;                                -- nobody to assign; super_admin sees it unassigned
  end if;

  insert into public.assignment_state (scope) values (v_scope) on conflict (scope) do nothing;
  select last_user_id into v_last from public.assignment_state where scope = v_scope for update;

  select c into v_next from unnest(v_candidates) c where v_last is null or c > v_last order by c limit 1;
  v_next := coalesce(v_next, v_candidates[1]);   -- wrap around

  update public.assignment_state set last_user_id = v_next, updated_at = now() where scope = v_scope;
  return v_next;
end $$;
revoke execute on function public.assign_lead(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- ingest_lead(): the ONE way a lead enters the system (web forms, webhooks worker, manual entry).
-- BR-L1 dedup · BR-L2 first-touch attribution · BR-L4 assignment · BR-L5 SLA from creation.
-- p_lead is validated by lib/validators/leads.ts; phone must already be E.164.
-- Returns {lead_id, created}.
-- ---------------------------------------------------------------------------
create or replace function public.ingest_lead(p_lead jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_claims    jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  v_caller    uuid  := nullif(v_claims ->> 'sub', '')::uuid;
  v_user_role text  := v_claims ->> 'user_role';
  v_phone     text  := p_lead ->> 'phone';
  v_source_id uuid;
  v_campaign  uuid  := nullif(p_lead ->> 'campaign_id', '')::uuid;
  v_city      uuid  := nullif(p_lead ->> 'city_id', '')::uuid;
  v_existing  uuid;
  v_previous  uuid;
  v_assignee  uuid;
  v_lead_id   uuid;
  v_sla_min   int;
begin
  -- Callers: service role (web forms, webhook worker), a direct DB session, or staff doing
  -- manual entry. Never anon, never a customer.
  if v_claims is not null
     and coalesce(v_claims ->> 'role', '') <> 'service_role'
     and coalesce(v_user_role, '') not in ('super_admin','cc_exec') then
    raise exception 'Not allowed to create leads' using errcode = '42501';
  end if;

  if v_phone is null or v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Phone must be E.164, got %', coalesce(v_phone, 'null') using errcode = '22023';
  end if;

  select id into v_source_id from public.lead_sources
  where code = p_lead ->> 'source' and is_active;
  if v_source_id is null then
    raise exception 'Unknown or inactive lead source: %', p_lead ->> 'source' using errcode = '22023';
  end if;

  -- Provider redelivery of a lead we already have → same lead, no new touch (idempotent)
  select id into v_existing from public.leads
  where (p_lead ->> 'meta_leadgen_id' is not null and meta_leadgen_id = p_lead ->> 'meta_leadgen_id')
     or (p_lead ->> 'google_lead_id'  is not null and google_lead_id  = p_lead ->> 'google_lead_id')
  limit 1;
  if v_existing is not null then
    return jsonb_build_object('lead_id', v_existing, 'created', false);
  end if;

  -- Serialise concurrent enquiries from the same number (webhook + form at the same moment)
  perform pg_advisory_xact_lock(hashtextextended('lead:' || v_phone, 0));

  -- BR-L1: an open lead with this number absorbs the enquiry as a touch
  select id into v_existing from public.leads
  where phone = v_phone and status not in ('won','lost');

  if v_existing is not null then
    insert into public.lead_touches (lead_id, source_id, campaign_id, payload)
    values (v_existing, v_source_id, v_campaign, p_lead -> 'raw_payload');
    -- Fill gaps only; never overwrite what the lead already has, never touch attribution
    update public.leads set
      name          = coalesce(name, nullif(p_lead ->> 'name', '')),
      email         = coalesce(email, nullif(p_lead ->> 'email', '')),
      city_id       = coalesce(city_id, v_city),
      property_name = coalesce(property_name, nullif(p_lead ->> 'property_name', '')),
      unit_count    = coalesce(unit_count, nullif(p_lead ->> 'unit_count', '')::int)
    where id = v_existing;
    return jsonb_build_object('lead_id', v_existing, 'created', false);
  end if;

  -- Won/lost before? Link the new lead to the most recent closed one (decision 27 Sep 2026)
  select id into v_previous from public.leads
  where phone = v_phone order by created_at desc limit 1;

  -- Manual entry: the executive who took the call keeps the lead. Everything else: BR-L4.
  if v_user_role = 'cc_exec' then
    v_assignee := v_caller;
  else
    v_assignee := public.assign_lead(v_city);
  end if;

  select (value #>> '{}')::int into v_sla_min from public.settings where key = 'sla_callback_minutes';

  insert into public.leads (
    phone, name, email, city_id, previous_lead_id,
    customer_type, property_name, unit_count, enquirer_role, firm_gstin,
    source_id, campaign_id, meta_ad_id, meta_form_id, meta_leadgen_id, google_lead_id,
    ctwa_clid, utm, raw_payload,
    assigned_to, assigned_at, sla_due_at
  ) values (
    v_phone, nullif(p_lead ->> 'name', ''), nullif(p_lead ->> 'email', ''), v_city, v_previous,
    nullif(p_lead ->> 'customer_type', ''), nullif(p_lead ->> 'property_name', ''),
    nullif(p_lead ->> 'unit_count', '')::int, nullif(p_lead ->> 'enquirer_role', ''),
    nullif(p_lead ->> 'firm_gstin', ''),
    v_source_id, v_campaign, p_lead ->> 'meta_ad_id', p_lead ->> 'meta_form_id',
    p_lead ->> 'meta_leadgen_id', p_lead ->> 'google_lead_id',
    p_lead ->> 'ctwa_clid', p_lead -> 'utm', p_lead -> 'raw_payload',
    v_assignee, case when v_assignee is not null then now() end,
    now() + make_interval(mins => coalesce(v_sla_min, 60))       -- BR-L5
  ) returning id into v_lead_id;

  insert into public.lead_touches (lead_id, source_id, campaign_id, payload)
  values (v_lead_id, v_source_id, v_campaign, p_lead -> 'raw_payload');

  return jsonb_build_object('lead_id', v_lead_id, 'created', true);
end $$;
revoke execute on function public.ingest_lead(jsonb) from public, anon;
grant execute on function public.ingest_lead(jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- BR-L3: attribution is immutable
-- ---------------------------------------------------------------------------
create or replace function public.guard_lead_attribution() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.source_id       is distinct from old.source_id
  or new.campaign_id     is distinct from old.campaign_id
  or new.meta_ad_id      is distinct from old.meta_ad_id
  or new.meta_form_id    is distinct from old.meta_form_id
  or new.meta_leadgen_id is distinct from old.meta_leadgen_id
  or new.google_lead_id  is distinct from old.google_lead_id
  or new.ctwa_clid       is distinct from old.ctwa_clid
  or new.utm             is distinct from old.utm
  or new.raw_payload     is distinct from old.raw_payload
  or new.phone           is distinct from old.phone
  or new.created_at      is distinct from old.created_at then
    raise exception 'Lead attribution fields are immutable (BR-L3)' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_lead_attribution before update on public.leads
  for each row execute function public.guard_lead_attribution();

-- ---------------------------------------------------------------------------
-- Pipeline rules on status change
--   BR-L6 (partial): survey_booked / surveyed / quoted / won are set by system functions only,
--                    never by a user's UPDATE. The survey check itself arrives with §8.
--   BR-L7: 'lost' needs a reason, and a note when the reason requires one.
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

    if new.status = 'lost' then
      select requires_note into v_requires_note from public.lost_reasons where id = new.lost_reason_id;
      if v_requires_note and coalesce(trim(new.lost_note), '') = '' then
        raise exception 'This lost reason needs a note (BR-L7)' using errcode = '23514';
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger trg_lead_status_guard before update on public.leads
  for each row execute function public.guard_lead_status();

-- BR-L8 / D2-09: every status change is in the timeline — including the lost reason, so a reopen
-- never erases why the lead was lost.
create or replace function public.log_lead_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.lead_status_history (lead_id, from_status, to_status, actor_id, note)
    values (
      new.id,
      case when tg_op = 'UPDATE' then old.status end,
      new.status,
      (select auth.uid()),
      case when new.status = 'lost' then
        (select 'Lost: ' || lr.name from public.lost_reasons lr where lr.id = new.lost_reason_id)
        || coalesce(' — ' || nullif(trim(new.lost_note), ''), '')
      end
    );
  end if;
  return null;
end $$;
create trigger trg_lead_status_log after insert or update of status on public.leads
  for each row execute function public.log_lead_status();

-- D2-04: reassignment is logged (audit_log carries actor, before and after)
create trigger trg_audit_leads after update on public.leads
  for each row when (old.assigned_to is distinct from new.assigned_to)
  execute function public.write_audit();

-- BR-L4: deactivating an executive hands their open leads to the next in turn
create or replace function public.reassign_on_deactivate() returns trigger
language plpgsql security definer set search_path = '' as $$
declare l record;
begin
  if old.is_active and not new.is_active then
    for l in select id, city_id from public.leads
             where assigned_to = new.id and status not in ('won','lost')
             order by created_at
    loop
      update public.leads
      set assigned_to = public.assign_lead(l.city_id), assigned_at = now()
      where id = l.id;
    end loop;
  end if;
  return null;
end $$;
create trigger trg_profiles_reassign after update of is_active on public.profiles
  for each row execute function public.reassign_on_deactivate();

-- ---------------------------------------------------------------------------
-- Policies (ADR-004). Leads never get an INSERT policy: ingest_lead() is the only door.
-- ---------------------------------------------------------------------------
create policy lead_sources_read_staff on public.lead_sources for select to authenticated
  using ((select public.is_staff()));
create policy lead_sources_write_admin on public.lead_sources for all to authenticated
  using ((select public.current_role_is('super_admin')))
  with check ((select public.current_role_is('super_admin')));

create policy campaigns_read on public.campaigns for select to authenticated
  using (((select auth.jwt()) ->> 'user_role') in ('super_admin','cc_exec'));
create policy campaigns_write_admin on public.campaigns for all to authenticated
  using ((select public.current_role_is('super_admin')))
  with check ((select public.current_role_is('super_admin')));

-- P3: an executive sees only their own leads; super_admin sees all. (Surveyor access to the
-- leads behind their own surveys is added with §8.)
create policy leads_select on public.leads for select to authenticated
using (
  (select public.current_role_is('super_admin'))
  or ((select public.current_role_is('cc_exec')) and assigned_to = (select auth.uid()))
);
-- An executive can work their lead but cannot hand it to someone else (WITH CHECK).
create policy leads_update on public.leads for update to authenticated
using (
  (select public.current_role_is('super_admin'))
  or ((select public.current_role_is('cc_exec')) and assigned_to = (select auth.uid()))
)
with check (
  (select public.current_role_is('super_admin'))
  or ((select public.current_role_is('cc_exec')) and assigned_to = (select auth.uid()))
);

-- Children follow the parent lead: the subquery on leads is itself filtered by leads_select.
create policy lead_touches_select on public.lead_touches for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_touches.lead_id));

create policy lead_status_history_select on public.lead_status_history for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_status_history.lead_id));

create policy lead_notes_select on public.lead_notes for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_notes.lead_id));
create policy lead_notes_insert on public.lead_notes for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.leads l where l.id = lead_notes.lead_id)
  );

create policy follow_ups_select on public.follow_ups for select to authenticated
  using ((select public.current_role_is('super_admin')) or assigned_to = (select auth.uid()));
create policy follow_ups_insert on public.follow_ups for insert to authenticated
  with check (
    ((select public.current_role_is('super_admin')) or assigned_to = (select auth.uid()))
    and exists (select 1 from public.leads l where l.id = follow_ups.lead_id)
  );
create policy follow_ups_update on public.follow_ups for update to authenticated
  using ((select public.current_role_is('super_admin')) or assigned_to = (select auth.uid()))
  with check ((select public.current_role_is('super_admin')) or assigned_to = (select auth.uid()));
