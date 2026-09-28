-- E2-S10, E16-S05, E6-S08 (DB), E14-S16 (DB, partial) · schema.sql §16 — DPDP
-- BR-P1…P6 · compliance §1 (build checklist) and §2 (call recording).
--
-- Deviations from schema.sql (task tracker → Deviations):
--   * Consent records point at the notice ROW they were shown (notice_id), not just a version
--     string; a published notice's text can never change (BR-P1). One active notice per language.
--   * Consent is per purpose, append-only; the only change ever made is withdrawn_at (BR-P2).
--   * ingest_lead_with_consent(): the lead and its consent in ONE transaction (D2-11) — a web or
--     dealer form without service consent is rejected (D1-06).
--   * BR-P3: a photo becomes marketing-usable only through set_photo_marketing_use(), which needs
--     the customer's live photo_marketing consent; withdrawing that consent clears every flag.
--   * BR-P4: calls get recording_hold_until (live dispute); purge_expired_recordings() clears
--     expired recordings and queues the file deletion in storage_deletions (the worker deletes via
--     the Storage API, never raw SQL on storage.objects), logged in audit_log.
--   * BR-P5: DSR queue with an SLA clock and erasure_blockers() ("what is retained and why").
--     Executing an erasure is NOT built: anonymising a lead collides with BR-L3 (attribution is
--     immutable) — open item 25 for a decision.
--   * BR-P6: incidents with the 72-hour report clock set by trigger; super_admin only.

-- Like audit_log (migration 000900): an actor is any authenticated user, not only staff with a
-- profile — otherwise a status change made in a customer's session would fail the foreign key.
alter table public.lead_status_history drop constraint lead_status_history_actor_id_fkey;
alter table public.lead_status_history add constraint lead_status_history_actor_id_fkey
  foreign key (actor_id) references auth.users(id);

insert into public.settings (key, value, description) values
  ('dsr_response_days',   '30', 'DPDP rights requests: respond within this many days (grievance officer: resolve within one month)'),
  ('gst_retention_years', '8',  'BR-P5: GST records kept 72 months from the annual-return due date (CGST s.36) ≈ up to 8 years from invoice — REDUX''s CA to confirm')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Notices (BR-P1)
-- ---------------------------------------------------------------------------
create table public.privacy_notices (
  id             uuid primary key default gen_random_uuid(),
  version        text not null,                          -- 'v1.0'
  language       text not null default 'en',             -- Eighth Schedule translations on request
  body           text not null check (length(trim(body)) > 0),
  effective_from date not null,
  is_active      boolean not null default false,
  created_at     timestamptz not null default now(),
  unique (version, language)
);
create unique index privacy_notices_one_active on public.privacy_notices (language) where is_active;

create or replace function public.guard_privacy_notice() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' or new.body is distinct from old.body or new.version is distinct from old.version
     or new.language is distinct from old.language or new.effective_from is distinct from old.effective_from then
    raise exception 'A published notice never changes — publish a new version (BR-P1)' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_privacy_notice_guard before update or delete on public.privacy_notices
  for each row execute function public.guard_privacy_notice();

-- ---------------------------------------------------------------------------
-- Consent ledger (BR-P1, BR-P2)
-- ---------------------------------------------------------------------------
create table public.consent_records (
  id             uuid primary key default gen_random_uuid(),
  subject_phone  text check (subject_phone is null or subject_phone ~ '^\+[1-9][0-9]{7,14}$'),
  subject_email  text,
  lead_id        uuid references public.leads(id),
  customer_id    uuid references public.customers(id),
  call_id        uuid references public.calls(id),        -- §2: per-call recording consent
  purpose        public.consent_purpose not null,
  granted        boolean not null,
  notice_id      uuid not null references public.privacy_notices(id),
  notice_version text not null,                           -- denormalised for exports
  method         text not null check (method in ('web_form','whatsapp','verbal_call','portal','staff_entry')),
  ip_address     inet,
  user_agent     text,
  granted_at     timestamptz not null default clock_timestamp(),   -- not now(): two records in one
                                                                   -- transaction must still be ordered
  withdrawn_at   timestamptz,
  recorded_by    uuid references auth.users(id),
  constraint consent_has_subject check (subject_phone is not null or subject_email is not null
                                        or lead_id is not null or customer_id is not null)
);
create index consent_records_lead_id_idx     on public.consent_records (lead_id);
create index consent_records_customer_id_idx on public.consent_records (customer_id);
create index consent_records_phone_idx       on public.consent_records (subject_phone);
create index consent_records_live_idx        on public.consent_records (purpose) where withdrawn_at is null;

