-- CR-001 phase 4b · self-assessment as a survey mode · BR-S10, BR-S11, ADR-015.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email, phone) values
  ('00000000-0000-0000-0000-0000000004a1', 'admin.self@test.local', null),
  ('00000000-0000-0000-0000-0000000004c1', 'exec.self@test.local', null),
  ('00000000-0000-0000-0000-0000000004b1', 'reviewer.self@test.local', null),
  ('00000000-0000-0000-0000-0000000004b2', 'surveyor2.self@test.local', null);
insert into public.profiles (id, full_name) values
  ('00000000-0000-0000-0000-0000000004a1', 'Admin'), ('00000000-0000-0000-0000-0000000004c1', 'Exec'),
  ('00000000-0000-0000-0000-0000000004b1', 'Reviewer'), ('00000000-0000-0000-0000-0000000004b2', 'Other surveyor');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000004a1', 'super_admin'), ('00000000-0000-0000-0000-0000000004c1', 'cc_exec'),
  ('00000000-0000-0000-0000-0000000004b1', 'surveyor'), ('00000000-0000-0000-0000-0000000004b2', 'surveyor');

-- prices
insert into public.fitting_types (id, code, name) values ('40000000-0000-0000-0000-0000000004f1', 'self_test_basin', 'Basin mixer');
insert into public.finishes (id, code, name) values ('41000000-0000-0000-0000-0000000004f1', 'self_test_chrome', 'Chrome');
insert into public.condition_flags (id, code, name) values ('43000000-0000-0000-0000-0000000004f1', 'self_test_worn', 'Worn finish');
update public.rate_cards set is_active = false where is_active;
insert into public.rate_cards (id, version, effective_from) values ('42000000-0000-0000-0000-0000000004f1', 9401, current_date);
insert into public.rate_card_items (rate_card_id, fitting_type_id, work_type_id, finish_id, price, gst_rate, hsn_sac)
select '42000000-0000-0000-0000-0000000004f1', '40000000-0000-0000-0000-0000000004f1', w.id, '41000000-0000-0000-0000-0000000004f1', p, 18.00, '998719'
from (values ('restore_finish', 1500.00), ('replace_eurobrass', 6000.00)) v(code, p) join public.work_types w on w.code = v.code;
insert into public.market_prices (rate_card_id, fitting_type_id, price) values ('42000000-0000-0000-0000-0000000004f1', '40000000-0000-0000-0000-0000000004f1', 9000.00);
update public.rate_cards set is_active = true, activated_at = now() where id = '42000000-0000-0000-0000-0000000004f1';

-- a business account with a portal contact, and its enquiry
insert into public.customers (id, name, type, is_prospect) values
  ('30000000-0000-0000-0000-0000000004a1', 'Hotel Remote', 'hotel', true),
  ('30000000-0000-0000-0000-0000000004a2', 'Someone Else', 'hotel', true);
insert into public.customer_contacts (customer_id, name, phone, is_primary, is_admin) values
  ('30000000-0000-0000-0000-0000000004a1', 'Neha', '+919700000491', true, true),
  ('30000000-0000-0000-0000-0000000004a2', 'Other', '+919700000492', true, true);
insert into auth.users (id, email, phone) values
  ('00000000-0000-0000-0000-0000000004d1', 'neha.self@test.local', '919700000491'),
  ('00000000-0000-0000-0000-0000000004d2', 'other.self@test.local', '919700000492');
insert into public.leads (id, phone, name, source_id, customer_type, customer_id, assigned_to, estimated_units, pincode) values
  ('20000000-0000-0000-0000-0000000004b1', '+919700000491', 'Neha', (select id from public.lead_sources where code = 'call'), 'hotel',
   '30000000-0000-0000-0000-0000000004a1', '00000000-0000-0000-0000-0000000004c1', 18, '411001');

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000004d1","user_role":"customer"}';
create temp table sv on commit drop as select public.start_self_assessment('20000000-0000-0000-0000-0000000004b1') as id;
select is((select row(mode, status, surveyor_id is null)::text from public.surveys where id = (select id from sv)),
  '(self,scheduled,t)', 'ADR-015: the customer starts a self-assessment — a survey in self mode, no surveyor');
select is(public.start_self_assessment('20000000-0000-0000-0000-0000000004b1'), (select id from sv), 'starting again returns the open one');

create temp table f on commit drop as select public.self_assessment_save_fitting((select id from sv),
  jsonb_build_object('unit_label', '101', 'fitting_type_id', '40000000-0000-0000-0000-0000000004f1',
                     'current_finish_id', '41000000-0000-0000-0000-0000000004f1',
                     'condition_ids', '["43000000-0000-0000-0000-0000000004f1"]'::jsonb)) as id;
