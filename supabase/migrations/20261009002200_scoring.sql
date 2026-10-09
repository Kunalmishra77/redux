-- CR-001 phase 4a (E21, D27) — lead scoring and the assessment decision. ADR-018: the rules are
-- data, evaluated in Postgres, so the website, CRM, portal and cron all get the same answer.
--   BR-SC1 score = sum of active rule points, every scoring explained in lead_scores
--   BR-SC2 tier from thresholds in settings
--   BR-SC3 a manager's tier override, with a reason, survives rescoring until cleared
--   BR-S9  assessment mode from the policy matrix (tier × distance band); executive override
--
-- Deviation (task tracker): `pincodes` is seeded at 3-digit sorting-district level (enough for a
-- 150 km band); 6-digit rows can be imported later into the same table and win over the prefix.

-- ---------------------------------------------------------------------------
-- Geography: where is the lead, and is it inside a service area?
-- ---------------------------------------------------------------------------
alter table public.cities
  add column lat numeric(9,6) check (lat between -90 and 90),
  add column lng numeric(9,6) check (lng between -180 and 180);
update public.cities c set lat = v.lat, lng = v.lng
from (values ('Delhi', 28.6139, 77.2090), ('New Delhi', 28.6139, 77.2090), ('Gurugram', 28.4595, 77.0266),
             ('Gurgaon', 28.4595, 77.0266), ('Noida', 28.5355, 77.3910), ('Faridabad', 28.4089, 77.3178),
             ('Ghaziabad', 28.6692, 77.4538), ('Jaipur', 26.9124, 75.7873)) as v(name, lat, lng)
where c.name = v.name;

create table public.pincodes (
  code     text primary key check (code ~ '^[1-9][0-9]{2}([0-9]{3})?$'),   -- 6 digits, or a 3-digit prefix
  district text not null,
  state    text not null,
  lat      numeric(9,6) not null check (lat between -90 and 90),
  lng      numeric(9,6) not null check (lng between -180 and 180)
);
insert into public.pincodes (code, district, state, lat, lng) values
  ('110', 'Delhi', 'Delhi', 28.6139, 77.2090),
  ('121', 'Faridabad', 'Haryana', 28.4089, 77.3178),
  ('122', 'Gurugram', 'Haryana', 28.4595, 77.0266),
  ('123', 'Rewari', 'Haryana', 28.1990, 76.6190),
  ('124', 'Rohtak', 'Haryana', 28.8955, 76.6066),
  ('131', 'Sonipat', 'Haryana', 28.9931, 77.0151),
  ('132', 'Panipat', 'Haryana', 29.3909, 76.9635),
  ('201', 'Noida / Ghaziabad', 'Uttar Pradesh', 28.5355, 77.3910),
  ('203', 'Bulandshahr', 'Uttar Pradesh', 28.4069, 77.8498),
  ('250', 'Meerut', 'Uttar Pradesh', 28.9845, 77.7064),
  ('282', 'Agra', 'Uttar Pradesh', 27.1767, 78.0081),
  ('281', 'Mathura', 'Uttar Pradesh', 27.4924, 77.6737),
  ('226', 'Lucknow', 'Uttar Pradesh', 26.8467, 80.9462),
  ('160', 'Chandigarh', 'Chandigarh', 30.7333, 76.7794),
  ('141', 'Ludhiana', 'Punjab', 30.9010, 75.8573),
  ('143', 'Amritsar', 'Punjab', 31.6340, 74.8723),
  ('248', 'Dehradun', 'Uttarakhand', 30.3165, 78.0322),
  ('249', 'Haridwar / Rishikesh', 'Uttarakhand', 29.9457, 78.1642),
  ('301', 'Alwar', 'Rajasthan', 27.5530, 76.6346),
  ('302', 'Jaipur', 'Rajasthan', 26.9124, 75.7873),
  ('313', 'Udaipur', 'Rajasthan', 24.5854, 73.7125),
  ('380', 'Ahmedabad', 'Gujarat', 23.0225, 72.5714),
  ('400', 'Mumbai', 'Maharashtra', 19.0760, 72.8777),
  ('411', 'Pune', 'Maharashtra', 18.5204, 73.8567),
  ('403', 'Goa', 'Goa', 15.4909, 73.8278),
  ('452', 'Indore', 'Madhya Pradesh', 22.7196, 75.8577),
  ('462', 'Bhopal', 'Madhya Pradesh', 23.2599, 77.4126),
  ('500', 'Hyderabad', 'Telangana', 17.3850, 78.4867),
  ('560', 'Bengaluru', 'Karnataka', 12.9716, 77.5946),
  ('600', 'Chennai', 'Tamil Nadu', 13.0827, 80.2707),
  ('682', 'Kochi', 'Kerala', 9.9312, 76.2673),
  ('700', 'Kolkata', 'West Bengal', 22.5726, 88.3639),
  ('800', 'Patna', 'Bihar', 25.5941, 85.1376)