-- Append-only; the one permitted change is setting withdrawn_at, once
create or replace function public.guard_consent() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Consent records are never deleted (BR-P1)' using errcode = '42501';
  end if;
  if (to_jsonb(new) - 'withdrawn_at') is distinct from (to_jsonb(old) - 'withdrawn_at')
     or (old.withdrawn_at is not null and new.withdrawn_at is distinct from old.withdrawn_at) then
    raise exception 'A consent record only ever gains a withdrawal time (BR-P2)' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_consent_guard before update or delete on public.consent_records
  for each row execute function public.guard_consent();

-- Does this person currently consent to this purpose? (latest record per purpose wins)
create or replace function public.has_consent(p_phone text, p_customer uuid, p_purpose public.consent_purpose)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select c.granted and c.withdrawn_at is null
    from public.consent_records c
    where c.purpose = p_purpose
      and ((p_phone is not null and c.subject_phone = p_phone) or (p_customer is not null and c.customer_id = p_customer))
    order by c.granted_at desc limit 1), false);
$$;

-- p: {notice_version, language?, method, ip_address?, user_agent?, subject_phone?, subject_email?,
--     lead_id?, customer_id?, call_id?, purposes: {"service": true, "marketing": false, …}}
create or replace function public.record_consent(p jsonb)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_role   text := coalesce((select auth.jwt()) ->> 'user_role', '');
  v_notice public.privacy_notices%rowtype;
  v_key    text;
  v_val    jsonb;
  v_n      int := 0;
