-- §8 surveys · BR-S1…S8, BR-L6, P2, review items 4, 5, 10, 14.
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

-- ── fixtures ───────────────────────────────────────────────────────────────
insert into public.cities (id, name, state_code) values
  ('10000000-0000-0000-0000-00000000000a', 'Survey Test City A', '07');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'exec1@test.local'),
  ('00000000-0000-0000-0000-0000000000c2', 'exec2@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'surveyor1@test.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'surveyor2@test.local'),
  ('00000000-0000-0000-0000-0000000000f1', 'portal1@test.local'),
  ('00000000-0000-0000-0000-0000000000f2', 'portal2@test.local');
insert into public.profiles (id, full_name, city_id) values
  ('00000000-0000-0000-0000-0000000000a1', 'Admin',      null),
  ('00000000-0000-0000-0000-0000000000c1', 'Exec One',   '10000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-0000000000c2', 'Exec Two',   null),
  ('00000000-0000-0000-0000-0000000000b1', 'Surveyor One', '10000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-0000000000b2', 'Surveyor Two', null);
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'super_admin'),
  ('00000000-0000-0000-0000-0000000000c1', 'cc_exec'),
  ('00000000-0000-0000-0000-0000000000c2', 'cc_exec'),
  ('00000000-0000-0000-0000-0000000000b1', 'surveyor'),
  ('00000000-0000-0000-0000-0000000000b2', 'surveyor');
update public.profiles set is_active = false
where id in (select user_id from public.user_roles where role in ('cc_exec','surveyor'))
  and id not in ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000c2',
                 '00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000b2');
insert into public.fitting_types (id, code, name) values
  ('40000000-0000-0000-0000-000000000001', 'test_basin_mixer', 'Basin mixer');

set local request.jwt.claims = '{"role":"service_role"}';
select public.ingest_lead('{"phone":"+919850000001","source":"website","name":"Orchid GM","customer_type":"hotel","property_name":"The Grand Orchid","city_id":"10000000-0000-0000-0000-00000000000a"}');
select public.ingest_lead('{"phone":"+919850000002","source":"website","city_id":"10000000-0000-0000-0000-00000000000a"}');

-- ids every role can read
create temp table t (k text primary key, v uuid) on commit drop;
grant all on t to authenticated;
insert into t select 'lead', id from public.leads where phone = '+919850000001';
insert into t select 'lead2', id from public.leads where phone = '+919850000002';
create temp table slot on commit drop as
  select date_trunc('day', now()) + interval '3 days 10 hours' as at;   -- 3 days out, 10:00 UTC
grant select on slot to authenticated;

-- ── BR-S1: the survey is free ──────────────────────────────────────────────
select is((select count(*)::int from information_schema.columns
           where table_schema = 'public' and table_name = 'surveys'
             and column_name ~ '(price|amount|fee|charge|total|cost)'), 0,
  'BR-S1: surveys has no price-like column');

-- ── Booking (D4-04, BR-S8, BR-L6) ──────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","user_role":"cc_exec"}';

select is((select array_agg(full_name order by full_name) from public.available_surveyors(
             null, (select at from slot))), array['Surveyor One','Surveyor Two'],
  'D4-05: both surveyors are free before any booking');

insert into t select 'survey', (public.book_survey(jsonb_build_object(
  'lead_id', (select v from t where k = 'lead'),
  'surveyor_id', '00000000-0000-0000-0000-0000000000b1',
  'scheduled_at', (select at from slot),
  'property', jsonb_build_object('address', '12 Janpath, New Delhi', 'lat', 28.6139, 'lng', 77.2090)
)) ->> 'survey_id')::uuid;

select isnt((select v from t where k = 'survey'), null, 'D4-04: the executive books a free survey');
select is((select status::text from public.leads where id = (select v from t where k = 'lead')),
  'survey_booked', 'BR-L6: booking moves the lead to survey_booked');

select throws_ok(
  $$ select public.book_survey(jsonb_build_object(
       'lead_id', (select v from t where k = 'lead'), 'surveyor_id', '00000000-0000-0000-0000-0000000000b1',
       'scheduled_at', (select at from slot) + interval '1 hour',
       'property', jsonb_build_object('address', 'Annexe'))) $$,
  '23P01', null, 'BR-S2: an overlapping slot for the same surveyor is rejected (not just the same start)');

