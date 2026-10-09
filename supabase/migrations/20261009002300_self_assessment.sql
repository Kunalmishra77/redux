-- CR-001 phase 4b (E21, D27) — self-assessment as a survey mode (ADR-015).
--   BR-S10 the customer writes fittings and all four photo slots on their own open self-survey only;
--          submission locks it; a staff reviewer prices it with the same upsert_assessment
--   BR-S11 turnaround SLA (24 h) from submission to report + quotation; a breach alerts the team
--
-- Who prices: the Super Admin, or a surveyor named as the survey's reviewer. Care executives do not
-- see prices (roles: pricing only on a quote), so they cannot be reviewers.
-- Customer writes go through SECURITY DEFINER functions that check the account and the survey state
-- explicitly, rather than through new customer write policies on fittings/photos (deviation from the
-- ADR-015 wording "through RLS": same guarantee, one place to read it).

insert into public.settings (key, value, description) values
  ('self_assessment_sla_hours',    '24', 'BR-S11: hours from a submitted self-assessment to its report and quotation'),
  ('self_assessment_window_days',  '14', 'How long a customer has to complete a self-assessment once started'),
  ('self_photo_slots_required',    '4',  'BR-S10 / Q7: photo slots required per fitting in a self-assessment')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- surveys gain a mode
-- ---------------------------------------------------------------------------
alter table public.surveys
  add column mode           text not null default 'onsite' check (mode in ('onsite', 'self', 'video')),
  add column reviewer_id    uuid references public.profiles(id),
  add column review_status  text check (review_status in ('awaiting', 'needs_info', 'priced')),
  add column info_request   text,
  add column review_due_at  timestamptz,
  add column sla_alerted_at timestamptz,
  alter column surveyor_id drop not null,
  add constraint surveys_onsite_has_surveyor check (mode <> 'onsite' or surveyor_id is not null);
create index surveys_reviewer_id_idx on public.surveys (reviewer_id);
create index surveys_review_queue_idx on public.surveys (review_due_at) where mode <> 'onsite' and review_status = 'awaiting';

-- the reviewer (a surveyor) sees the survey, its lead, its assessments and its quotation
create or replace function public.is_my_survey_lead(p_lead_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.surveys s
                 where s.lead_id = p_lead_id and (select auth.uid()) in (s.surveyor_id, s.reviewer_id));
$$;

drop policy surveys_select on public.surveys;
create policy surveys_select on public.surveys for select to authenticated
using (
  (select public.current_role_is('super_admin'))
  or ((select public.current_role_is('surveyor')) and (surveyor_id = (select auth.uid()) or reviewer_id = (select auth.uid())))
  or ((select public.current_role_is('cc_exec'))
      and exists (select 1 from public.leads l where l.id = surveys.lead_id))
);

drop policy assessments_select on public.assessments;
create policy assessments_select on public.assessments for select to authenticated
using (
  (select public.current_role_is('super_admin'))
  or ((select public.current_role_is('surveyor'))
      and exists (select 1 from public.fittings f join public.surveys s on s.id = f.survey_id
                  where f.id = assessments.fitting_id and (select auth.uid()) in (s.surveyor_id, s.reviewer_id)))
);

drop policy quotations_select on public.quotations;
create policy quotations_select on public.quotations for select to authenticated
using (
  (select public.current_role_is('super_admin'))
  or ((select public.current_role_is('surveyor'))
      and exists (select 1 from public.surveys s where s.id = quotations.survey_id and (select auth.uid()) in (s.surveyor_id, s.reviewer_id)))
  or ((select public.current_role_is('cc_exec'))
      and exists (select 1 from public.leads l where l.id = quotations.lead_id))
  or (status not in ('draft','pending_approval')
      and customer_id = any ((select public.my_customer_ids())::uuid[]))
);

create or replace function public.can_edit_quote(p_quote uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt()) ->> 'user_role', '') = 'super_admin'
      or exists (select 1 from public.quotations q join public.surveys s on s.id = q.survey_id
                 where q.id = p_quote and ((select auth.uid()) = s.surveyor_id or (select auth.uid()) = s.reviewer_id));
$$;

