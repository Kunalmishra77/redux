-- CR-001 phase 4a · scoring and the assessment decision · BR-SC1…SC3, BR-S9, ADR-018.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000003a1', 'admin.score@test.local'),
  ('00000000-0000-0000-0000-0000000003c1', 'exec.score@test.local'),
  ('00000000-0000-0000-0000-0000000003c2', 'exec2.score@test.local');
insert into public.profiles (id, full_name) values
  ('00000000-0000-0000-0000-0000000003a1', 'Admin'), ('00000000-0000-0000-0000-0000000003c1', 'Exec'),
  ('00000000-0000-0000-0000-0000000003c2', 'Exec 2');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000003a1', 'super_admin'), ('00000000-0000-0000-0000-0000000003c1', 'cc_exec'),
  ('00000000-0000-0000-0000-0000000003c2', 'cc_exec');

-- pure evaluation (also the admin preview)
select is((public.evaluate_score('{"units": 45, "segment": "hotel"}') ->> 'tier'), 'A', 'BR-SC2: a 45-room hotel is A');
select is((public.evaluate_score('{"units": 20}') ->> 'tier'), 'B', 'BR-SC2: 20 rooms is B');
select is((public.evaluate_score('{"units": 4, "segment": "office"}') ->> 'tier'), 'C', 'BR-SC2: 4 rooms is C');
select is((public.evaluate_score('{"value": 600000}') ->> 'tier'), 'A', 'BR-SC2: ₹6 lakh estimated is A');
select is((public.evaluate_score('{"units": 5, "group_member": true}') ->> 'tier'), 'A', 'BR-SC2: a hotel chain is A');
select is(jsonb_array_length(public.evaluate_score('{"units": 45, "segment": "hotel"}') -> 'breakdown'), 2,
  'BR-SC1: the breakdown names every rule that scored');

-- geography
select is(public.locate('122002', null) ->> 'band', 'near', 'Gurugram pincode is near the Delhi hub');
select is(public.locate('411001', null) ->> 'band', 'far', 'Pune is far');
select is(public.locate(null, null) ->> 'band', 'unknown', 'no location is unknown');

-- a real lead is scored and decided on insert
insert into public.leads (id, phone, source_id, customer_type, estimated_units, pincode, assigned_to) values
  ('20000000-0000-0000-0000-0000000003b1', '+919700000391', (select id from public.lead_sources where code = 'call'), 'hotel', 48, '411001',
   '00000000-0000-0000-0000-0000000003c1');
select is((select row(tier, distance_band, assessment_mode, demo_offer)::text from public.leads where id = '20000000-0000-0000-0000-0000000003b1'),
  '(A,far,video,room_demo)', 'BR-S9: an A-tier lead in Pune gets a remote assessment with a room demo');
select is((select count(*)::int from public.lead_scores where lead_id = '20000000-0000-0000-0000-0000000003b1'), 1, 'BR-SC1: scoring wrote its history');
select throws_ok($$ update public.lead_scores set score = 0 where lead_id = '20000000-0000-0000-0000-0000000003b1' $$,
  null, null, 'BR-SC1: score history is append-only');

-- executive override of the mode, with a reason
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000003c1","user_role":"cc_exec"}';
select lives_ok($$ select public.override_assessment('20000000-0000-0000-0000-0000000003b1', 'onsite', null, 'GM insists; chain flagship') $$,
  'BR-S9: the executive overrides to on-site with a reason');
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000003c2","user_role":"cc_exec"}';
select throws_ok($$ select public.override_assessment('20000000-0000-0000-0000-0000000003b1', 'self', null, 'not mine') $$,
  '42501', null, 'another executive cannot');
select throws_ok($$ select public.override_lead_tier('20000000-0000-0000-0000-0000000003b1', 'C', 'no') $$,
  '42501', null, 'BR-SC3: an executive cannot override a tier');

-- manager override survives a rescore
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000003a1","user_role":"super_admin"}';
select public.override_lead_tier('20000000-0000-0000-0000-0000000003b1', 'B', 'Budget confirmed small');
reset role;
update public.leads set estimated_units = 60 where id = '20000000-0000-0000-0000-0000000003b1';
select is((select row(tier, assessment_mode)::text from public.leads where id = '20000000-0000-0000-0000-0000000003b1'),
  '(B,onsite)', 'BR-SC3: the tier override survives rescoring; the mode override stays too');
select is((select override_reason from public.lead_scores where lead_id = '20000000-0000-0000-0000-0000000003b1' order by created_at desc limit 1),
  'Budget confirmed small', 'BR-SC3: the override reason is in the history');

select * from finish();
rollback;