select lives_ok(
  $$ select public.book_survey(jsonb_build_object(
       'lead_id', (select v from t where k = 'lead'), 'surveyor_id', '00000000-0000-0000-0000-0000000000b1',
       'scheduled_at', (select at from slot) + interval '2 hours',
       'property', jsonb_build_object('address', 'Annexe'))) $$,
  'BR-S2: the back-to-back slot is fine');

select is((select array_agg(full_name) from public.available_surveyors(null, (select at from slot))),
  array['Surveyor Two'], 'D4-05: the booked surveyor is no longer offered for that slot');

select throws_ok(
  $$ select public.book_survey(jsonb_build_object(
       'lead_id', (select v from t where k = 'lead'), 'surveyor_id', '00000000-0000-0000-0000-0000000000b2',
       'scheduled_at', now() - interval '1 day', 'property', jsonb_build_object('address', 'x'))) $$,
  '22023', null, 'a slot in the past is rejected');

-- ── BR-L6: no survey, no survey_booked ─────────────────────────────────────
reset role;
select throws_ok(
  $$ update public.leads set status = 'survey_booked' where id = (select v from t where k = 'lead2') $$,
  '23514', null, 'BR-L6: survey_booked without a survey is rejected, even for the system');

-- ── P2: surveyors see only their own visits ────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","user_role":"surveyor"}';
select is((select count(*)::int from public.surveys where id = (select v from t where k = 'survey')), 0,
  'P2: another surveyor cannot see the survey');
select is((select count(*)::int from public.leads where id = (select v from t where k = 'lead')), 0,
  '… nor its lead');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","user_role":"surveyor"}';
select is((select count(*)::int from public.surveys where id = (select v from t where k = 'survey')), 1,
  'the assigned surveyor sees the visit');
select is((select name from public.leads where id = (select v from t where k = 'lead')), 'Orchid GM',
  '… the lead behind it (to call ahead)');
select is((select address from public.properties p join public.surveys s on s.property_id = p.id
           where s.id = (select v from t where k = 'survey')), '12 Janpath, New Delhi',
  '… and the property to navigate to (D7-01)');

-- ── BR-S3 / BR-S4: check-in integrity ──────────────────────────────────────
insert into public.survey_checkins (survey_id, surveyor_id, idem_key, lat, lng, accuracy_m, checked_in_at, flagged)
values ((select v from t where k = 'survey'), '00000000-0000-0000-0000-0000000000b1', 'ci-1',
        28.6140, 77.2091, 120, (select at from slot), false);
select is((select flagged from public.survey_checkins where idem_key = 'ci-1'), true,
  'BR-S3: 120 m accuracy is flagged (the client cannot send flagged = false)');
select is((select geofence_ok from public.survey_checkins where idem_key = 'ci-1'), true,
  'BR-S4: a check-in at the property is inside the geofence');
select is((select status::text from public.surveys where id = (select v from t where k = 'survey')),
  'checked_in', 'a check-in moves the survey to checked_in');

insert into public.survey_checkins (survey_id, surveyor_id, idem_key, lat, lng, accuracy_m, checked_in_at)
values ((select v from t where k = 'survey'), '00000000-0000-0000-0000-0000000000b1', 'ci-2',
        28.7041, 77.1025, 10, (select at from slot) + interval '1 minute');
select ok((select not geofence_ok and flag_reason ~ 'Impossible travel'
           from public.survey_checkins where idem_key = 'ci-2'),
  'BR-S4: 14 km in one minute is flagged as impossible travel and outside the geofence');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","user_role":"surveyor"}';
select throws_ok(
  $$ insert into public.survey_checkins (survey_id, surveyor_id, idem_key, lat, lng, checked_in_at)
     values ((select v from t where k = 'survey'), '00000000-0000-0000-0000-0000000000b2', 'ci-x', 28.6, 77.2, now()) $$,
  '42501', null, 'P2: another surveyor cannot check in on this survey');

