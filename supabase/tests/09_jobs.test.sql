-- §11 jobs + the OTP approval · BR-Q1, Q4, Q5, Q6 · BR-J1…J6 · item 9 · D11-04, D11-07.
begin;
create extension if not exists pgtap with schema extensions;
select plan(42);

-- ── fixtures: a sent quote for a prospect, as the earlier steps leave it ────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'exec1@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'surveyor1@test.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'surveyor2@test.local');
insert into public.profiles (id, full_name) values
  ('00000000-0000-0000-0000-0000000000a1', 'Admin'), ('00000000-0000-0000-0000-0000000000c1', 'Exec One'),
  ('00000000-0000-0000-0000-0000000000b1', 'Surveyor One'), ('00000000-0000-0000-0000-0000000000b2', 'Surveyor Two');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'super_admin'), ('00000000-0000-0000-0000-0000000000c1', 'cc_exec'),
  ('00000000-0000-0000-0000-0000000000b1', 'surveyor'), ('00000000-0000-0000-0000-0000000000b2', 'surveyor');

insert into public.cities (id, name, state_code) values ('10000000-0000-0000-0000-0000000000d1', 'Jobs Test Delhi', '07');
insert into public.fitting_types (id, code, name) values ('40000000-0000-0000-0000-000000000001', 'j_test_basin', 'Basin mixer');

update public.rate_cards set is_active = false where is_active;
insert into public.rate_cards (id, version, effective_from) values ('42000000-0000-0000-0000-000000000001', 9101, current_date);
insert into public.rate_card_items (rate_card_id, fitting_type_id, work_type_id, price, hsn_sac)
select '42000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', w.id, 1000, '998719'
from public.work_types w where w.code in ('restore_finish','repair_function','replace_eurobrass');
insert into public.market_prices (rate_card_id, fitting_type_id, price)
values ('42000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 9000);
update public.rate_cards set is_active = true, activated_at = now() where id = '42000000-0000-0000-0000-000000000001';

update public.settings set value = '{"version":"W-1","text":"Mechanical 1 year, finish 2 years","mechanical_days":365,"finish_days":730}'
where key = 'warranty_terms';
update public.settings set value = '15' where key = 'quote_validity_days';

insert into public.leads (id, phone, source_id, status, assigned_to) values
  ('20000000-0000-0000-0000-000000000001', '+919870000001', (select id from public.lead_sources where code = 'website'),
   'contacted', '00000000-0000-0000-0000-0000000000c1');
insert into public.customers (id, lead_id, name, type) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'The Grand Orchid', 'hotel');
insert into public.customer_contacts (customer_id, name, phone, is_primary)
values ('30000000-0000-0000-0000-000000000001', 'Anita (CE)', '+919870000001', true);
insert into public.properties (id, customer_id, name, address, city_id) values
  ('31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Orchid', 'Janpath', '10000000-0000-0000-0000-0000000000d1');
insert into public.surveys (id, lead_id, property_id, surveyor_id, scheduled_at, slot_end_at, status, submitted_at) values
  ('32000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-0000000000b1', now() - interval '3 days', now() - interval '3 days' + interval '2 hours', 'submitted', now());
