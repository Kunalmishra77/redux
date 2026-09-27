-- E3-S01 … E3-S05 · lead rules BR-L1 … BR-L8, permission test P3.
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

-- ── fixtures ───────────────────────────────────────────────────────────────
insert into public.cities (id, name, state_code) values
  ('10000000-0000-0000-0000-00000000000a', 'Leads Test City A', '07'),
  ('10000000-0000-0000-0000-00000000000b', 'Leads Test City B', '06');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'exec1@test.local'),
  ('00000000-0000-0000-0000-0000000000c2', 'exec2@test.local'),
  ('00000000-0000-0000-0000-0000000000f1', 'portal@test.local');
insert into public.profiles (id, full_name, city_id) values
  ('00000000-0000-0000-0000-0000000000a1', 'Admin', null),
  ('00000000-0000-0000-0000-0000000000c1', 'Exec One', '10000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-0000000000c2', 'Exec Two', '10000000-0000-0000-0000-00000000000a');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'super_admin'),
  ('00000000-0000-0000-0000-0000000000c1', 'cc_exec'),
  ('00000000-0000-0000-0000-0000000000c2', 'cc_exec');

-- Only our two test executives may be picked, even if staging has real ones
update public.profiles set is_active = false
where id not in ('00000000-0000-0000-0000-0000000000a1',
                 '00000000-0000-0000-0000-0000000000c1',
                 '00000000-0000-0000-0000-0000000000c2')
  and id in (select user_id from public.user_roles where role = 'cc_exec');

insert into public.campaigns (id, source_id, name)
select '20000000-0000-0000-0000-000000000001', id, 'Test campaign' from public.lead_sources where code = 'google_ads';

set local request.jwt.claims = '{"role":"service_role"}';

-- ── BR-L1 / BR-L2: dedup by phone into touches, first-touch attribution ────
select is(public.ingest_lead('{"phone":"+919810000001","source":"google_ads","city_id":"10000000-0000-0000-0000-00000000000a","campaign_id":"20000000-0000-0000-0000-000000000001"}') ->> 'created',
  'true', 'BR-L1: first enquiry creates a lead');
select is(public.ingest_lead('{"phone":"+919810000001","source":"whatsapp_chat","name":"Ravi"}') ->> 'created',
  'false', 'BR-L1: same number from another source does not create a second lead');
select is((select count(*)::int from public.leads where phone = '+919810000001'), 1, 'BR-L1: one lead row');
select is((select count(*)::int from public.lead_touches t join public.leads l on l.id = t.lead_id
           where l.phone = '+919810000001'), 2, 'BR-L1: two touches, one per enquiry');
select is((select s.code from public.leads l join public.lead_sources s on s.id = l.source_id
           where l.phone = '+919810000001'), 'google_ads', 'BR-L2: lead keeps its first-touch source');
select is((select name from public.leads where phone = '+919810000001'), 'Ravi',
  'a later touch fills a missing name');

-- ── BR-L4: by city, round-robin within it, wrap-around ─────────────────────
select is((select assigned_to from public.leads where phone = '+919810000001'),
  '00000000-0000-0000-0000-0000000000c1'::uuid, 'BR-L4: city lead goes to the first city executive');
select public.ingest_lead('{"phone":"+919810000002","source":"website","city_id":"10000000-0000-0000-0000-00000000000a"}');
select public.ingest_lead('{"phone":"+919810000003","source":"website","city_id":"10000000-0000-0000-0000-00000000000a"}');
select is((select assigned_to from public.leads where phone = '+919810000002'),
  '00000000-0000-0000-0000-0000000000c2'::uuid, 'BR-L4: next city lead goes to the next executive');
select is((select assigned_to from public.leads where phone = '+919810000003'),
  '00000000-0000-0000-0000-0000000000c1'::uuid, 'BR-L4: round-robin wraps around');
select public.ingest_lead('{"phone":"+919810000004","source":"website","city_id":"10000000-0000-0000-0000-00000000000b"}');
select ok((select assigned_to from public.leads where phone = '+919810000004') in
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2'),
  'BR-L4: a city nobody covers falls back to the global round-robin');

-- ── BR-L5: SLA from creation ───────────────────────────────────────────────
select is((select sla_due_at - created_at from public.leads where phone = '+919810000001'),
  interval '60 minutes', 'BR-L5: SLA due = created_at + sla_callback_minutes');

-- ── idempotency and input validation ───────────────────────────────────────
select public.ingest_lead('{"phone":"+919810000005","source":"meta_lead_ad","meta_leadgen_id":"LG-1"}');
select is(public.ingest_lead('{"phone":"+919810000005","source":"meta_lead_ad","meta_leadgen_id":"LG-1"}') ->> 'created',
  'false', 'a redelivered leadgen_id returns the same lead');
