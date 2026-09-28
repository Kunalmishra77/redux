-- §6 calls · D4-02/03 · roles matrix "call recordings: super_admin all, cc_exec own calls".
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'exec1@test.local'),
  ('00000000-0000-0000-0000-0000000000c2', 'exec2@test.local');
insert into public.profiles (id, full_name) values
  ('00000000-0000-0000-0000-0000000000a1', 'Admin'),
  ('00000000-0000-0000-0000-0000000000c1', 'Exec One'),
  ('00000000-0000-0000-0000-0000000000c2', 'Exec Two');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'super_admin'),
  ('00000000-0000-0000-0000-0000000000c1', 'cc_exec'),
  ('00000000-0000-0000-0000-0000000000c2', 'cc_exec');

-- A lead owned by exec 1 (manual entry keeps it with the executive who took it)
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","user_role":"cc_exec"}';
select public.ingest_lead('{"phone":"+919840000001","source":"call"}');

select is(
  (select s.code from public.call_outcomes s order by sort_order limit 1), 'interested',
  'executives read the outcome list');

select throws_ok(
  $$ insert into public.calls (lead_id, agent_id, direction, started_at)
     select id, '00000000-0000-0000-0000-0000000000c1', 'outbound', now() from public.leads
     where phone = '+919840000001' $$,
  '42501', null, 'calls cannot be inserted directly — only through log_call()');

select lives_ok(
  $$ select public.log_call(jsonb_build_object(
       'lead_id', (select id from public.leads where phone = '+919840000001'),
       'outcome', 'no_answer',
       'started_at', '2026-10-12T10:00:00+05:30', 'ended_at', '2026-10-12T10:00:25+05:30')) $$,
  'D4-02: an executive logs a call on their own lead');
select is((select status::text from public.leads where phone = '+919840000001'), 'new',
  '"no answer" does not mark the lead contacted');
select is((select duration_sec from public.calls c join public.leads l on l.id = c.lead_id
           where l.phone = '+919840000001'), 25, 'duration is derived from start and end');

select public.log_call(jsonb_build_object(
  'lead_id', (select id from public.leads where phone = '+919840000001'), 'outcome', 'interested'));
select is((select status::text from public.leads where phone = '+919840000001'), 'contacted',
  'reaching the person moves a new lead to contacted');

select throws_ok(
  $$ select public.log_call(jsonb_build_object(
       'lead_id', (select id from public.leads where phone = '+919840000001'), 'outcome', 'other')) $$,
  '23514', null, 'D4-03: an outcome that needs a reason is rejected without one');

-- ── exec 2 ─────────────────────────────────────────────────────────────────
reset role;
create temp table t on commit drop as select id as lead_id from public.leads where phone = '+919840000001';
grant select on t to authenticated;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c2","user_role":"cc_exec"}';

select throws_ok(
  $$ select public.log_call(jsonb_build_object('lead_id', (select lead_id from t), 'outcome', 'interested')) $$,
  '42501', null, 'P3: an executive cannot log a call on another executive''s lead');
select is((select count(*)::int from public.calls), 0, 'an executive sees only their own calls');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","user_role":"super_admin"}';
select is((select count(*)::int from public.calls where lead_id = (select lead_id from t)), 2,
  'super_admin sees every call');

select * from finish();
rollback;