-- ---------------------------------------------------------------------------
-- Pricing and quoting accept the reviewer (bodies unchanged otherwise)
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
  select f.id, f.fitting_type_id, f.current_finish_id, s.surveyor_id, s.reviewer_id, s.status, s.mode, s.id as survey_id
  into v_fitting
  from public.fittings f join public.surveys s on s.id = f.survey_id
  where f.id = (p ->> 'fitting_id')::uuid;
  if v_fitting.id is null then
    raise exception 'Fitting not found' using errcode = 'P0002';
  end if;
  if not coalesce(v_role = 'super_admin'
          or (v_role = 'surveyor' and v_fitting.surveyor_id = v_caller
              and v_fitting.status in ('checked_in','in_progress','submitted'))
          or (v_role = 'surveyor' and v_fitting.reviewer_id = v_caller and v_fitting.status = 'submitted'), false) then
    raise exception 'Only the assigned surveyor or reviewer assesses this fitting' using errcode = '42501';
  end if;
  -- BR-S10: a self-assessment is priced only once the customer has submitted it
  if v_fitting.mode <> 'onsite' and v_fitting.status <> 'submitted' then
    raise exception 'The customer has not submitted this self-assessment yet' using errcode = '22023';
  end if;

  select id into v_card from public.rate_cards where is_active;
  if v_card is null then
    raise exception 'No active rate card — REDUX''s prices have not been loaded (D9)' using errcode = '55000';
  end if;

  v_price_rec := case when v_rec = 'no_action' then 0
                      else public.rate_card_price(v_card, v_fitting.fitting_type_id, v_rec::text,
                                                  coalesce(v_finish, v_fitting.current_finish_id)) end;
  v_price_rep := public.rate_card_price(v_card, v_fitting.fitting_type_id, 'replace_eurobrass',
                                        coalesce(v_finish, v_fitting.current_finish_id));
  v_price_mkt := public.market_price(v_card, v_fitting.fitting_type_id,
                                     coalesce(v_finish, v_fitting.current_finish_id));

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

  -- the first person to price a self-assessment becomes its reviewer
  if v_fitting.mode <> 'onsite' then
    update public.surveys set reviewer_id = coalesce(reviewer_id, v_caller) where id = v_fitting.survey_id;
  end if;
  return v_id;
end $$;
revoke execute on function public.upsert_assessment(jsonb) from public, anon;
grant execute on function public.upsert_assessment(jsonb) to authenticated;

create or replace function public.create_quote_from_survey(p_survey uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  s        public.surveys%rowtype;
  v_card   uuid;
  v_cards  int;
  v_q      uuid;
  v_missing int;
begin
  select * into s from public.surveys where id = p_survey;
  if not found then raise exception 'Survey not found' using errcode = 'P0002'; end if;
  if not (coalesce((select auth.jwt()) ->> 'user_role', '') = 'super_admin'
          or coalesce((select auth.uid()) = s.surveyor_id, false) or coalesce((select auth.uid()) = s.reviewer_id, false)) then
    raise exception 'Only the surveyor or reviewer of this assessment can quote it' using errcode = '42501';
  end if;
  if s.status <> 'submitted' then
    raise exception 'Submit the survey before quoting it' using errcode = '22023';
  end if;

  select count(*) into v_missing from public.fittings f
  where f.survey_id = p_survey and not exists (select 1 from public.assessments a where a.fitting_id = f.id);
  if v_missing > 0 then
    raise exception '% fitting(s) have no recommendation yet (BR-A1)', v_missing using errcode = '23514';
  end if;

  select count(distinct a.rate_card_id), min(a.rate_card_id::text)::uuid into v_cards, v_card
  from public.assessments a join public.fittings f on f.id = a.fitting_id where f.survey_id = p_survey;
  if v_cards <> 1 then
    raise exception 'Fittings were priced on different rate-card versions; re-price the survey first (BR-A3)'
      using errcode = '23514';
  end if;

  insert into public.quotations (quote_no, survey_id, lead_id, customer_id, property_id, rate_card_id, created_by)
  select 'Q-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY') || '-' || lpad(nextval('public.quote_no_seq')::text, 4, '0'),
         s.id, s.lead_id, p.customer_id, s.property_id, v_card, (select auth.uid())
  from public.properties p where p.id = s.property_id
  returning id into v_q;

  insert into public.quotation_lines (quotation_id, fitting_id, assessment_id, unit_label, description,
    work_type_id, finish_id, unit_price, line_total, price_replace_eurobrass, market_price, gst_rate, hsn_sac, sort_order)
  select v_q, f.id, a.id, coalesce(pu.label, f.unit_label),
         ft.name || ' — ' || w.name || coalesce(' (' || fi.name || ')', ''),
         w.id, a.finish_id, a.price_recommended, a.price_recommended, a.price_replace_eurobrass,
         a.price_market_replacement,
         coalesce(i.gst_rate, 18.00), i.hsn_sac,
         row_number() over (order by coalesce(pu.label, f.unit_label), ft.sort_order, f.captured_at)
  from public.fittings f
  join public.assessments a on a.fitting_id = f.id and a.recommended <> 'no_action'
  join public.fitting_types ft on ft.id = f.fitting_type_id
  join public.work_types w on w.code = a.recommended::text
  left join public.finishes fi on fi.id = a.finish_id
  left join public.property_units pu on pu.id = f.property_unit_id
  left join lateral (
    select ri.gst_rate, ri.hsn_sac from public.rate_card_items ri
    where ri.rate_card_id = a.rate_card_id and ri.fitting_type_id = f.fitting_type_id and ri.work_type_id = w.id
      and (ri.finish_id = coalesce(a.finish_id, f.current_finish_id) or ri.finish_id is null)
    order by (ri.finish_id is null) limit 1
  ) i on true
  where f.survey_id = p_survey;

  if not exists (select 1 from public.quotation_lines where quotation_id = v_q) then
    raise exception 'Every fitting is "no action" — there is nothing to quote' using errcode = '23514';
  end if;

  perform public.recompute_quote(v_q);
  -- BR-S11: a quotation closes the self-assessment review
  if s.mode <> 'onsite' then
    update public.surveys set review_status = 'priced', reviewer_id = coalesce(reviewer_id, (select auth.uid())) where id = p_survey;
  end if;
  return v_q;
