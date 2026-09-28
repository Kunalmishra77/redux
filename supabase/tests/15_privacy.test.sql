-- §16 DPDP · BR-P1…P6 · D1-06, D2-11, D13-09.
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

-- ── fixtures ───────────────────────────────────────────────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'exec1@test.local'),
  ('00000000-0000-0000-0000-0000000000c2', 'exec2@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'surveyor1@test.local'),
  ('00000000-0000-0000-0000-0000000000f1', 'portal1@test.local'),
  ('00000000-0000-0000-0000-0000000000f2', 'portal2@test.local');
insert into public.profiles (id, full_name) values
  ('00000000-0000-0000-0000-0000000000a1', 'Admin'), ('00000000-0000-0000-0000-0000000000c1', 'Exec One'),
  ('00000000-0000-0000-0000-0000000000c2', 'Exec Two'), ('00000000-0000-0000-0000-0000000000b1', 'Surveyor');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'super_admin'), ('00000000-0000-0000-0000-0000000000c1', 'cc_exec'),
  ('00000000-0000-0000-0000-0000000000c2', 'cc_exec'), ('00000000-0000-0000-0000-0000000000b1', 'surveyor');

update public.privacy_notices set is_active = false where is_active;
insert into public.privacy_notices (id, version, body, effective_from, is_active) values
  ('90000000-0000-0000-0000-000000000001', 'test-1', 'We use your number to arrange your free assessment.', current_date, true);

insert into public.customers (id, name, type, is_prospect, converted_at) values
  ('30000000-0000-0000-0000-00000000000a', 'Hotel A', 'hotel', false, now()),
  ('30000000-0000-0000-0000-00000000000b', 'Hotel B', 'hotel', false, now());
insert into public.customer_contacts (customer_id, user_id, name, phone) values
  ('30000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000f1', 'CE A', '+919920000001'),
  ('30000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000f2', 'CE B', '+919920000002');
insert into public.properties (id, customer_id, name, address) values
  ('31000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-00000000000a', 'Hotel A', 'Road A');
insert into public.fitting_types (id, code, name) values ('40000000-0000-0000-0000-000000000001', 'p_test_basin', 'Basin mixer');
insert into public.surveys (id, property_id, surveyor_id, scheduled_at, slot_end_at, status) values
  ('32000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000b1',
   now() - interval '9 days', now() - interval '9 days' + interval '2 hours', 'in_progress');