update public.leads set status = 'survey_booked' where id = '20000000-0000-0000-0000-000000000001';
update public.leads set status = 'surveyed'      where id = '20000000-0000-0000-0000-000000000001';
insert into public.fittings (id, survey_id, unit_label, fitting_type_id, idem_key, captured_at) values
  ('50000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '204', '40000000-0000-0000-0000-000000000001', 'j-f1', now()),
  ('50000000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000001', '205', '40000000-0000-0000-0000-000000000001', 'j-f2', now()),
  ('50000000-0000-0000-0000-000000000003', '32000000-0000-0000-0000-000000000001', '205', '40000000-0000-0000-0000-000000000001', 'j-f3', now());
insert into public.assessments (fitting_id, recommended, rate_card_id, price_recommended, price_replace_eurobrass, price_market_replacement)
select f, r::public.treatment, '42000000-0000-0000-0000-000000000001', 1000, 1000, 9000
from (values ('50000000-0000-0000-0000-000000000001'::uuid, 'restore_finish'),
             ('50000000-0000-0000-0000-000000000002'::uuid, 'repair_function'),
             ('50000000-0000-0000-0000-000000000003'::uuid, 'replace_eurobrass')) v(f, r);

create temp table t (k text primary key, v uuid) on commit drop;
create temp table codes (k text primary key, id uuid, code text) on commit drop;
grant all on t, codes to authenticated;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","user_role":"surveyor"}';
insert into t values ('q', public.create_quote_from_survey('32000000-0000-0000-0000-000000000001'));
insert into t values ('q2', public.create_quote_from_survey('32000000-0000-0000-0000-000000000001'));
select public.freeze_quote_for_issue(v) from t where k in ('q','q2');
select public.mark_quote_sent(v, 'quotes/' || k || '.pdf', repeat('e', 64)) from t where k in ('q','q2');

set local request.jwt.claims = '{"role":"service_role"}';
insert into codes select 'A', (r ->> 'otp_id')::uuid, r ->> 'code'
  from (select public.request_quote_otp((select v from t where k = 'q'), '+919870000001', 'whatsapp') r) s;
insert into codes select 'B', (r ->> 'otp_id')::uuid, r ->> 'code'
  from (select public.request_quote_otp((select v from t where k = 'q'), '+919870000001', 'whatsapp') r) s;
insert into codes select 'C', (r ->> 'otp_id')::uuid, r ->> 'code'
  from (select public.request_quote_otp((select v from t where k = 'q'), '+919870000001', 'sms') r) s;
insert into codes select 'D', (r ->> 'otp_id')::uuid, r ->> 'code'
  from (select public.request_quote_otp((select v from t where k = 'q2'), '+919870000009', 'whatsapp') r) s;
select public.record_otp_delivery((select id from codes where k = 'B'), 'wamid.TEST-B');

-- ── BR-Q5: attempts, lockout, expiry — and the attempt is kept ─────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","user_role":"super_admin"}';
select throws_ok($$ select public.verify_quote_otp((select id from codes where k = 'B'), 'x') $$,
  '42501', null, 'approval is verified by the server only');
reset role;
set local request.jwt.claims = '{"role":"service_role"}';

select is(public.verify_quote_otp((select id from codes where k = 'A'), 'wrong') - 'attempts_left',
  '{"ok":false,"reason":"wrong_code"}'::jsonb, 'BR-Q5: a wrong code is refused');
select public.verify_quote_otp((select id from codes where k = 'A'), 'wrong') from generate_series(1, 3);
select is(public.verify_quote_otp((select id from codes where k = 'A'), 'wrong') ->> 'reason', 'locked',
  'BR-Q5: the fifth wrong attempt locks the code');
select is(public.verify_quote_otp((select id from codes where k = 'A'), (select code from codes where k = 'A')) ->> 'reason',
  'locked', 'BR-Q5: … even the right code is refused afterwards');
select is((select attempts || '/' || failed_attempts from public.quote_otps where id = (select id from codes where k = 'A')),
  '5/5', 'BR-Q5: every attempt was recorded (a refusal is not rolled back)');

update public.quote_otps set expires_at = now() - interval '1 minute' where id = (select id from codes where k = 'C');
select is(public.verify_quote_otp((select id from codes where k = 'C'), (select code from codes where k = 'C')) ->> 'reason',
  'expired_code', 'BR-Q5: a code older than 10 minutes is refused');

-- ── BR-Q6: a failure mid-approval leaves nothing behind ────────────────────
insert into public.jobs (job_no, quotation_id, customer_id, property_id)
values ('J-BLOCKER', (select v from t where k = 'q2'), '30000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001');
select throws_ok($$ select public.verify_quote_otp((select id from codes where k = 'D'), (select code from codes where k = 'D')) $$,
  '23505', null, 'BR-Q6: job creation fails mid-approval …');
select is((select q.status::text || ':' || (select count(*) from public.quote_approvals a where a.quotation_id = q.id)
                  || ':' || coalesce((select verified_at::text from public.quote_otps where id = (select id from codes where k = 'D')), 'unverified')
           from public.quotations q where q.id = (select v from t where k = 'q2')),
  'sent:0:unverified', 'BR-Q6: … so the quote is still sent, no approval exists, the code is unused');
delete from public.jobs where job_no = 'J-BLOCKER';

-- ── The approval ───────────────────────────────────────────────────────────
select is(public.verify_quote_otp((select id from codes where k = 'B'), 'nope') ->> 'attempts_left', '4',
  'one wrong try first');
insert into t select 'job', (r ->> 'job_id')::uuid from (select public.verify_quote_otp(
  (select id from codes where k = 'B'), (select code from codes where k = 'B'),
  '{"approver_name":"Anita Sharma","ip_address":"203.0.113.7","user_agent":"Mozilla/5.0 test"}') r) s;
select isnt((select v from t where k = 'job'), null, 'D10: the right code approves and returns the new job');
select is((select status::text from public.quotations where id = (select v from t where k = 'q')), 'approved', 'the quote is approved');

select ok((select pdf_sha256 = repeat('e', 64) and quotation_version = 1 and otp_hash is not null
                  and otp_delivered_at is not null and gateway_message_id = 'wamid.TEST-B'
                  and attempt_count = 2 and failed_attempts = 1 and ip_address = '203.0.113.7'::inet
                  and user_agent = 'Mozilla/5.0 test' and terms_text like 'Mechanical%' and approver_name = 'Anita Sharma'
           from public.quote_approvals where quotation_id = (select v from t where k = 'q')),
  'BR-Q4: the full evidence set is recorded');
select ok((select otp_verified_at >= otp_generated_at from public.quote_approvals where quotation_id = (select v from t where k = 'q')),
  'BR-Q4: server-side timestamps in order');
select ok((select not is_prospect from public.customers where id = '30000000-0000-0000-0000-000000000001'),
  'BR-S8: the prospect is converted — same customer, not a new one');
select is((select status::text from public.leads where id = '20000000-0000-0000-0000-000000000001'), 'won', 'the lead is Won');
select is((select array_agg(pu.label order by pu.label) from public.job_units u join public.property_units pu on pu.id = u.property_unit_id
           where u.job_id = (select v from t where k = 'job')), array['204','205'], 'one job unit per room on the quote');
select is(public.verify_quote_otp((select id from codes where k = 'B'), (select code from codes where k = 'B')) ->> 'reason',
  'already_used', 'a code approves once');

-- the rest of q2 approves normally (used for BR-J6 below)
insert into t select 'job2', (r ->> 'job_id')::uuid
  from (select public.verify_quote_otp((select id from codes where k = 'D'), (select code from codes where k = 'D')) r) s;

-- ── BR-J1: stages ──────────────────────────────────────────────────────────
insert into t select 'u204', u.id from public.job_units u join public.property_units pu on pu.id = u.property_unit_id
  where u.job_id = (select v from t where k = 'job') and pu.label = '204';
insert into t select 'u205', u.id from public.job_units u join public.property_units pu on pu.id = u.property_unit_id
  where u.job_id = (select v from t where k = 'job') and pu.label = '205';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","user_role":"super_admin"}';
select throws_ok($$ select public.move_unit_stage((select v from t where k = 'u204'), 'at_eurobrass') $$,
  '23514', null, 'BR-J1: a stage cannot be skipped');
select lives_ok($$ select public.move_unit_stage((select v from t where k = 'u204'), 'removal_pickup') $$, 'one stage forward');
select is((select status::text from public.jobs where id = (select v from t where k = 'job')), 'in_progress',
  'the job is in progress once a unit moves');
select throws_ok($$ update public.job_units set current_stage = 'refit_test' where id = (select v from t where k = 'u204') $$,
  '42501', null, 'BR-J1: nobody sets a stage by hand, not even super_admin');
select throws_ok($$ select public.move_unit_stage((select v from t where k = 'u204'), 'dates_confirmed') $$,
  '23514', null, 'BR-J1: moving back needs a reason');
select public.move_unit_stage((select v from t where k = 'u204'), 'dates_confirmed', null, 'Hotel moved the dates');
select ok((select is_backward and backward_reason = 'Hotel moved the dates' from public.job_stage_events
           where job_unit_id = (select v from t where k = 'u204') and to_stage = 'dates_confirmed' and is_backward),
  'BR-J1: the backward move is logged with its reason');
select public.move_unit_stage((select v from t where k = 'u204'), 'removal_pickup');

-- ── BR-J2 / item 9: blocked time stops the clock — including right now ─────
select public.block_unit((select v from t where k = 'u204'), 'civil_work', 'Hotel re-tiling the wall');
select throws_ok($$ select public.move_unit_stage((select v from t where k = 'u204'), 'at_eurobrass') $$,
  '22023', null, 'a blocked unit cannot move on');
reset role;
update public.job_units set downtime_from = now() - interval '10 days', planned_downtime_hours = 48
where id = (select v from t where k = 'u204');
update public.unit_blocks set blocked_from = now() - interval '5 days' where job_unit_id = (select v from t where k = 'u204');
select ok((select public.unit_effective_downtime_hours((select v from t where k = 'u204')) between 119.9 and 120.1),
  'BR-J2: 10 days out of service, blocked for the last 5 and still blocked → 120 h count, the clock is stopped');
select is((select count(*)::int from public.v_delayed_units where job_unit_id = (select v from t where k = 'u204')), 0,
  'D11-04: a blocked unit raises no delay alert');
set local role authenticated;
select public.unblock_unit((select v from t where k = 'u204'));
select is((select count(*)::int from public.v_delayed_units where job_unit_id = (select v from t where k = 'u204')), 1,
  'D11-04: once unblocked, 120 h against a 48 h plan is a delay');

-- ── D11-07, BR-J3/J4/J5: handover and warranties ───────────────────────────
select throws_ok($$ select public.record_handover(jsonb_build_object('job_unit_id', (select v from t where k = 'u204'),
                      'leak_check', true, 'operation_check', true, 'finish_check', true)) $$,
  '23514', null, 'BR-J1: handover only after refit & test');
select public.move_unit_stage((select v from t where k = 'u204'), s)
from unnest(array['at_eurobrass','quality_check','refit_test']::public.job_stage[]) s;
select throws_ok($$ select public.record_handover(jsonb_build_object('job_unit_id', (select v from t where k = 'u204'),
                      'leak_check', true, 'operation_check', true, 'finish_check', false)) $$,
  '23514', null, 'D11-07: a failed finish check keeps the room out of service');
select lives_ok($$ select public.record_handover(jsonb_build_object('job_unit_id', (select v from t where k = 'u204'),
                     'leak_check', true, 'operation_check', true, 'finish_check', true, 'customer_name', 'Anita Sharma')) $$,
  'D11-07: all checks pass → handover');
select is((select status::text || ':' || current_stage from public.job_units where id = (select v from t where k = 'u204')),
  'back_in_service:warranty_active', 'the room is back in service with its warranty active');
select is((select kind || ':' || (valid_until - valid_from) from public.warranties where job_unit_id = (select v from t where k = 'u204')),
  'finish:730', 'BR-J4/J5: a restored finish gets a finish warranty from handover, for the quoted 730 days');
select is((select status::text from public.jobs where id = (select v from t where k = 'job')), 'in_progress',
  'BR-J3: the job is not complete while room 205 is open');

select public.move_unit_stage((select v from t where k = 'u205'), s)
from unnest(array['removal_pickup','at_eurobrass','quality_check','refit_test']::public.job_stage[]) s;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","user_role":"surveyor"}';
select lives_ok($$ select public.record_handover(jsonb_build_object('job_unit_id', (select v from t where k = 'u205'),
                     'leak_check', true, 'operation_check', true, 'finish_check', true, 'customer_name', 'Anita Sharma')) $$,
  'J1 step 17: the surveyor records the handover');
select is((select array_agg(kind order by kind) from public.warranties where job_unit_id = (select v from t where k = 'u205')),
  array['finish','mechanical','mechanical'], 'BR-J5: repair → mechanical; Eurobrass replacement → mechanical + finish');
select is((select status::text || ':' || current_stage from public.jobs where id = (select v from t where k = 'job')),
  'completed:warranty_active', 'BR-J3: every room handed over → the job is complete');

reset role;
select throws_ok($$ update public.warranties set valid_until = valid_until + 365 $$, '42501', null,
  'a warranty card cannot be extended or edited');

-- ── Who sees the job ───────────────────────────────────────────────────────
insert into auth.users (id, email, phone) values ('00000000-0000-0000-0000-0000000000f1', 'anita@test.local', '919870000001');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","user_role":"customer"}';
select is((select count(*)::int from public.warranties where job_id = (select v from t where k = 'job')), 4,
  'D13-06: the customer''s new login is linked by phone and sees their warranty cards');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","user_role":"surveyor"}';
select is((select count(*)::int from public.jobs), 0, 'another surveyor sees no jobs');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","user_role":"cc_exec"}';
select ok((select count(*) from public.jobs where id = (select v from t where k = 'job')) = 1,
  'executives track every job (roles matrix)');

-- ── BR-J6: pilot → wider project ───────────────────────────────────────────
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","user_role":"super_admin"}';
select throws_ok($$ select public.link_to_pilot((select v from t where k = 'job2'), (select v from t where k = 'job')) $$,
  '23514', null, 'BR-J6: only a pilot can be the parent');
update public.jobs set is_pilot = true where id = (select v from t where k = 'job');
select public.link_to_pilot((select v from t where k = 'job2'), (select v from t where k = 'job'));
select is((select parent_job_id from public.jobs where id = (select v from t where k = 'job2')), (select v from t where k = 'job'),
  'BR-J6: the wider project links to its pilot');

select * from finish();
rollback;
