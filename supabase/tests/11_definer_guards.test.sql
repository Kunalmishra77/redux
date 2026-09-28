-- Regression for the SECURITY DEFINER permission bug (found 28 Sep 2026, fixed in migration 001100):
-- inside a SECURITY DEFINER function current_user is the OWNER, so "current_user = 'authenticated'"
-- never fires. Structural check + each affected function called as the wrong role.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select is(
  array(select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.prosecdef and p.prosrc like '%current_user = ''authenticated''%'
        order by 1),
  '{}'::text[],
  'no SECURITY DEFINER function decides permissions from current_user (it is always the owner there)');

-- ── is_system_caller() ─────────────────────────────────────────────────────
set local request.jwt.claims = '{"role":"service_role"}';
select ok(public.is_system_caller(), 'service_role is the system');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","user_role":"super_admin"}';
select ok(not public.is_system_caller(), 'claims without a role are a user, never the system');
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000a1"}';
select ok(not public.is_system_caller(), 'an authenticated request is a user');

-- ── fixtures: one job with one unit ────────────────────────────────────────
set local request.jwt.claims = '';
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'exec1@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'surveyor1@test.local'),
  ('00000000-0000-0000-0000-0000000000f1', 'portal1@test.local');
insert into public.profiles (id, full_name) values
  ('00000000-0000-0000-0000-0000000000a1', 'Admin'), ('00000000-0000-0000-0000-0000000000c1', 'Exec'),
  ('00000000-0000-0000-0000-0000000000b1', 'Surveyor');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'super_admin'), ('00000000-0000-0000-0000-0000000000c1', 'cc_exec'),
  ('00000000-0000-0000-0000-0000000000b1', 'surveyor');
insert into public.customers (id, name, type, is_prospect, converted_at) values
  ('30000000-0000-0000-0000-000000000001', 'Guard Hotel', 'hotel', false, now());
insert into public.customer_contacts (customer_id, user_id, name, phone)
values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f1', 'GM', '+919890000001');
insert into public.properties (id, customer_id, name, address) values
  ('31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Guard Hotel', 'MG Road');
insert into public.property_units (id, property_id, label) values
  ('33000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '101');
insert into public.rate_cards (id, version, effective_from) values ('42000000-0000-0000-0000-000000000001', 9301, current_date);
insert into public.surveys (id, property_id, surveyor_id, scheduled_at, slot_end_at, status) values
  ('32000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1',
   now() - interval '9 days', now() - interval '9 days' + interval '2 hours', 'submitted');
insert into public.quotations (id, quote_no, survey_id, customer_id, property_id, rate_card_id, status, issued_at,
                               valid_until, terms_text, pdf_sha256) values
  ('60000000-0000-0000-0000-000000000001', 'Q-GUARD', '32000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
   '31000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-000000000001', 'approved', now(), current_date, 'T', repeat('a', 64));
insert into public.jobs (id, job_no, quotation_id, customer_id, property_id) values
  ('70000000-0000-0000-0000-000000000001', 'J-GUARD', '60000000-0000-0000-0000-000000000001',
   '30000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001');
insert into public.job_units (id, job_id, property_unit_id) values
  ('71000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '33000000-0000-0000-0000-000000000001');

-- ── the wrong roles ────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000f1","user_role":"customer"}';
select throws_ok($$ select public.move_unit_stage('71000000-0000-0000-0000-000000000001', 'removal_pickup') $$,
  '42501', null, 'a customer cannot move a job stage');
select throws_ok($$ select public.link_to_pilot('70000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'a customer cannot link projects');
select throws_ok($$ select public.create_invoice_from_job('70000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'a customer cannot raise an invoice');
select throws_ok($$ select public.issue_invoice(gen_random_uuid()) $$, '42501', null, 'a customer cannot issue an invoice');
select throws_ok($$ select public.cancel_invoice(gen_random_uuid(), 'x') $$, '42501', null, 'a customer cannot cancel an invoice');

set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000b1","user_role":"surveyor"}';
select throws_ok($$ select public.move_unit_stage('71000000-0000-0000-0000-000000000001', 'removal_pickup') $$,
  '42501', null, 'the job''s own surveyor cannot move stages either (super_admin only)');

set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000c1","user_role":"cc_exec"}';
select throws_ok($$ select public.create_invoice_from_job('70000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'an executive cannot raise an invoice …');
reset role;
select is((select count(*)::int from public.invoices where job_id = '70000000-0000-0000-0000-000000000001'), 0,
  '… and none was created');

select * from finish();
rollback;