insert into public.fittings (id, survey_id, unit_label, fitting_type_id, idem_key, captured_at) values
  ('50000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '204', '40000000-0000-0000-0000-000000000001', 'p-f1', now());
insert into public.fitting_photos (id, fitting_id, slot, storage_path, sha256, captured_at) values
  ('51000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'front', 'p/front', repeat('a', 64), now());
insert into public.rate_cards (id, version, effective_from) values ('42000000-0000-0000-0000-000000000001', 9501, current_date);
insert into public.quotations (id, quote_no, survey_id, customer_id, property_id, rate_card_id, status, issued_at, valid_until, terms_text, pdf_sha256)
values ('60000000-0000-0000-0000-000000000001', 'Q-PRIV', '32000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-00000000000a',
        '31000000-0000-0000-0000-00000000000a', '42000000-0000-0000-0000-000000000001', 'approved', now(), current_date, 'T', repeat('b', 64));
insert into public.jobs (job_no, quotation_id, customer_id, property_id) values
  ('J-PRIV', '60000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-00000000000a', '31000000-0000-0000-0000-00000000000a');

-- ── BR-P1: a published notice never changes ────────────────────────────────
select throws_ok($$ update public.privacy_notices set body = 'edited' where id = '90000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'BR-P1: the notice text people consented to can never be edited');

-- ── D1-06 / D2-11: the enquiry and its consent, together ───────────────────
set local request.jwt.claims = '{"role":"service_role"}';
select throws_ok(
  $$ select public.ingest_lead_with_consent('{"phone":"+919920000101","source":"website"}',
       '{"notice_version":"test-1","method":"web_form","purposes":{"marketing":true}}') $$,
  '23514', null, 'D1-06: a web enquiry without service consent is rejected');
select is((select count(*)::int from public.leads where phone = '+919920000101'), 0, '… and no lead is left behind (atomic)');
select throws_ok(
  $$ select public.ingest_lead_with_consent('{"phone":"+919920000101","source":"website"}',
       '{"notice_version":"no-such","method":"web_form","purposes":{"service":true}}') $$,
  '22023', null, 'BR-P1: consent must name a notice that exists');

select public.ingest_lead_with_consent('{"phone":"+919920000101","source":"website","name":"Meera"}',
  '{"notice_version":"test-1","method":"web_form","ip_address":"198.51.100.4","user_agent":"test","purposes":{"service":true,"marketing":false}}');
select is((select array_agg(purpose::text || '=' || granted order by purpose) from public.consent_records
           where subject_phone = '+919920000101'),
  array['service=true','marketing=false'], 'BR-P2: one record per purpose — service yes, marketing no (unticked by default)');
select ok((select bool_and(notice_id = '90000000-0000-0000-0000-000000000001' and notice_version = 'test-1'
                           and lead_id is not null and ip_address = '198.51.100.4'::inet)
           from public.consent_records where subject_phone = '+919920000101'),
  'BR-P1 / D2-11: each record carries the notice shown, the lead, and where it came from');

-- ── BR-P2: withdraw one purpose; the rest carry on ─────────────────────────
select public.record_consent('{"notice_version":"test-1","method":"whatsapp","subject_phone":"+919920000101","purposes":{"marketing":true}}');
select ok(public.has_consent('+919920000101', null, 'marketing'), 'a later marketing opt-in wins over the earlier "no"');
select is(public.withdraw_consent('marketing', '+919920000101', null), 1, 'BR-P2: marketing withdrawn …');
select ok(not public.has_consent('+919920000101', null, 'marketing') and public.has_consent('+919920000101', null, 'service'),
  'BR-P2: … while service messages continue');

reset role;
select throws_ok($$ update public.consent_records set granted = true where subject_phone = '+919920000101' and purpose = 'marketing' $$,
  '42501', null, 'a consent record is never rewritten — even by the system');
select throws_ok($$ update public.consent_records set withdrawn_at = now() + interval '1 day'
                    where subject_phone = '+919920000101' and withdrawn_at is not null $$,
  '42501', null, '… a withdrawal time is set once');
select throws_ok($$ delete from public.consent_records where subject_phone = '+919920000101' $$,
  '42501', null, '… and nothing is deleted');

-- ── who sees consent ───────────────────────────────────────────────────────
-- (resolve the executive before switching role: RLS would hide the lead afterwards)
select set_config('request.jwt.claims', (select format('{"role":"authenticated","sub":"%s","user_role":"cc_exec"}', assigned_to)
                                from public.leads where phone = '+919920000101'), true);
set local role authenticated;
select is((select count(*)::int from public.consent_records where subject_phone = '+919920000101'), 3,
  'D2-11: the lead''s executive sees its consent');
reset role;
select set_config('request.jwt.claims', (select format('{"role":"authenticated","sub":"%s","user_role":"cc_exec"}',
  case when assigned_to = '00000000-0000-0000-0000-0000000000c1' then '00000000-0000-0000-0000-0000000000c2'
       else '00000000-0000-0000-0000-0000000000c1' end) from public.leads where phone = '+919920000101'), true);
set local role authenticated;
select is((select count(*)::int from public.consent_records where subject_phone = '+919920000101'), 0,
  'P3: another executive does not');

-- ── BR-P3: site photos in marketing only with photo_marketing consent ──────
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000a1","user_role":"super_admin"}';
select throws_ok($$ select public.set_photo_marketing_use('51000000-0000-0000-0000-000000000001', true) $$,
  '23514', null, 'BR-P3: no photo_marketing consent → the photo cannot go in the gallery');
select public.record_consent('{"notice_version":"test-1","method":"portal","customer_id":"30000000-0000-0000-0000-00000000000a","purposes":{"photo_marketing":true}}');
select lives_ok($$ select public.set_photo_marketing_use('51000000-0000-0000-0000-000000000001', true) $$,
  'BR-P3: with consent, super_admin puts it in the gallery');
select is((select count(*)::int from public.v_marketing_photos where id = '51000000-0000-0000-0000-000000000001'), 1,
  'E2-S06: the gallery shows it');
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000f1","user_role":"customer"}';
select public.withdraw_consent('photo_marketing', null, '30000000-0000-0000-0000-00000000000a');
reset role;
select ok((select not marketing_use_consented from public.fitting_photos where id = '51000000-0000-0000-0000-000000000001'),
  'BR-P3: the customer withdraws → the photo leaves marketing use immediately');

-- ── BR-P4: recordings deleted at 90 days unless on hold ────────────────────
insert into public.leads (id, phone, source_id, assigned_to) values
  ('20000000-0000-0000-0000-000000000009', '+919920000109', (select id from public.lead_sources where code = 'call'),
   '00000000-0000-0000-0000-0000000000c1');
insert into public.calls (id, lead_id, agent_id, direction, started_at, recording_consent, recording_path, recording_expires_at, recording_hold_until) values
  ('91000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-0000000000c1',
   'outbound', now() - interval '91 days', true, 'calls/old.mp3', now() - interval '1 day', null),
  ('91000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-0000000000c1',
   'outbound', now() - interval '91 days', true, 'calls/dispute.mp3', now() - interval '1 day', now() + interval '30 days');
select is(public.purge_expired_recordings(), 1, 'BR-P4: one recording past 90 days is purged');
select ok((select recording_path is null and recording_deleted_at is not null from public.calls where id = '91000000-0000-0000-0000-000000000001')
          and exists (select 1 from public.storage_deletions where path = 'calls/old.mp3' and deleted_at is null),
  'BR-P4: the call forgets the file and the file deletion is queued for the Storage API');
select ok(exists (select 1 from public.audit_log where action = 'retention_delete' and entity_id = '91000000-0000-0000-0000-000000000001'),
  'BR-P4: the deletion is logged');
select is((select recording_path from public.calls where id = '91000000-0000-0000-0000-000000000002'), 'calls/dispute.mp3',
  'BR-P4: a recording held for a live dispute is kept');

-- ── BR-P5 / D13-09: rights requests ────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000f1","user_role":"customer"}';
create temp table t (k text primary key, v uuid) on commit drop;
insert into t values ('dsr', public.create_dsr_request('erasure', '30000000-0000-0000-0000-00000000000a', null, 'Please delete my data'));
select is((select retained_explanation -> 0 ->> 'reason' from public.dsr_requests where id = (select v from t where k = 'dsr')),
  'live_job', 'BR-P5: an erasure request during a live job says what is kept and why');
select ok((select due_at between now() + interval '29 days' and now() + interval '31 days' from public.dsr_requests
           where id = (select v from t where k = 'dsr')), 'D13-09: the request runs on a 30-day clock');
select throws_ok($$ select public.create_dsr_request('access', '30000000-0000-0000-0000-00000000000b', null, 'x') $$,
  '42501', null, 'P1: a customer cannot make a request about someone else');
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000f2","user_role":"customer"}';
select is((select count(*)::int from public.dsr_requests), 0, 'P1: another customer sees none of it');

-- ── BR-P6: the 72-hour clock ───────────────────────────────────────────────
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000a1","user_role":"super_admin"}';
insert into public.incidents (id, title, description, discovered_at)
values ('92000000-0000-0000-0000-000000000001', 'Test incident', 'Laptop lost', '2026-10-01 10:00:00+05:30');
select is((select report_due_at from public.incidents where id = '92000000-0000-0000-0000-000000000001'),
  '2026-10-04 10:00:00+05:30'::timestamptz, 'BR-P6: the Board report is due 72 hours after discovery');
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000c1","user_role":"cc_exec"}';
select is((select count(*)::int from public.incidents), 0, 'the breach register is super_admin only');

select * from finish();
rollback;