select is((select count(*)::int from public.lead_touches t join public.leads l on l.id = t.lead_id
           where l.meta_leadgen_id = 'LG-1'), 1, '… and adds no touch');
select throws_ok($$ select public.ingest_lead('{"phone":"9810000006","source":"website"}') $$,
  '22023', null, 'a non-E.164 phone is rejected');

-- ── BR-L3: attribution immutable, even for super_admin ─────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","user_role":"super_admin"}';
select throws_ok($$ update public.leads set campaign_id = null where phone = '+919810000001' $$,
  '42501', null, 'BR-L3: campaign_id cannot change');
select throws_ok($$ update public.leads set ctwa_clid = 'x' where phone = '+919810000001' $$,
  '42501', null, 'BR-L3: ctwa_clid cannot change');

-- ── P3 and executive limits ────────────────────────────────────────────────
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c2","user_role":"cc_exec"}';
select is((select count(*)::int from public.leads where phone = '+919810000001'), 0,
  'P3: an executive cannot see another executive''s lead');
select is((select count(*)::int from public.lead_touches t
           where t.lead_id in (select id from public.leads where phone = '+919810000001')), 0,
  'P3: … nor its touches');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","user_role":"cc_exec"}';
select is((select count(*)::int from public.leads where phone = '+919810000001'), 1,
  'an executive sees their own lead');
select throws_ok(
  $$ update public.leads set assigned_to = '00000000-0000-0000-0000-0000000000c2' where phone = '+919810000001' $$,
  '42501', null, 'an executive cannot hand a lead to someone else');
select throws_ok($$ update public.leads set sla_due_at = now() + interval '1 day' where phone = '+919810000001' $$,
  '42501', null, 'BR-L5: an executive cannot move the SLA clock');
select throws_ok($$ update public.leads set status = 'survey_booked' where phone = '+919810000001' $$,
  '42501', null, 'BR-L6: survey_booked cannot be set by hand');

-- ── BR-L7 / BR-L8: lost needs a reason; reopen keeps history ───────────────
select throws_ok($$ update public.leads set status = 'lost' where phone = '+919810000001' $$,
  '23514', null, 'BR-L7: lost without a reason is rejected');
select throws_ok(
  $$ update public.leads set status = 'lost', lost_reason_id = (select id from public.lost_reasons where code = 'other')
     where phone = '+919810000001' $$,
  '23514', null, 'BR-L7: reason "other" needs a note');
update public.leads set status = 'lost', lost_reason_id = (select id from public.lost_reasons where code = 'price')
where phone = '+919810000001';
update public.leads set status = 'contacted' where phone = '+919810000001';
select is(
  -- one transaction → identical now(); compare the set of events, not their timestamps
  (select array_agg(to_status::text || coalesce(':' || note, '') order by to_status::text)
   from public.lead_status_history h join public.leads l on l.id = h.lead_id where l.phone = '+919810000001'),
  array['contacted','lost:Lost: Price','new'],
  'BR-L8: lost (with its reason) and reopen are both in the timeline');

-- ── Decision 27 Sep 2026: a repeat enquiry after won starts a new lead ──────
reset role;
set local request.jwt.claims = '{"role":"service_role"}';
update public.leads set status = 'won' where phone = '+919810000002';
select is(public.ingest_lead('{"phone":"+919810000002","source":"call"}') ->> 'created', 'true',
  'after won, a repeat enquiry creates a new lead');
select is(
  (select n.previous_lead_id from public.leads n
   where n.phone = '+919810000002' and n.status = 'new'),
  (select o.id from public.leads o where o.phone = '+919810000002' and o.status = 'won'),
  '… linked to the closed lead');

-- ── BR-L4: deactivation hands open leads over ──────────────────────────────
update public.profiles set is_active = false where id = '00000000-0000-0000-0000-0000000000c1';
select is((select count(*)::int from public.leads
           where assigned_to = '00000000-0000-0000-0000-0000000000c1' and status not in ('won','lost')),
  0, 'BR-L4: a deactivated executive keeps no open leads');

-- ── Who may ingest ─────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c2","user_role":"cc_exec"}';
select public.ingest_lead('{"phone":"+919810000008","source":"walk_in"}');
select is((select assigned_to from public.leads where phone = '+919810000008'),
  '00000000-0000-0000-0000-0000000000c2'::uuid, 'manual entry stays with the executive who took it');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","user_role":"customer"}';
select throws_ok($$ select public.ingest_lead('{"phone":"+919810000007","source":"website"}') $$,
  '42501', null, 'a customer cannot create leads');

select * from finish();
rollback;