on conflict (code) do nothing;

create table public.service_areas (
  id        uuid primary key default gen_random_uuid(),
  name      text not null unique,
  lat       numeric(9,6) not null check (lat between -90 and 90),
  lng       numeric(9,6) not null check (lng between -180 and 180),
  near_km   numeric(6,1) not null check (near_km > 0),
  is_active boolean not null default true
);
insert into public.service_areas (name, lat, lng, near_km) values ('Delhi hub', 28.6139, 77.2090, 150)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Rules (ADR-018)
-- ---------------------------------------------------------------------------
create table public.scoring_rules (
  id         uuid primary key default gen_random_uuid(),
  factor     text not null check (factor in ('units', 'value', 'segment', 'source', 'distance_band',
                                             'group_member', 'repeat_customer', 'referral')),
  operator   text not null check (operator in ('gte', 'between', 'in', 'is_true')),
  value      jsonb not null default 'null'::jsonb,   -- gte: 40 · between: [10,39] · in: ["hotel","hospital"]
  points     int not null check (points between -100 and 100),
  label      text not null,
  sort_order int not null default 0,
  is_active  boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint scoring_rules_value_shape check (
    (operator = 'gte' and jsonb_typeof(value) = 'number')
    or (operator = 'between' and jsonb_typeof(value) = 'array' and jsonb_array_length(value) = 2)
    or (operator = 'in' and jsonb_typeof(value) = 'array')
    or (operator = 'is_true'))
);
create trigger trg_scoring_rules_updated before update on public.scoring_rules
  for each row execute function public.set_updated_at();
create trigger trg_audit_scoring_rules after insert or update or delete on public.scoring_rules
  for each row execute function public.write_audit();

-- Seed = the client's answer (CR §9 Q5): A = 40+ rooms, ₹5 lakh+ or a hotel chain; B = 10–39 rooms
-- or ₹1–5 lakh; C below. Small bonuses can lift a borderline lead, never make a tiny one an A.
insert into public.scoring_rules (factor, operator, value, points, label, sort_order) values
  ('units',           'gte',     '40',                      40, '40+ rooms',                   10),
  ('units',           'between', '[10, 39]',                15, '10–39 rooms',                 20),
  ('value',           'gte',     '500000',                  40, 'Estimated order ₹5 lakh+',    30),
  ('value',           'between', '[100000, 499999]',        15, 'Estimated order ₹1–5 lakh',   40),
  ('group_member',    'is_true', 'null',                    40, 'Part of a hotel chain / group', 50),
  ('repeat_customer', 'is_true', 'null',                    10, 'Existing customer',           60),
  ('referral',        'is_true', 'null',                    10, 'Referred',                    70),
  ('segment',         'in',      '["hotel", "hospital"]',    5, 'Priority segment',            80);

insert into public.settings (key, value, description) values
  ('tier_thresholds',       '{"A": 40, "B": 15}', 'BR-SC2: minimum score for tier A and tier B; below B is C'),
  ('scoring_rules_version', '1',                  'ADR-018: bumped on every rule change; stored with each score')
on conflict (key) do nothing;

