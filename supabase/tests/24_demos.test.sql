-- CR-001 phase 5 · free demos · BR-D1…D4.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000006a1', 'admin.demo@test.local'),
  ('00000000-0000-0000-0000-0000000006c1', 'exec.demo@test.local'),
  ('00000000-0000-0000-0000-0000000006d1', 'cust.demo@test.local');
insert into public.profiles (id, full_name) values
  ('00000000-0000-0000-0000-0000000006a1', 'Admin'), ('00000000-0000-0000-0000-0000000006c1', 'Exec');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000006a1', 'super_admin'), ('00000000-0000-0000-0000-0000000006c1', 'cc_exec');
update public.settings set value = '{"version":"t1","text":"Test terms","mechanical_days":365,"finish_days":730}' where key = 'warranty_terms';

insert into public.fitting_types (id, code, name) values ('40000000-0000-0000-0000-0000000006f1', 'demo_test_basin', 'Basin mixer');
-- an A-tier account owned by the executive, with a submitted assessment of two fittings in room 101
insert into public.customers (id, name, type, is_prospect, tier, account_owner_id) values
  ('30000000-0000-0000-0000-0000000006a1', 'Hotel Demo', 'hotel', true, 'A', '00000000-0000-0000-0000-0000000006c1'),
  ('30000000-0000-0000-0000-0000000006a2', 'Hotel Small', 'hotel', true, 'C', '00000000-0000-0000-0000-0000000006c1');
insert into public.customer_contacts (customer_id, name, phone, is_primary, is_admin, user_id) values
  ('30000000-0000-0000-0000-0000000006a1', 'Asha', '+919700000691', true, true, '00000000-0000-0000-0000-0000000006d1');
insert into public.properties (id, customer_id, name, address) values
  ('31000000-0000-0000-0000-0000000006a1', '30000000-0000-0000-0000-0000000006a1', 'Hotel Demo', 'Karol Bagh'),
  ('31000000-0000-0000-0000-0000000006a2', '30000000-0000-0000-0000-0000000006a2', 'Hotel Small', 'Paharganj');
insert into public.surveys (id, property_id, mode, scheduled_at, slot_end_at, status, submitted_at) values
  ('32000000-0000-0000-0000-0000000006a1', '31000000-0000-0000-0000-0000000006a1', 'self', now() - interval '2 days', now() + interval '5 days', 'submitted', now()),
  ('32000000-0000-0000-0000-0000000006a2', '31000000-0000-0000-0000-0000000006a2', 'self', now() - interval '2 days', now() + interval '5 days', 'submitted', now());
insert into public.fittings (id, survey_id, unit_label, fitting_type_id, idem_key, captured_at) values
  ('50000000-0000-0000-0000-0000000006a1', '32000000-0000-0000-0000-0000000006a1', '101', '40000000-0000-0000-0000-0000000006f1', 'demo-f1', now()),
  ('50000000-0000-0000-0000-0000000006a2', '32000000-0000-0000-0000-0000000006a1', '101', '40000000-0000-0000-0000-0000000006f1', 'demo-f2', now()),
  ('50000000-0000-0000-0000-0000000006a3', '32000000-0000-0000-0000-0000000006a2', '7',   '40000000-0000-0000-0000-0000000006f1', 'demo-f3', now());

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000006c1","user_role":"cc_exec"}';
create temp table d on commit drop as select public.propose_demo(jsonb_build_object('customer_id', '30000000-0000-0000-0000-0000000006a1', 'type', 'room_demo',
  'items', jsonb_build_array(jsonb_build_object('fitting_id', '50000000-0000-0000-0000-0000000006a1'), jsonb_build_object('fitting_id', '50000000-0000-0000-0000-0000000006a2')))) as id;
select is((select status from public.demos where id = (select id from d)), 'proposed', 'the account owner proposes a room demo');
select is((select count(*)::int from public.demo_items where demo_id = (select id from d)), 2, '…with its two fittings');
select throws_ok($$ select public.propose_demo('{"customer_id":"30000000-0000-0000-0000-0000000006a1","type":"room_demo","items":[{"fitting_id":"50000000-0000-0000-0000-0000000006a1"}]}') $$,
  '23514', null, 'BR-D2: a second room demo for the same account is blocked');
select throws_ok($$ select public.propose_demo('{"customer_id":"30000000-0000-0000-0000-0000000006a1","type":"fitting_demo","items":[{"fitting_id":"50000000-0000-0000-0000-0000000006a1"},{"fitting_id":"50000000-0000-0000-0000-0000000006a2"}]}') $$,
  '23514', null, 'a single-fitting demo covers one fitting');
