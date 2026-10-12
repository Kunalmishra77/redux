-- CR-001 phase 10 · lifecycle reports · D33.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000009a1', 'admin.rep@test.local'),
  ('00000000-0000-0000-0000-0000000009c1', 'exec.rep@test.local');
insert into public.profiles (id, full_name) values
  ('00000000-0000-0000-0000-0000000009a1', 'Admin'), ('00000000-0000-0000-0000-0000000009c1', 'Report Exec');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000009a1', 'super_admin'), ('00000000-0000-0000-0000-0000000009c1', 'cc_exec');

-- two leads for the executive: one A-tier, one C-tier
insert into public.leads (id, phone, source_id, customer_type, estimated_units, assigned_to) values
  ('20000000-0000-0000-0000-0000000009b1', '+919700000991', (select id from public.lead_sources where code = 'call'), 'hotel', 80, '00000000-0000-0000-0000-0000000009c1'),
  ('20000000-0000-0000-0000-0000000009b2', '+919700000992', (select id from public.lead_sources where code = 'call'), 'other', 2, '00000000-0000-0000-0000-0000000009c1');

create temp table since on commit drop as select now() - interval '1 hour' as t;
grant select on since to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000009c1","user_role":"cc_exec"}';
select throws_ok($$ select public.report_tiers((select t from since)) $$, '42501', null, 'reports are for the Super Admin');

set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000009a1","user_role":"super_admin"}';
select ok((select (e ->> 'leads')::int >= 1 from jsonb_array_elements(public.report_tiers((select t from since)) -> 'by_tier') e where e ->> 'tier' = 'A'),
  'by tier: the A-tier lead is counted');
select ok((select (e ->> 'leads')::int >= 1 from jsonb_array_elements(public.report_tiers((select t from since)) -> 'by_tier') e where e ->> 'tier' = 'C'),
  'by tier: the C-tier lead is counted');
select ok((select (e ->> 'leads')::int >= 2 from jsonb_array_elements(public.report_people((select t from since)) -> 'executives') e where e ->> 'person' = 'Report Exec'),
  'people: the executive has both leads');
select ok(public.report_assessments((select t from since)) ? 'by_mode', 'assessments report has the mode mix');
select ok(public.report_assessments((select t from since)) ? 'self_turnaround', '…and the self-assessment turnaround');
select is(jsonb_typeof(public.report_demos((select t from since)) -> 'funnel'), 'object', 'demos report has the funnel');
select ok(public.report_accounts() -> 'repeat' ? 'repeat_customers', 'accounts report has repeat customers');
select ok(public.report_referrals((select t from since)) -> 'totals' ? 'credit_issued', 'referrals report has rewards issued');
select is(jsonb_typeof(public.report_campaigns() -> 'campaigns'), 'array', 'campaigns report lists campaigns');
select is(jsonb_typeof(public.report_products((select t from since)) -> 'products'), 'array', 'products report lists fittings and work');
select is(jsonb_typeof(public.report_tiers((select t from since)) -> 'drift'), 'array', 'tier drift is listed');
reset role;

select * from finish();
rollback;