select is((select count(*)::int from public.fittings where survey_id = (select id from sv)), 1, 'BR-S10: the customer adds a fitting');
select is((select count(*)::int from public.fitting_conditions where fitting_id = (select id from f)), 1, '…with its condition');
select throws_ok($$ select public.submit_self_assessment((select id from sv)) $$, '23514', null, 'BR-S10: no submit without all four photos');

select is(public.self_assessment_photo_path((select id from f), 'front'),
  'surveys/' || (select id from sv) || '/' || (select id from f) || '/front/', 'the photo path names the survey, fitting and slot');
select throws_ok(format($$ select public.self_assessment_add_photo(%L, 'front', 'surveys/x/y/front/a.jpg', %L, 100, 10, 10) $$,
  (select id from f), repeat('a', 64)), '22023', null, 'a photo path for another fitting is refused');
select is((select count(public.self_assessment_add_photo((select id from f), slot,
  'surveys/' || (select id from sv) || '/' || (select id from f) || '/' || slot || '/' || repeat(n, 64) || '.jpg', repeat(n, 64), 1000, 1600, 1200))::int
  from (values ('front', 'a'), ('side', 'b'), ('top', 'c'), ('close_up', 'd')) v(slot, n)), 4, 'the four photos are recorded');

-- another account cannot touch it
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000004d2","user_role":"customer"}';
select throws_ok($$ select public.self_assessment_save_fitting((select id from sv), '{"unit_label":"1","fitting_type_id":"40000000-0000-0000-0000-0000000004f1"}') $$,
  '42501', null, 'BR-S10: another account''s self-assessment is denied');

set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000004d1","user_role":"customer"}';
select lives_ok($$ select public.submit_self_assessment((select id from sv)) $$, 'BR-S10: submit with every photo');
select throws_ok($$ select public.self_assessment_save_fitting((select id from sv), '{"unit_label":"102","fitting_type_id":"40000000-0000-0000-0000-0000000004f1"}') $$,
  '22023', null, 'BR-S10: a submitted self-assessment is locked');

reset role;
select is((select row(status, review_status, review_due_at > now() + interval '23 hours')::text from public.surveys where id = (select id from sv)),
  '(submitted,awaiting,t)', 'BR-S11: submission starts the 24-hour clock');
select is((select status::text from public.leads where id = '20000000-0000-0000-0000-0000000004b1'), 'surveyed', 'the lead moves to surveyed');

-- pricing: a surveyor who is not the reviewer cannot; the assigned reviewer can and quotes it
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000004b2","user_role":"surveyor"}';
select throws_ok(format($$ select public.upsert_assessment('{"fitting_id":"%s","recommended":"restore_finish"}') $$, (select id from f)),
  '42501', null, 'a surveyor who is not the reviewer cannot price it');
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000004a1","user_role":"super_admin"}';
select public.assign_self_assessment_reviewer((select id from sv), '00000000-0000-0000-0000-0000000004b1');
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000004b1","user_role":"surveyor"}';
select lives_ok(format($$ select public.upsert_assessment('{"fitting_id":"%s","recommended":"restore_finish"}') $$, (select id from f)),
  'ADR-015: the reviewer prices it with the same upsert_assessment');
select isnt((select public.create_quote_from_survey((select id from sv))), null, '…and quotes it with create_quote_from_survey');
reset role;
select is((select review_status from public.surveys where id = (select id from sv)), 'priced', 'BR-S11: the quotation closes the review');

-- SLA sweep: an overdue, unquoted self-assessment alerts once
update public.surveys set review_status = 'awaiting', review_due_at = now() - interval '1 hour' where id = (select id from sv);
select is(public.sweep_self_assessment_sla(), 1, 'BR-S11: an overdue self-assessment raises an alert');
select is(public.sweep_self_assessment_sla(), 0, '…once');

-- staff start a remote assessment for a brand-new enquiry: no address needed (BR-S8 is on-site only)
insert into public.leads (id, phone, name, source_id, customer_type, business_name, assigned_to) values
  ('20000000-0000-0000-0000-0000000004b2', '+919700000493', 'Raj', (select id from public.lead_sources where code = 'call'), 'hotel',
   'Hotel Faraway', '00000000-0000-0000-0000-0000000004c1');
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000004c1","user_role":"cc_exec"}';
select lives_ok($$ select public.start_self_assessment('20000000-0000-0000-0000-0000000004b2') $$,
  'the executive starts a self-assessment for a new enquiry without an address');
reset role;

select * from finish();
rollback;