select throws_ok($$ select public.propose_demo('{"customer_id":"30000000-0000-0000-0000-0000000006a2","type":"fitting_demo","items":[{"fitting_id":"50000000-0000-0000-0000-0000000006a3"}]}') $$,
  '23514', null, 'BR-D2: a tier C account is not eligible');
select lives_ok($$ select public.propose_demo('{"customer_id":"30000000-0000-0000-0000-0000000006a2","type":"fitting_demo","exception_reason":"Owner runs 4 hotels","items":[{"fitting_id":"50000000-0000-0000-0000-0000000006a3"}]}') $$,
  'BR-D2: …unless a reason is given for the approver');
select throws_ok($$ select public.decide_demo((select id from d), true) $$, '42501', null, 'BR-D1: an executive cannot approve');
select throws_ok($$ select public.schedule_demo((select id from d), current_date + 3) $$, '22023', null, 'BR-D1: an unapproved demo cannot be scheduled');

set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000006a1","user_role":"super_admin"}';
select lives_ok($$ select public.decide_demo((select id from d), true, 'Go') $$, 'BR-D1: the Super Admin approves');
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000006c1","user_role":"cc_exec"}';
create temp table j on commit drop as select public.schedule_demo((select id from d), current_date + 3) as id;
reset role;
select is((select row(kind, quotation_id is null)::text from public.jobs where id = (select id from j)), '(demo,t)', 'scheduling opens a demo job with no quotation');
select is((select count(*)::int from public.job_units where job_id = (select id from j)), 1, '…for room 101');
select is((select count(*)::int from public.messages where rule_code = 'CN23' and entity_id = (select id from d)), 1, 'the customer is told the date (CN23)');

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000006a1","user_role":"super_admin"}';
select throws_ok($$ select public.create_invoice_from_job((select id from j)) $$, '23514', null, 'BR-D3: a demo is never invoiced');

-- run the demo through to handover
select public.move_unit_stage((select id from public.job_units where job_id = (select id from j)), s::public.job_stage)
from unnest(array['removal_pickup', 'at_eurobrass', 'quality_check', 'refit_test']) s;
select public.record_handover(jsonb_build_object('job_unit_id', (select id from public.job_units where job_id = (select id from j)),
  'leak_check', true, 'operation_check', true, 'finish_check', true, 'customer_name', 'Asha'));
reset role;
select is((select count(*)::int from public.warranties where job_id = (select id from j)), 2, 'BR-D3: demo work carries warranty cards, same terms as paid');
select is((select status from public.demos where id = (select id from d)), 'completed', 'the demo completes with its job');

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000006c1","user_role":"cc_exec"}';
select throws_ok($$ select public.record_demo_outcome((select id from d), '{"internal_cost": 5000}') $$, '42501', null, 'BR-D3: only the Super Admin records the cost');
select lives_ok($$ select public.record_demo_outcome((select id from d), '{"result": "pass", "feedback": "GM impressed"}') $$, 'the executive records the result');

-- the customer sees it without the internal fields, and rates it
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000006d1","user_role":"customer"}';
select is((select count(*)::int from public.demos), 0, 'customers cannot read the demos table (internal cost)');
select is((select status from public.my_demos()), 'completed', 'the customer sees their demo through my_demos()');
select lives_ok($$ select public.rate_my_demo((select id from d), 5, 'Looks new') $$, 'the customer rates it');

-- BR-D4: a quotation approved for the account after the demo converts it
reset role;
insert into public.rate_cards (id, version, effective_from, created_by) values ('42000000-0000-0000-0000-0000000006f1', 9601, current_date, '00000000-0000-0000-0000-0000000006a1');
insert into public.quotations (id, quote_no, survey_id, customer_id, property_id, rate_card_id, status, issued_at, valid_until, terms_text, pdf_sha256, created_by)
values ('60000000-0000-0000-0000-0000000006f1', 'Q-DEMO', '32000000-0000-0000-0000-0000000006a1', '30000000-0000-0000-0000-0000000006a1',
        '31000000-0000-0000-0000-0000000006a1', '42000000-0000-0000-0000-0000000006f1', 'sent', now(), current_date + 30, 'Terms', repeat('e', 64), '00000000-0000-0000-0000-0000000006a1');
update public.quotations set status = 'approved' where id = '60000000-0000-0000-0000-0000000006f1';
select is((select status from public.demos where id = (select id from d)), 'converted', 'BR-D4: the approval converts the demo');
select is((select converted_quote_id from public.demos where id = (select id from d)), '60000000-0000-0000-0000-0000000006f1'::uuid, '…and links the quotation');

select * from finish();
rollback;
