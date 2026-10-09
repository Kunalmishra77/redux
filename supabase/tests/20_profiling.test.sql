-- CR-001 phase 3 · account 360° profiling · D26.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000002a1', 'admin.prof@test.local'),
  ('00000000-0000-0000-0000-0000000002c1', 'owner.prof@test.local'),
  ('00000000-0000-0000-0000-0000000002c2', 'other.prof@test.local');
insert into public.profiles (id, full_name) values
  ('00000000-0000-0000-0000-0000000002a1', 'Admin'), ('00000000-0000-0000-0000-0000000002c1', 'Owner'),
  ('00000000-0000-0000-0000-0000000002c2', 'Other');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000002a1', 'super_admin'), ('00000000-0000-0000-0000-0000000002c1', 'cc_exec'),
  ('00000000-0000-0000-0000-0000000002c2', 'cc_exec');

insert into public.customers (id, name, type, is_prospect, converted_at, account_owner_id) values
  ('30000000-0000-0000-0000-0000000002a1', 'Hotel Profiled', 'hotel', false, now(), '00000000-0000-0000-0000-0000000002c1');
insert into public.leads (id, phone, source_id, customer_type, customer_id, assigned_to) values
  ('20000000-0000-0000-0000-0000000002b1', '+919700000281', (select id from public.lead_sources where code = 'call'), 'hotel',
   '30000000-0000-0000-0000-0000000002a1', '00000000-0000-0000-0000-0000000002c1');
insert into public.follow_ups (lead_id, assigned_to, due_at, note) values
  ('20000000-0000-0000-0000-0000000002b1', '00000000-0000-0000-0000-0000000002c1', now() + interval '1 day', 'Call the GM');
insert into public.whatsapp_conversations (id, wa_id, lead_id) values
  ('33000000-0000-0000-0000-0000000002a1', '919700000281', '20000000-0000-0000-0000-0000000002b1');
insert into public.whatsapp_messages (conversation_id, direction, body) values
  ('33000000-0000-0000-0000-0000000002a1', 'inbound', 'Can you also look at our second property?');

-- the summary exists for every account and starts at zero
select is((select row(lifetime_billed, jobs_total, first_source)::text from public.v_account_summary
  where customer_id = '30000000-0000-0000-0000-0000000002a1'), '(0,0,"Phone call")', 'summary: an account with no work yet');

-- the timeline now carries the conversation and the follow-up
select is((select count(*)::int from public.v_account_timeline
  where customer_id = '30000000-0000-0000-0000-0000000002a1' and kind = 'whatsapp' and title = 'WhatsApp from the customer'), 1,
  'timeline: an inbound WhatsApp shows on the account');
select is((select count(*)::int from public.v_account_timeline
  where customer_id = '30000000-0000-0000-0000-0000000002a1' and kind = 'follow_up'), 1, 'timeline: follow-ups show on the account');

-- who may edit requirements and next action
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000002c1","user_role":"cc_exec"}';
select lives_ok($$ select public.update_account_requirements('30000000-0000-0000-0000-0000000002a1',
  '{"current_requirements":"48 rooms, chrome dulling","next_action":"Send pilot proposal","next_action_at":"2026-10-20T10:00:00+05:30"}') $$,
  'the account owner can edit requirements');

set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000002c2","user_role":"cc_exec"}';
select throws_ok($$ select public.update_account_requirements('30000000-0000-0000-0000-0000000002a1', '{"next_action":"x"}') $$,
  '42501', null, 'an executive not working the account cannot');

set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000002a1","user_role":"super_admin"}';
select lives_ok($$ select public.update_account_requirements('30000000-0000-0000-0000-0000000002a1', '{"future_requirements":"Second property in 2027"}') $$,
  'the Super Admin can edit any account');

reset role;
select is((select row(current_requirements, next_action, future_requirements)::text from public.customers
  where id = '30000000-0000-0000-0000-0000000002a1'),
  '("48 rooms, chrome dulling","Send pilot proposal","Second property in 2027")', 'edits merge, keys not sent are kept');
select is((select next_action_at from public.customers where id = '30000000-0000-0000-0000-0000000002a1'),
  '2026-10-20T10:00:00+05:30'::timestamptz, 'the next action date is stored');

-- a customer cannot call it
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000001ff","user_role":"customer"}';
select throws_ok($$ select public.update_account_requirements('30000000-0000-0000-0000-0000000002a1', '{"next_action":"x"}') $$,
  '42501', null, 'a customer cannot edit the CRM profile');

select * from finish();
rollback;