-- ── Fittings, photos, submit (BR-S5, BR-S7, items 4 and 10) ─────────────────
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","user_role":"surveyor"}';
insert into public.fittings (id, survey_id, unit_label, fitting_type_id, idem_key, captured_at)
values ('50000000-0000-0000-0000-000000000001', (select v from t where k = 'survey'), '204',
        '40000000-0000-0000-0000-000000000001', 'fit-1', now());

select throws_ok($$ select public.submit_survey((select v from t where k = 'survey')) $$,
  '23514', null, 'BR-S5: submit is rejected while a fitting has no photos');

insert into public.fitting_photos (fitting_id, slot, storage_path, sha256, captured_at)
select '50000000-0000-0000-0000-000000000001', s, 'p/' || s, repeat(h, 64), now()
from (values ('front','a'), ('side','b'), ('top','c')) v(s, h);
select throws_ok($$ select public.submit_survey((select v from t where k = 'survey')) $$,
  '23514', null, 'BR-S5: three of four slots is still rejected');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","user_role":"surveyor"}';
select throws_ok($$ select public.submit_survey((select v from t where k = 'survey')) $$,
  '42501', null, 'only the assigned surveyor can submit');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","user_role":"surveyor"}';
insert into public.fitting_photos (fitting_id, slot, storage_path, sha256, captured_at)
values ('50000000-0000-0000-0000-000000000001', 'close_up', 'p/close_up', repeat('d', 64), now());
select is((select count(*)::int from public.v_incomplete_fittings
           where survey_id = (select v from t where k = 'survey')), 0,
  'all four slots filled → no incomplete fittings');
select lives_ok($$ select public.submit_survey((select v from t where k = 'survey')) $$,
  'BR-S5: with all four slots the survey submits');
select is((select status::text from public.leads where id = (select v from t where k = 'lead')),
  'surveyed', 'BR-L6: a submitted survey moves the lead to surveyed');

update public.fitting_photos set storage_path = 'overwritten' where fitting_id = '50000000-0000-0000-0000-000000000001';
delete from public.fitting_photos where fitting_id = '50000000-0000-0000-0000-000000000001';
delete from public.fittings where id = '50000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.fitting_photos
           where fitting_id = '50000000-0000-0000-0000-000000000001' and storage_path <> 'overwritten'), 4,
  'BR-S7 / item 4: photos cannot be overwritten or deleted, nor removed by deleting the fitting');

select throws_ok(
  $$ insert into public.fittings (survey_id, unit_label, fitting_type_id, idem_key, captured_at)
     values ((select v from t where k = 'survey'), '205', '40000000-0000-0000-0000-000000000001', 'fit-2', now()) $$,
  '42501', null, 'a submitted survey takes no more fittings');

-- ── Item 5: who sees the photos ────────────────────────────────────────────
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","user_role":"surveyor"}';
select is((select count(*)::int from public.fitting_photos), 0, 'item 5: another surveyor sees no photos');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c2","user_role":"cc_exec"}';
select is((select count(*)::int from public.fitting_photos
           where fitting_id = '50000000-0000-0000-0000-000000000001'), 0,
  'item 5: an executive who does not own the lead sees no photos');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","user_role":"cc_exec"}';
select is((select count(*)::int from public.fitting_photos
           where fitting_id = '50000000-0000-0000-0000-000000000001'), 4,
  'the executive who owns the lead sees them');

-- Customer: convert (approval does this in Phase 2) and link a portal login
reset role;
update public.customers set is_prospect = false, converted_at = now()
where lead_id = (select v from t where k = 'lead');
update public.customer_contacts set user_id = '00000000-0000-0000-0000-0000000000f1'
where customer_id = (select id from public.customers where lead_id = (select v from t where k = 'lead'));
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","user_role":"customer"}';
select is((select count(*)::int from public.fitting_photos
           where fitting_id = '50000000-0000-0000-0000-000000000001'), 4,
  'D13-03: the customer sees the photos of their own fittings');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f2","user_role":"customer"}';
select is((select count(*)::int from public.fitting_photos), 0, 'P1: another customer sees none');

select * from finish();
rollback;