begin
  if not (public.is_system_caller() or v_role in ('super_admin','cc_exec')
          or (v_role = 'customer' and nullif(p ->> 'customer_id', '')::uuid = any (public.my_customer_ids()))) then
    raise exception 'Not allowed to record consent for this person' using errcode = '42501';
  end if;
  select * into v_notice from public.privacy_notices
  where version = p ->> 'notice_version' and language = coalesce(p ->> 'language', 'en');
  if not found then
    raise exception 'Unknown notice version % — consent must name the notice actually shown (BR-P1)', p ->> 'notice_version'
      using errcode = '22023';
  end if;
  if jsonb_typeof(p -> 'purposes') is distinct from 'object' then
    raise exception 'purposes must be an object like {"service": true}' using errcode = '22023';
  end if;

  for v_key, v_val in select * from jsonb_each(p -> 'purposes') loop
    insert into public.consent_records (subject_phone, subject_email, lead_id, customer_id, call_id, purpose, granted,
      notice_id, notice_version, method, ip_address, user_agent, recorded_by)
    values (nullif(p ->> 'subject_phone', ''), nullif(p ->> 'subject_email', ''),
      -- a consent given by phone later (e.g. a WhatsApp opt-in) still belongs on the lead (D2-11)
      coalesce(nullif(p ->> 'lead_id', '')::uuid,
               (select l.id from public.leads l where l.phone = nullif(p ->> 'subject_phone', '') order by l.created_at desc limit 1)),
      nullif(p ->> 'customer_id', '')::uuid, nullif(p ->> 'call_id', '')::uuid,
      v_key::public.consent_purpose, (v_val #>> '{}')::boolean, v_notice.id, v_notice.version,
      p ->> 'method', nullif(p ->> 'ip_address', '')::inet, p ->> 'user_agent', (select auth.uid()));
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke execute on function public.record_consent(jsonb) from public, anon;
grant execute on function public.record_consent(jsonb) to authenticated, service_role;

-- D2-11 / D1-06: the enquiry and its consent together, atomically. A website or dealer form
-- must carry service consent (the required checkbox); marketing is optional and unticked.
create or replace function public.ingest_lead_with_consent(p_lead jsonb, p_consent jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb; v_lead uuid;
begin
  if p_lead ->> 'source' in ('website','dealer')
     and coalesce((p_consent #>> '{purposes,service}')::boolean, false) is not true then
    raise exception 'Service-contact consent is required on the enquiry form (D1-06)' using errcode = '23514';
  end if;
  v_result := public.ingest_lead(p_lead);
  v_lead := (v_result ->> 'lead_id')::uuid;
  perform public.record_consent(p_consent || jsonb_build_object('lead_id', v_lead, 'subject_phone', p_lead ->> 'phone'));
  return v_result;
end $$;
revoke execute on function public.ingest_lead_with_consent(jsonb, jsonb) from public, anon;
grant execute on function public.ingest_lead_with_consent(jsonb, jsonb) to authenticated, service_role;

-- BR-P2: withdraw one purpose; the others (e.g. service) carry on
create or replace function public.withdraw_consent(p_purpose public.consent_purpose, p_phone text, p_customer uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare v_role text := coalesce((select auth.jwt()) ->> 'user_role', ''); v_n int;
begin
  if not (public.is_system_caller() or v_role in ('super_admin','cc_exec')
          or (v_role = 'customer' and p_customer = any (public.my_customer_ids()))) then
    raise exception 'Not allowed to withdraw consent for this person' using errcode = '42501';
  end if;
  update public.consent_records set withdrawn_at = now()
  where purpose = p_purpose and withdrawn_at is null and granted
    and ((p_phone is not null and subject_phone = p_phone) or (p_customer is not null and customer_id = p_customer));
  get diagnostics v_n = row_count;

  -- BR-P3: withdrawing photo-marketing consent takes every photo out of marketing use
  if p_purpose = 'photo_marketing' and p_customer is not null then
    update public.fitting_photos fp set marketing_use_consented = false
    from public.fittings f join public.surveys s on s.id = f.survey_id join public.properties pr on pr.id = s.property_id
    where fp.fitting_id = f.id and pr.customer_id = p_customer and fp.marketing_use_consented;
  end if;
  return v_n;
end $$;
revoke execute on function public.withdraw_consent(public.consent_purpose, text, uuid) from public, anon;
grant execute on function public.withdraw_consent(public.consent_purpose, text, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- BR-P3: site photos in marketing only with that customer's live photo_marketing consent
-- ---------------------------------------------------------------------------
create or replace function public.set_photo_marketing_use(p_photo uuid, p_use boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_customer uuid;
begin
  if not public.is_system_caller() and not public.current_role_is('super_admin') then
    raise exception 'Only a super_admin chooses gallery photos' using errcode = '42501';
  end if;
  select pr.customer_id into v_customer
  from public.fitting_photos fp join public.fittings f on f.id = fp.fitting_id
  join public.surveys s on s.id = f.survey_id join public.properties pr on pr.id = s.property_id
  where fp.id = p_photo;
  if v_customer is null then raise exception 'Photo not found' using errcode = 'P0002'; end if;
  if p_use and not public.has_consent(null, v_customer, 'photo_marketing') then
    raise exception 'The customer has not consented to their site photos being used in marketing (BR-P3)'
      using errcode = '23514';
  end if;
  update public.fitting_photos set marketing_use_consented = p_use where id = p_photo;
end $$;
revoke execute on function public.set_photo_marketing_use(uuid, boolean) from public, anon;
grant execute on function public.set_photo_marketing_use(uuid, boolean) to authenticated;

-- E2-S06: what the public gallery may show — flagged AND the consent still live at read time
create view public.v_marketing_photos with (security_invoker = true) as
select fp.id, fp.fitting_id, fp.slot, fp.storage_path, pr.customer_id
from public.fitting_photos fp
join public.fittings f on f.id = fp.fitting_id
join public.surveys s on s.id = f.survey_id
join public.properties pr on pr.id = s.property_id
where fp.marketing_use_consented and public.has_consent(null, pr.customer_id, 'photo_marketing');

-- ---------------------------------------------------------------------------
-- BR-P4: call recordings auto-delete at 90 days unless held for a live dispute
-- ---------------------------------------------------------------------------
alter table public.calls add column recording_hold_until timestamptz;
alter table public.calls add column recording_deleted_at timestamptz;

create table public.storage_deletions (
  id          uuid primary key default gen_random_uuid(),
  bucket      text not null,
  path        text not null,
  reason      text not null,
  entity_type text,
  entity_id   uuid,
  queued_at   timestamptz not null default now(),
  deleted_at  timestamptz,
  unique (bucket, path)
);
create index storage_deletions_pending_idx on public.storage_deletions (queued_at) where deleted_at is null;

create or replace function public.purge_expired_recordings()
returns int language plpgsql security definer set search_path = '' as $$
declare c record; v_n int := 0;
begin
  for c in select id, recording_path from public.calls
           where recording_path is not null and recording_expires_at < now()
             and (recording_hold_until is null or recording_hold_until < now())
           for update loop
    insert into public.storage_deletions (bucket, path, reason, entity_type, entity_id)
    values ('call-recordings', c.recording_path, 'BR-P4: 90-day retention', 'calls', c.id)
    on conflict (bucket, path) do nothing;
    update public.calls set recording_path = null, recording_deleted_at = now() where id = c.id;
    insert into public.audit_log (action, entity_type, entity_id, before, after)
    values ('retention_delete', 'calls', c.id, jsonb_build_object('recording_path', c.recording_path),
            jsonb_build_object('recording_path', null, 'reason', 'BR-P4 90-day retention'));
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke execute on function public.purge_expired_recordings() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- BR-P5 / D13-09: data-principal rights requests
-- ---------------------------------------------------------------------------
create table public.dsr_requests (
  id            uuid primary key default gen_random_uuid(),
  type          public.dsr_type not null,
  subject_phone text,
  customer_id   uuid references public.customers(id),
  requested_by  uuid references auth.users(id),
  status        public.dsr_status not null default 'received',
  details       text,
  response      text,
  retained_explanation jsonb,                              -- BR-P5: what we keep, and why
  due_at        timestamptz not null,
  completed_at  timestamptz,
  handled_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  constraint dsr_has_subject check (subject_phone is not null or customer_id is not null)
);
create index dsr_requests_status_idx      on public.dsr_requests (status, due_at);
create index dsr_requests_customer_id_idx on public.dsr_requests (customer_id);

-- BR-P5: why some data must stay — live jobs, and GST records inside the statutory period
create or replace function public.erasure_blockers(p_customer uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(b), '[]'::jsonb) from (
    select jsonb_build_object('reason', 'live_job', 'detail', 'Job ' || j.job_no || ' is ' || j.status,
                              'until', 'job closure') as b
    from public.jobs j where j.customer_id = p_customer and j.status not in ('completed','cancelled')
    union all
    select jsonb_build_object('reason', 'gst_records', 'detail', 'Invoice ' || i.invoice_no || ' of ' || i.issue_date,
                              'until', (i.issue_date + make_interval(years =>
                                coalesce((select (value #>> '{}')::int from public.settings where key = 'gst_retention_years'), 8)))::date)
    from public.invoices i where i.customer_id = p_customer and i.status <> 'draft'
  ) x;
$$;

create or replace function public.create_dsr_request(p_type public.dsr_type, p_customer uuid, p_phone text, p_details text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_role text := coalesce((select auth.jwt()) ->> 'user_role', '');
  v_days int := coalesce((select (value #>> '{}')::int from public.settings where key = 'dsr_response_days'), 30);
  v_id   uuid;
begin
  if not (public.is_system_caller() or v_role in ('super_admin','cc_exec')
          or (v_role = 'customer' and p_customer = any (public.my_customer_ids()))) then
    raise exception 'You can only make requests about your own data' using errcode = '42501';
  end if;
  insert into public.dsr_requests (type, customer_id, subject_phone, requested_by, details, due_at, retained_explanation)
  values (p_type, p_customer, p_phone, (select auth.uid()), nullif(trim(p_details), ''),
          now() + make_interval(days => v_days),
          case when p_type = 'erasure' and p_customer is not null then public.erasure_blockers(p_customer) end)
  returning id into v_id;
  -- D13-09: withdrawing consent through the rights flow takes effect at once
  if p_type = 'withdraw_consent' then
    perform public.withdraw_consent('marketing', p_phone, p_customer);
  end if;
  return v_id;
end $$;
revoke execute on function public.create_dsr_request(public.dsr_type, uuid, text, text) from public, anon;
grant execute on function public.create_dsr_request(public.dsr_type, uuid, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- BR-P6 / DPDP Rule 7: breach register with the 72-hour clock
-- ---------------------------------------------------------------------------
create table public.incidents (
  id                     uuid primary key default gen_random_uuid(),
  title                  text not null,
  description            text not null,
  discovered_at          timestamptz not null,
  nature                 text,
  extent                 text,
  likely_impact          text,
  mitigation             text,
  principals_notified_at timestamptz,
  board_notified_at      timestamptz,
  report_due_at          timestamptz not null,           -- discovered_at + 72 h, set by trigger
  detailed_report_at     timestamptz,
  closed_at              timestamptz,
  created_by             uuid references auth.users(id) default auth.uid(),
  created_at             timestamptz not null default now()
);
create index incidents_open_idx on public.incidents (report_due_at) where closed_at is null;

-- timestamptz arithmetic is not immutable, so a generated column can't do this; a trigger does
create or replace function public.set_incident_report_due() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.report_due_at := new.discovered_at + interval '72 hours';
  return new;
end $$;
create trigger trg_incident_report_due before insert or update of discovered_at on public.incidents
  for each row execute function public.set_incident_report_due();
create trigger trg_audit_incidents after insert or update on public.incidents
  for each row execute function public.write_audit();

alter table public.privacy_notices   enable row level security;
alter table public.consent_records   enable row level security;
alter table public.storage_deletions enable row level security;
alter table public.dsr_requests      enable row level security;
alter table public.incidents         enable row level security;

-- ---------------------------------------------------------------------------
-- Policies (ADR-004)
-- ---------------------------------------------------------------------------
-- Notices: every signed-in person reads them (the public site renders them server-side)
create policy privacy_notices_read on public.privacy_notices for select to authenticated using (true);
create policy privacy_notices_admin on public.privacy_notices for all to authenticated
  using ((select public.current_role_is('super_admin')))
  with check ((select public.current_role_is('super_admin')));

-- Consent: super_admin all; an executive for their own leads (D2-11, shown on the lead); the customer theirs
create policy consent_records_select on public.consent_records for select to authenticated
using (
  (select public.current_role_is('super_admin'))
  or ((select public.current_role_is('cc_exec')) and exists (select 1 from public.leads l where l.id = consent_records.lead_id))
  or customer_id = any ((select public.my_customer_ids())::uuid[])
);

create policy dsr_requests_select on public.dsr_requests for select to authenticated
  using ((select public.current_role_is('super_admin')) or customer_id = any ((select public.my_customer_ids())::uuid[]));
create policy incidents_admin on public.incidents for all to authenticated
  using ((select public.current_role_is('super_admin')))
  with check ((select public.current_role_is('super_admin')));
create policy storage_deletions_admin_read on public.storage_deletions for select to authenticated
  using ((select public.current_role_is('super_admin')));
