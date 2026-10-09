-- CR-001 phase 4c · the self-assessment form's lists for customers; settings stay staff-only.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into public.fitting_types (code, name) values ('pm_test_live', 'Live type');
insert into public.fitting_types (code, name, is_active) values ('pm_test_retired', 'Retired type', false);
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000005d1', 'cust.pm@test.local');

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000005d1","user_role":"customer"}';
select is((select count(*)::int from public.fitting_types where code = 'pm_test_live'), 1, 'a customer reads active fitting types');
select is((select count(*)::int from public.fitting_types where code = 'pm_test_retired'), 0, '…but not retired ones');
select is((select count(*)::int from public.settings), 0, 'settings stay staff-only');
select ok(public.self_assessment_turnaround_hours() > 0, 'the turnaround reaches the customer through a function');

select is((select count(*)::int from public.my_self_assessment_offers()), 0, 'a customer with no account has no offers');

select * from finish();
rollback;