end $$;
revoke execute on function public.create_quote_from_survey(uuid) from public, anon;
grant execute on function public.create_quote_from_survey(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Messages
-- ---------------------------------------------------------------------------
insert into public.notification_rules (code, trigger_event, template_code, channel, category, audience, is_active, quiet_hours) values
  ('CN20', 'self_assessment_started',   'self_assessment_link',     'whatsapp', 'utility', 'customer',     true,  true),
  ('CN21', 'self_assessment_submitted', 'self_assessment_received', 'whatsapp', 'utility', 'customer',     true,  true),
  ('CN22', 'self_assessment_needs_info','self_assessment_more_info','whatsapp', 'utility', 'customer',     true,  true),
  ('TN17', 'self_assessment_submitted', null,                       'in_app',   null,      'admin_and_cc', true,  false),
  ('TN18', 'self_assessment_sla_breach', null,                      'in_app',   null,      'admin',        true,  false)
on conflict (code) do nothing;

insert into public.message_templates (code, channel, category, language, body, variables, is_active) values
  ('self_assessment_link', 'whatsapp', 'utility', 'en',
   E'Hello {{1}},\n\nYour REDUX self-assessment for {{2}} is ready. For each tap, mixer or shower, add four photos (front, side, top and a close-up) and a few details.\n\nOpen it here: {{3}}\n\nIt stays open until {{4}}.',
   '["name","property","link","until"]'::jsonb, true),
  ('self_assessment_received', 'whatsapp', 'utility', 'en',
   E'Hello {{1}},\n\nWe have received your self-assessment for {{2}} with {{3}} fittings. Your assessment report and proposal will be ready within {{4}} hours.',
   '["name","property","fittings","hours"]'::jsonb, true),
  ('self_assessment_more_info', 'whatsapp', 'utility', 'en',
   E'Hello {{1}},\n\nTo finish the assessment for {{2}} we need a little more:\n{{3}}\n\nAdd it here: {{4}}',
   '["name","property","request","link"]'::jsonb, true)
on conflict (code) do nothing;

create or replace function public.portal_url(p_path text)
returns text language sql stable set search_path = '' as $$
  select coalesce((select value #>> '{}' from public.settings where key = 'portal_base_url'), 'https://my.reduxbath.com') || p_path;
$$;
insert into public.settings (key, value, description) values
  ('portal_base_url', '"https://my.reduxbath.com"', 'Base URL used in customer messages that link into the portal')
on conflict (key) do nothing;

-- On insert: an on-site booking keeps CN2/TN6 (unchanged); a self-assessment sends its link (CN20).
create or replace function public.on_survey_booked() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_phone text; v_name text; v_surveyor text; v_property text;
begin
  select phone, name into v_phone, v_name from public.leads where id = new.lead_id;
  if new.mode <> 'onsite' then
    select name into v_property from public.properties where id = new.property_id;
    perform public.notify_customer('CN20', v_phone, new.lead_id, null, 'surveys', new.id,
      jsonb_build_object('name', coalesce(v_name, 'there'), 'property', v_property,
                         'link', public.portal_url('/portal/self-assessment/' || new.id),
                         'until', to_char(new.slot_end_at at time zone 'Asia/Kolkata', 'DD Mon YYYY')),
      'CN20:' || new.id);
    return null;
  end if;
  select full_name into v_surveyor from public.profiles where id = new.surveyor_id;
  perform public.notify_customer('CN2', v_phone, new.lead_id, null, 'surveys', new.id,
    jsonb_build_object('date', to_char(new.scheduled_at at time zone 'Asia/Kolkata', 'DD Mon YYYY'),
                       'slot', to_char(new.scheduled_at at time zone 'Asia/Kolkata', 'HH24:MI') || '–' ||
                               to_char(new.slot_end_at at time zone 'Asia/Kolkata', 'HH24:MI'),
                       'surveyor', v_surveyor),
    'CN2:' || new.id);
  perform public.notify_team('TN6', 'New survey booked', to_char(new.scheduled_at at time zone 'Asia/Kolkata', 'DD Mon HH24:MI'),
                             'surveys', new.id, 'TN6:' || new.id, new.surveyor_id);
  if new.lead_id is not null then
    perform public.enqueue_capi('survey_booked', new.lead_id);
  end if;
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- The customer side
-- ---------------------------------------------------------------------------
-- may the caller (a portal contact) write to this self-survey?
create or replace function public._my_open_self_survey(p_survey uuid)
returns public.surveys language plpgsql stable security definer set search_path = '' as $$
declare s public.surveys%rowtype;
begin
  select sv.* into s from public.surveys sv join public.properties p on p.id = sv.property_id
  where sv.id = p_survey and p.customer_id = any (public.my_customer_ids());
  if not found then
    raise exception 'This self-assessment is not on your account' using errcode = '42501';
  end if;
  if s.mode = 'onsite' then
    raise exception 'This assessment is done by our surveyor' using errcode = '42501';
  end if;
  if s.status not in ('scheduled', 'in_progress') then
    raise exception 'This self-assessment has been submitted and can no longer be changed (BR-S10)' using errcode = '22023';
  end if;
  return s;
end $$;
revoke execute on function public._my_open_self_survey(uuid) from public, anon, authenticated;

-- Start (or return the open) self-assessment for a lead. Staff: the lead's executive or the Super
-- Admin. Customer: a contact of the lead's account.
create or replace function public.start_self_assessment(p_lead uuid, p_mode text default 'self')
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  l          public.leads%rowtype;
  v_role     text := coalesce((select auth.jwt()) ->> 'user_role', '');
  v_caller   uuid := (select auth.uid());
  v_property uuid;
  v_id       uuid;
  v_days     int := coalesce((select (value #>> '{}')::int from public.settings where key = 'self_assessment_window_days'), 14);
begin
  if p_mode not in ('self', 'video') then raise exception 'Mode must be self or video' using errcode = '22023'; end if;
  select * into l from public.leads where id = p_lead;
  if not found then raise exception 'Lead not found' using errcode = 'P0002'; end if;

  if v_role = 'customer' then
    if l.customer_id is null or not (l.customer_id = any (public.my_customer_ids())) then
      raise exception 'This enquiry is not on your account' using errcode = '42501';
    end if;
  elsif not (v_role = 'super_admin' or (v_role = 'cc_exec' and l.assigned_to = v_caller)) then
    raise exception 'Only the lead''s executive or the Super Admin can start this' using errcode = '42501';
  end if;

  select s.id into v_id from public.surveys s where s.lead_id = p_lead and s.mode <> 'onsite' and s.status in ('scheduled', 'in_progress', 'submitted') limit 1;
  if v_id is not null then return v_id; end if;

  if v_role = 'customer' then
    select id into v_property from public.properties where customer_id = l.customer_id order by created_at limit 1;
    if v_property is null then
      insert into public.properties (customer_id, name, address, city_id)
      select c.id, c.name, coalesce(nullif(c.billing_address, ''), 'Address to be confirmed'), l.city_id
      from public.customers c where c.id = l.customer_id
      returning id into v_property;
    end if;
  else
    v_property := (public.ensure_prospect(p_lead, '{}'::jsonb) ->> 'property_id')::uuid;
  end if;

  insert into public.surveys (lead_id, property_id, booked_by, scheduled_at, slot_end_at, mode)
  values (p_lead, v_property, case when v_role = 'customer' then null else v_caller end, now(), now() + make_interval(days => v_days), p_mode)
  returning id into v_id;
  if l.status in ('new', 'contacted') then
    update public.leads set status = 'survey_booked' where id = p_lead;   -- BR-L6: a live survey exists
  end if;
  return v_id;
end $$;
revoke execute on function public.start_self_assessment(uuid, text) from public, anon;
grant execute on function public.start_self_assessment(uuid, text) to authenticated;

-- one fitting, written by the customer (BR-S10). p: {unit_label, fitting_type_id, brand_id?,
-- current_finish_id?, model?, notes?, condition_ids?: uuid[], idem_key?}
create or replace function public.self_assessment_save_fitting(p_survey uuid, p jsonb, p_fitting uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare s public.surveys%rowtype; v_id uuid := p_fitting;
begin
  s := public._my_open_self_survey(p_survey);
  if length(trim(coalesce(p ->> 'unit_label', ''))) = 0 then
    raise exception 'Say which room or bathroom this fitting is in' using errcode = '23514';
  end if;
  if v_id is null then
    insert into public.fittings (survey_id, unit_label, fitting_type_id, brand_id, current_finish_id, model, notes, idem_key, captured_at)
    values (p_survey, trim(p ->> 'unit_label'), (p ->> 'fitting_type_id')::uuid, nullif(p ->> 'brand_id', '')::uuid,
            nullif(p ->> 'current_finish_id', '')::uuid, nullif(trim(p ->> 'model'), ''), nullif(trim(p ->> 'notes'), ''),
            coalesce(nullif(p ->> 'idem_key', ''), gen_random_uuid()::text), now())
    on conflict (idem_key) do update set unit_label = excluded.unit_label
    returning id into v_id;
  else
    update public.fittings set unit_label = trim(p ->> 'unit_label'), fitting_type_id = (p ->> 'fitting_type_id')::uuid,
      brand_id = nullif(p ->> 'brand_id', '')::uuid, current_finish_id = nullif(p ->> 'current_finish_id', '')::uuid,
      model = nullif(trim(p ->> 'model'), ''), notes = nullif(trim(p ->> 'notes'), '')
    where id = v_id and survey_id = p_survey;
    if not found then raise exception 'Fitting not found on this self-assessment' using errcode = 'P0002'; end if;
  end if;
  if jsonb_typeof(p -> 'condition_ids') = 'array' then
    delete from public.fitting_conditions where fitting_id = v_id;
    insert into public.fitting_conditions (fitting_id, condition_flag_id)
    select v_id, x::uuid from jsonb_array_elements_text(p -> 'condition_ids') x on conflict do nothing;
  end if;
  update public.surveys set status = 'in_progress' where id = p_survey and status = 'scheduled';
  return v_id;
end $$;
revoke execute on function public.self_assessment_save_fitting(uuid, jsonb, uuid) from public, anon;
grant execute on function public.self_assessment_save_fitting(uuid, jsonb, uuid) to authenticated;

-- a fitting added by mistake can be removed while it has no photos (photos are never deleted, rule 8/9)
create or replace function public.self_assessment_remove_fitting(p_fitting uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_survey uuid;
begin
  select survey_id into v_survey from public.fittings where id = p_fitting;
  if v_survey is null then raise exception 'Fitting not found' using errcode = 'P0002'; end if;
  perform public._my_open_self_survey(v_survey);
  if exists (select 1 from public.fitting_photos where fitting_id = p_fitting) then
    raise exception 'This fitting already has photos; tell us in its notes instead and we will skip it' using errcode = '23514';
  end if;
  delete from public.fitting_conditions where fitting_id = p_fitting;
  delete from public.fittings where id = p_fitting;
end $$;
revoke execute on function public.self_assessment_remove_fitting(uuid) from public, anon;
grant execute on function public.self_assessment_remove_fitting(uuid) to authenticated;

-- the storage path the server will upload a customer photo to; checks before the upload happens
create or replace function public.self_assessment_photo_path(p_fitting uuid, p_slot text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_survey uuid;
begin
  if p_slot not in ('front', 'side', 'top', 'close_up') then raise exception 'Unknown photo slot' using errcode = '22023'; end if;
  select survey_id into v_survey from public.fittings where id = p_fitting;
  if v_survey is null then raise exception 'Fitting not found' using errcode = 'P0002'; end if;
  perform public._my_open_self_survey(v_survey);
  return 'surveys/' || v_survey || '/' || p_fitting || '/' || p_slot || '/';
end $$;
revoke execute on function public.self_assessment_photo_path(uuid, text) from public, anon;
grant execute on function public.self_assessment_photo_path(uuid, text) to authenticated;

-- record a photo the server has uploaded (insert-only; a retake adds a newer row for the slot)
create or replace function public.self_assessment_add_photo(p_fitting uuid, p_slot text, p_path text, p_sha256 text,
                                                            p_bytes int, p_width int, p_height int)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_prefix text; v_id uuid;
begin
  v_prefix := public.self_assessment_photo_path(p_fitting, p_slot);
  if p_path <> v_prefix || p_sha256 || '.jpg' then
    raise exception 'Photo path does not match this fitting and slot' using errcode = '22023';
  end if;
  insert into public.fitting_photos (fitting_id, slot, storage_path, sha256, bytes, width, height, captured_at)
  values (p_fitting, p_slot, p_path, p_sha256, p_bytes, p_width, p_height, now())
  on conflict (fitting_id, slot, sha256) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.fitting_photos where fitting_id = p_fitting and slot = p_slot and sha256 = p_sha256;
  end if;
  return v_id;
end $$;
revoke execute on function public.self_assessment_add_photo(uuid, text, text, text, int, int, int) from public, anon;
grant execute on function public.self_assessment_add_photo(uuid, text, text, text, int, int, int) to authenticated;

-- BR-S10 + BR-S11: submit — every fitting has the required slots; locks; starts the 24 h clock
create or replace function public.submit_self_assessment(p_survey uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  s         public.surveys%rowtype;
  v_need    int := coalesce((select (value #>> '{}')::int from public.settings where key = 'self_photo_slots_required'), 4);
  v_hours   int := coalesce((select (value #>> '{}')::int from public.settings where key = 'self_assessment_sla_hours'), 24);
  v_missing int;
  v_count   int;
  v_lead    public.leads%rowtype;
  v_prop    text;
begin
  s := public._my_open_self_survey(p_survey);
  select count(*) into v_count from public.fittings where survey_id = p_survey;
  if v_count = 0 then
    raise exception 'Add at least one fitting' using errcode = '23514';
  end if;
  select count(*) into v_missing from public.fittings f
  where f.survey_id = p_survey and (select count(distinct slot) from public.fitting_photos p where p.fitting_id = f.id) < v_need;
  if v_missing > 0 then
    raise exception '% fitting(s) still need all % photos', v_missing, v_need using errcode = '23514';
  end if;

  update public.surveys set status = 'submitted', submitted_at = now(), review_status = 'awaiting',
    review_due_at = now() + make_interval(hours => v_hours), info_request = null, sla_alerted_at = null
  where id = p_survey;

  select * into v_lead from public.leads where id = s.lead_id;
  select name into v_prop from public.properties where id = s.property_id;
  if v_lead.id is not null then
    update public.leads set status = 'surveyed' where id = v_lead.id and status = 'survey_booked';
  end if;
  perform public.notify_customer('CN21', v_lead.phone, v_lead.id, null, 'surveys', p_survey,
    jsonb_build_object('name', coalesce(v_lead.name, 'there'), 'property', v_prop, 'fittings', v_count, 'hours', v_hours),
    'CN21:' || p_survey || ':' || extract(epoch from now())::bigint);
  perform public.notify_team('TN17', 'Self-assessment to review', coalesce(v_prop, 'A customer') || ' · ' || v_count || ' fittings',
    'surveys', p_survey, 'TN17:' || p_survey || ':' || extract(epoch from now())::bigint, v_lead.assigned_to);
end $$;
revoke execute on function public.submit_self_assessment(uuid) from public, anon;
grant execute on function public.submit_self_assessment(uuid) to authenticated;

-- the reviewer asks for more photos or details: reopens the self-assessment for the customer
create or replace function public.request_self_assessment_info(p_survey uuid, p_request text)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.surveys%rowtype; v_lead public.leads%rowtype; v_prop text;
begin
  select * into s from public.surveys where id = p_survey for update;
  if not found or s.mode = 'onsite' then raise exception 'Self-assessment not found' using errcode = 'P0002'; end if;
  if not ((select public.current_role_is('super_admin'))
          or ((select public.current_role_is('surveyor')) and s.reviewer_id = (select auth.uid()))
          or ((select public.current_role_is('cc_exec')) and exists (select 1 from public.leads l where l.id = s.lead_id and l.assigned_to = (select auth.uid())))) then
    raise exception 'Not allowed to review this self-assessment' using errcode = '42501';
  end if;
  if s.status <> 'submitted' or s.review_status = 'priced' then
    raise exception 'Only a submitted self-assessment that is not yet quoted can be reopened' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_request, ''))) < 5 then
    raise exception 'Say what is needed' using errcode = '23514';
  end if;
  update public.surveys set status = 'in_progress', review_status = 'needs_info', info_request = trim(p_request),
    review_due_at = null, slot_end_at = greatest(slot_end_at, now() + interval '3 days')
  where id = p_survey;
  select * into v_lead from public.leads where id = s.lead_id;
  select name into v_prop from public.properties where id = s.property_id;
  perform public.notify_customer('CN22', v_lead.phone, v_lead.id, null, 'surveys', p_survey,
    jsonb_build_object('name', coalesce(v_lead.name, 'there'), 'property', v_prop, 'request', trim(p_request),
                       'link', public.portal_url('/portal/self-assessment/' || p_survey)),
    'CN22:' || p_survey || ':' || extract(epoch from now())::bigint);
end $$;
revoke execute on function public.request_self_assessment_info(uuid, text) from public, anon;
grant execute on function public.request_self_assessment_info(uuid, text) to authenticated;

-- the Super Admin hands a self-assessment to a surveyor to price
create or replace function public.assign_self_assessment_reviewer(p_survey uuid, p_reviewer uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (select public.current_role_is('super_admin')) then
    raise exception 'Only the Super Admin assigns reviewers' using errcode = '42501';
  end if;
  if p_reviewer is not null and not exists (select 1 from public.user_roles where user_id = p_reviewer and role in ('surveyor', 'super_admin')) then
    raise exception 'A reviewer must be a surveyor or the Super Admin' using errcode = '22023';
  end if;
  update public.surveys set reviewer_id = p_reviewer where id = p_survey and mode <> 'onsite';
end $$;
revoke execute on function public.assign_self_assessment_reviewer(uuid, uuid) from public, anon;
grant execute on function public.assign_self_assessment_reviewer(uuid, uuid) to authenticated;

-- BR-S11: alert once when a submitted self-assessment passes its turnaround unquoted
create or replace function public.sweep_self_assessment_sla()
returns int language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0;
begin
  for r in select s.id, p.name from public.surveys s join public.properties p on p.id = s.property_id
           where s.mode <> 'onsite' and s.review_status = 'awaiting' and s.review_due_at < now() and s.sla_alerted_at is null
           for update of s skip locked loop
    perform public.notify_team('TN18', 'Self-assessment overdue', r.name || ' — report and proposal are past the turnaround',
                               'surveys', r.id, 'TN18:' || r.id);
    update public.surveys set sla_alerted_at = now() where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.sweep_self_assessment_sla() from public, anon, authenticated;

create or replace function public.install_schedules()
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform cron.schedule('meta_lead_reconcile', '*/15 * * * *', 'select public.enqueue_meta_reconcile()');
  perform cron.schedule('sla_sweep',           '*/5 * * * *',  'select public.sweep_sla()');
  perform cron.schedule('job_delay_sweep',     '0 * * * *',    'select public.sweep_job_delays()');
  perform cron.schedule('integration_health',  '*/30 * * * *', 'select public.check_integration_health()');
  perform cron.schedule('quote_expiry',        '30 3 * * *',   'select public.expire_quotes()');     -- 09:00 IST
  perform cron.schedule('lead_rescore',        '30 21 * * *',  'select public.rescore_open_leads()'); -- 03:00 IST
  perform cron.schedule('self_assessment_sla', '*/15 * * * *', 'select public.sweep_self_assessment_sla()');
end $$;
revoke execute on function public.install_schedules() from public, anon, authenticated;