create or replace function public.bump_scoring_version() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.settings set value = to_jsonb(coalesce((value #>> '{}')::int, 0) + 1) where key = 'scoring_rules_version';
  return null;
end $$;
create trigger trg_scoring_rules_version after insert or update or delete on public.scoring_rules
  for each statement execute function public.bump_scoring_version();

create table public.assessment_policies (
  tier          text not null check (tier in ('A', 'B', 'C')),
  distance_band text not null check (distance_band in ('near', 'far', 'unknown')),
  mode          text not null check (mode in ('onsite', 'self', 'video')),
  demo_offer    text not null default 'none' check (demo_offer in ('room_demo', 'fitting_demo', 'none')),
  owner_role    text not null default 'cc_exec' check (owner_role in ('sales', 'cc_exec')),
  followup_days int not null default 3 check (followup_days between 0 and 90),
  note          text,
  updated_at    timestamptz not null default now(),
  primary key (tier, distance_band)
);
create trigger trg_assessment_policies_updated before update on public.assessment_policies
  for each row execute function public.set_updated_at();
create trigger trg_audit_assessment_policies after insert or update or delete on public.assessment_policies
  for each row execute function public.write_audit();
-- seed from the client's example (CR §3.4)
insert into public.assessment_policies (tier, distance_band, mode, demo_offer, owner_role, followup_days, note) values
  ('A', 'near',    'onsite', 'room_demo',    'sales',   2,  'On-site survey, dedicated sales owner'),
  ('A', 'far',     'video',  'room_demo',    'sales',   3,  'Self-assessment plus a video call'),
  ('A', 'unknown', 'onsite', 'room_demo',    'sales',   2,  'Confirm the location first'),
  ('B', 'near',    'self',   'fitting_demo', 'cc_exec', 3,  'Self-assessment; on-site on request'),
  ('B', 'far',     'self',   'fitting_demo', 'cc_exec', 5,  'Self-assessment; fitting demo shipped in'),
  ('B', 'unknown', 'self',   'fitting_demo', 'cc_exec', 3,  null),
  ('C', 'near',    'self',   'none',         'cc_exec', 7,  'Self-assessment on request; nurture'),
  ('C', 'far',     'self',   'none',         'cc_exec', 14, 'Self-assessment on request; nurture'),
  ('C', 'unknown', 'self',   'none',         'cc_exec', 7,  null)
on conflict (tier, distance_band) do nothing;

-- ---------------------------------------------------------------------------
-- Lead columns and the score history
-- ---------------------------------------------------------------------------
alter table public.leads
  add column distance_band              text check (distance_band in ('near', 'far', 'unknown')),
  add column distance_km                numeric(7,1),
  add column scored_at                  timestamptz,
  add column tier_override              text check (tier_override in ('A', 'B', 'C')),
  add column tier_override_reason       text,
  add column assessment_override_reason text,
  add column assessment_decided_at      timestamptz,
  add constraint leads_demo_offer_known check (demo_offer is null or demo_offer in ('room_demo', 'fitting_demo', 'none')),
  add constraint leads_tier_override_reason check (tier_override is null or length(trim(tier_override_reason)) > 0);
create trigger trg_audit_lead_overrides after update of tier_override, assessment_override_reason on public.leads
  for each row execute function public.write_audit();

create table public.lead_scores (
  id              uuid primary key default gen_random_uuid(),
  lead_id         uuid not null references public.leads(id),
  score           int not null,
  computed_tier   text not null check (computed_tier in ('A', 'B', 'C')),
  tier            text not null check (tier in ('A', 'B', 'C')),
  breakdown       jsonb not null,
  inputs          jsonb not null,
  rules_version   int not null,
  distance_band   text not null,
  scored_by       uuid references public.profiles(id),     -- null = the system
  override_reason text,
  created_at      timestamptz not null default clock_timestamp()   -- ordered even within one transaction
);
create index lead_scores_lead_idx on public.lead_scores (lead_id, created_at desc);
create trigger trg_lead_scores_append_only before update or delete on public.lead_scores
  for each row execute function public.forbid_change();

-- ---------------------------------------------------------------------------
-- The engine
-- ---------------------------------------------------------------------------
-- distance from the nearest active service area; band near / far / unknown
create or replace function public.locate(p_pincode text, p_city uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with pt as (
    select coalesce(
      (select jsonb_build_object('lat', lat, 'lng', lng) from public.pincodes where code = p_pincode),
      (select jsonb_build_object('lat', lat, 'lng', lng) from public.pincodes where code = left(p_pincode, 3)),
      (select jsonb_build_object('lat', lat, 'lng', lng) from public.cities where id = p_city and lat is not null)) as p
  ), d as (
    select min(public.distance_m((pt.p ->> 'lat')::numeric, (pt.p ->> 'lng')::numeric, a.lat, a.lng) / 1000) as km,
           bool_or(public.distance_m((pt.p ->> 'lat')::numeric, (pt.p ->> 'lng')::numeric, a.lat, a.lng) / 1000 <= a.near_km) as near
    from pt, public.service_areas a where a.is_active and pt.p is not null
  )
  select case when d.km is null then jsonb_build_object('band', 'unknown', 'km', null)
              else jsonb_build_object('band', case when d.near then 'near' else 'far' end, 'km', round(d.km, 1)) end
  from d;
$$;

-- Pure evaluation of the active rules against a set of inputs — used for real scoring and for the
-- admin "test a lead" preview, so the two can never disagree.
--   p: {units, value, segment, source, distance_band, group_member, repeat_customer, referral}
create or replace function public.evaluate_score(p jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  r       public.scoring_rules%rowtype;
  v_in    jsonb;
  v_hit   boolean;
  v_score int := 0;
  v_rows  jsonb := '[]'::jsonb;
  v_thr   jsonb := coalesce((select value from public.settings where key = 'tier_thresholds'), '{"A":40,"B":15}');
begin
  for r in select * from public.scoring_rules where is_active order by sort_order, label loop
    v_in := p -> r.factor;
    v_hit := case r.operator
      when 'gte'     then jsonb_typeof(v_in) = 'number' and (v_in #>> '{}')::numeric >= (r.value #>> '{}')::numeric
      when 'between' then jsonb_typeof(v_in) = 'number' and (v_in #>> '{}')::numeric between (r.value ->> 0)::numeric and (r.value ->> 1)::numeric
      when 'in'      then v_in is not null and jsonb_typeof(v_in) = 'string' and r.value ? (v_in #>> '{}')
      when 'is_true' then coalesce((v_in #>> '{}')::boolean, false)
    end;
    if coalesce(v_hit, false) then
      v_score := v_score + r.points;
      v_rows := v_rows || jsonb_build_object('rule_id', r.id, 'label', r.label, 'points', r.points);
    end if;
  end loop;
  return jsonb_build_object('score', v_score, 'breakdown', v_rows,
    'tier', case when v_score >= (v_thr ->> 'A')::int then 'A' when v_score >= (v_thr ->> 'B')::int then 'B' else 'C' end);
end $$;
revoke execute on function public.evaluate_score(jsonb) from public, anon;
grant execute on function public.evaluate_score(jsonb) to authenticated;

-- BR-S9: the policy for the lead's tier and band, unless an executive has overridden it
create or replace function public._decide_assessment(p_lead uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_pol public.assessment_policies%rowtype; l public.leads%rowtype;
begin
  select * into l from public.leads where id = p_lead;
  if l.assessment_override_reason is not null or l.tier is null then return; end if;
  select * into v_pol from public.assessment_policies where tier = l.tier and distance_band = coalesce(l.distance_band, 'unknown');
  if not found then return; end if;
  update public.leads set assessment_mode = v_pol.mode, demo_offer = v_pol.demo_offer, assessment_decided_at = now()
  where id = p_lead and (assessment_mode is distinct from v_pol.mode or demo_offer is distinct from v_pol.demo_offer);
end $$;
revoke execute on function public._decide_assessment(uuid) from public, anon, authenticated;

-- BR-SC1…SC3: score one lead. Writes lead_scores only when something changed (or when forced by a
-- person), so the nightly rescore does not bury the history.
create or replace function public._score_lead(p_lead uuid, p_actor uuid default null, p_force boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  l       public.leads%rowtype;
  c       public.customers%rowtype;
  v_loc   jsonb;
  v_in    jsonb;
  v_res   jsonb;
  v_tier  text;
  v_last  public.lead_scores%rowtype;
begin
  select * into l from public.leads where id = p_lead;
  if not found then raise exception 'Lead not found' using errcode = 'P0002'; end if;
  if l.customer_id is not null then select * into c from public.customers where id = l.customer_id; end if;
  v_loc := public.locate(l.pincode, l.city_id);
  v_in := jsonb_build_object(
    'units', coalesce(l.estimated_units, l.unit_count, c.size_units),
    'value', l.estimated_value,
    'segment', (select code from public.segments where id = coalesce(l.segment_id, c.segment_id)),
    'source', (select code from public.lead_sources where id = l.source_id),
    'distance_band', v_loc ->> 'band',
    'group_member', c.group_id is not null,
    'repeat_customer', c.id is not null and not c.is_prospect and c.converted_at is not null and c.converted_at < l.created_at,
    'referral', length(trim(coalesce(l.raw_payload ->> 'referred_by', ''))) > 0);
  v_res := public.evaluate_score(v_in);
  v_tier := coalesce(l.tier_override, v_res ->> 'tier');

  select * into v_last from public.lead_scores where lead_id = p_lead order by created_at desc limit 1;
  if p_force or v_last.id is null or v_last.score <> (v_res ->> 'score')::int or v_last.tier <> v_tier
     or v_last.distance_band <> (v_loc ->> 'band') or v_last.override_reason is distinct from l.tier_override_reason then
    insert into public.lead_scores (lead_id, score, computed_tier, tier, breakdown, inputs, rules_version, distance_band, scored_by, override_reason)
    values (p_lead, (v_res ->> 'score')::int, v_res ->> 'tier', v_tier, v_res -> 'breakdown', v_in,
            coalesce((select (value #>> '{}')::int from public.settings where key = 'scoring_rules_version'), 1),
            v_loc ->> 'band', p_actor, case when l.tier_override is not null then l.tier_override_reason end);
  end if;

  update public.leads set score = (v_res ->> 'score')::int, tier = v_tier, distance_band = v_loc ->> 'band',
    distance_km = (v_loc ->> 'km')::numeric, scored_at = now()
  where id = p_lead;
  -- the account carries the tier of its latest open enquiry
  if l.customer_id is not null and l.status not in ('won', 'lost') then
    update public.customers set tier = v_tier where id = l.customer_id and tier is distinct from v_tier;
  end if;
  perform public._decide_assessment(p_lead);
  return v_res || jsonb_build_object('final_tier', v_tier, 'distance', v_loc);
end $$;
revoke execute on function public._score_lead(uuid, uuid, boolean) from public, anon, authenticated;

-- staff entry point (lead page "Rescore")
create or replace function public.score_lead(p_lead uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not ((select public.current_role_is('super_admin'))
          or ((select public.current_role_is('cc_exec')) and exists (select 1 from public.leads where id = p_lead and assigned_to = (select auth.uid())))) then
    raise exception 'Not allowed to score this lead' using errcode = '42501';
  end if;
  return public._score_lead(p_lead, (select auth.uid()), true);
end $$;
revoke execute on function public.score_lead(uuid) from public, anon;
grant execute on function public.score_lead(uuid) to authenticated;

-- every open lead, after a rule change and nightly
create or replace function public.rescore_open_leads()
returns int language plpgsql security definer set search_path = '' as $$
declare v_id uuid; n int := 0;
begin
  if not (public.is_system_caller() or (select public.current_role_is('super_admin'))) then
    raise exception 'Only the Super Admin can rescore every lead' using errcode = '42501';
  end if;
  for v_id in select id from public.leads where status not in ('won', 'lost') loop
    perform public._score_lead(v_id); n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.rescore_open_leads() from public, anon;
grant execute on function public.rescore_open_leads() to authenticated;

-- BR-SC3: a manager (Super Admin) overrides the tier with a reason; null clears it
create or replace function public.override_lead_tier(p_lead uuid, p_tier text, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not (select public.current_role_is('super_admin')) then
    raise exception 'Only a manager can override a tier' using errcode = '42501';
  end if;
  if p_tier is not null and length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Give a reason for the override' using errcode = '23514';
  end if;
  update public.leads set tier_override = p_tier, tier_override_reason = case when p_tier is null then null else trim(p_reason) end
  where id = p_lead;
  return public._score_lead(p_lead, (select auth.uid()), true);
end $$;
revoke execute on function public.override_lead_tier(uuid, text, text) from public, anon;
grant execute on function public.override_lead_tier(uuid, text, text) to authenticated;

-- BR-S9: the executive overrides the assessment mode (and demo offer) with a reason; null mode
-- clears the override and the policy decides again
create or replace function public.override_assessment(p_lead uuid, p_mode text, p_demo_offer text, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not ((select public.current_role_is('super_admin'))
          or ((select public.current_role_is('cc_exec')) and exists (select 1 from public.leads where id = p_lead and assigned_to = (select auth.uid())))) then
    raise exception 'Only the lead''s executive or the Super Admin can change this' using errcode = '42501';
  end if;
  if p_mode is null then
    update public.leads set assessment_override_reason = null where id = p_lead;
    perform public._decide_assessment(p_lead);
    return;
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Give a reason for the override' using errcode = '23514';
  end if;
  update public.leads set assessment_mode = p_mode, demo_offer = coalesce(p_demo_offer, demo_offer),
    assessment_override_reason = trim(p_reason), assessment_decided_at = now()
  where id = p_lead;
end $$;
revoke execute on function public.override_assessment(uuid, text, text, text) from public, anon;
grant execute on function public.override_assessment(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- When to score: a new lead; a change to what the score reads; a change to its account
-- ---------------------------------------------------------------------------
create or replace function public.on_lead_scoring_input() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public._score_lead(new.id);
  return null;
end $$;
create trigger trg_lead_score_insert after insert on public.leads
  for each row execute function public.on_lead_scoring_input();
create trigger trg_lead_score_update after update of estimated_units, estimated_value, unit_count, segment_id, pincode, city_id, customer_id
  on public.leads for each row
  when (old.estimated_units is distinct from new.estimated_units or old.estimated_value is distinct from new.estimated_value
        or old.unit_count is distinct from new.unit_count or old.segment_id is distinct from new.segment_id
        or old.pincode is distinct from new.pincode or old.city_id is distinct from new.city_id
        or old.customer_id is distinct from new.customer_id)
  execute function public.on_lead_scoring_input();

create or replace function public.on_account_scoring_input() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  for v_id in select id from public.leads where customer_id = new.id and status not in ('won', 'lost') loop
    perform public._score_lead(v_id);
  end loop;
  return null;
end $$;
create trigger trg_account_score_update after update of group_id, size_units, segment_id, is_prospect on public.customers
  for each row
  when (old.group_id is distinct from new.group_id or old.size_units is distinct from new.size_units
        or old.segment_id is distinct from new.segment_id or old.is_prospect is distinct from new.is_prospect)
  execute function public.on_account_scoring_input();

-- nightly rescore joins the schedules (installed with the queue worker)
create or replace function public.install_schedules()
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform cron.schedule('meta_lead_reconcile', '*/15 * * * *', 'select public.enqueue_meta_reconcile()');
  perform cron.schedule('sla_sweep',           '*/5 * * * *',  'select public.sweep_sla()');
  perform cron.schedule('job_delay_sweep',     '0 * * * *',    'select public.sweep_job_delays()');
  perform cron.schedule('integration_health',  '*/30 * * * *', 'select public.check_integration_health()');
  perform cron.schedule('quote_expiry',        '30 3 * * *',   'select public.expire_quotes()');     -- 09:00 IST
  perform cron.schedule('lead_rescore',        '30 21 * * *',  'select public.rescore_open_leads()'); -- 03:00 IST
end $$;
revoke execute on function public.install_schedules() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Policies (ADR-004): masters readable by staff, written by the Super Admin; the score history is
-- staff-only and follows the lead's own visibility.
-- ---------------------------------------------------------------------------
alter table public.pincodes            enable row level security;
alter table public.service_areas       enable row level security;
alter table public.scoring_rules       enable row level security;
alter table public.assessment_policies enable row level security;
alter table public.lead_scores         enable row level security;

create policy pincodes_read on public.pincodes for select to authenticated using ((select public.is_staff()));
create policy pincodes_write on public.pincodes for all to authenticated
  using ((select public.current_role_is('super_admin'))) with check ((select public.current_role_is('super_admin')));
create policy service_areas_read on public.service_areas for select to authenticated using ((select public.is_staff()));
create policy service_areas_write on public.service_areas for all to authenticated
  using ((select public.current_role_is('super_admin'))) with check ((select public.current_role_is('super_admin')));
create policy scoring_rules_read on public.scoring_rules for select to authenticated using ((select public.is_staff()));
create policy scoring_rules_write on public.scoring_rules for all to authenticated
  using ((select public.current_role_is('super_admin'))) with check ((select public.current_role_is('super_admin')));
create policy assessment_policies_read on public.assessment_policies for select to authenticated using ((select public.is_staff()));
create policy assessment_policies_write on public.assessment_policies for all to authenticated
  using ((select public.current_role_is('super_admin'))) with check ((select public.current_role_is('super_admin')));
create policy lead_scores_select on public.lead_scores for select to authenticated
  using ((select public.is_staff()) and exists (select 1 from public.leads l where l.id = lead_scores.lead_id));

-- score every existing lead once (system context: no actor)
do $$ declare v_id uuid; begin
  for v_id in select id from public.leads loop perform public._score_lead(v_id); end loop;
end $$;
