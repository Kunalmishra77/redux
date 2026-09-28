-- §14 service requests · D13-07 · E-Commerce Rules clock (48 h ack, 1 month resolve) · P1.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'exec1@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'surveyor1@test.local'),
  ('00000000-0000-0000-0000-0000000000f1', 'portal1@test.local'),
  ('00000000-0000-0000-0000-0000000000f2', 'portal2@test.local');
insert into public.profiles (id, full_name) values
  ('00000000-0000-0000-0000-0000000000c1', 'Exec'), ('00000000-0000-0000-0000-0000000000b1', 'Surveyor');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000c1', 'cc_exec'), ('00000000-0000-0000-0000-0000000000b1', 'surveyor');
insert into public.customers (id, name, type, is_prospect, converted_at) values
  ('30000000-0000-0000-0000-00000000000a', 'Hotel A', 'hotel', false, now()),
  ('30000000-0000-0000-0000-00000000000b', 'Hotel B', 'hotel', false, now());
insert into public.customer_contacts (customer_id, user_id, name, phone) values
  ('30000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000f1', 'CE A', '+919900000001'),
  ('30000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000f2', 'CE B', '+919900000002');
insert into public.properties (id, customer_id, name, address) values
  ('31000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-00000000000a', 'Hotel A', 'Road A'),
  ('31000000-0000-0000-0000-00000000000b', '30000000-0000-0000-0000-00000000000b', 'Hotel B', 'Road B');

create temp table t (k text primary key, v uuid) on commit drop;
grant all on t to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000f1","user_role":"customer"}';
insert into t select 'sr', (r ->> 'id')::uuid from (select public.raise_service_request(
  '{"property_id":"31000000-0000-0000-0000-00000000000a","subject":"Mixer in 204 dripping again"}') r) s;
select isnt((select v from t where k = 'sr'), null, 'D13-07: a customer raises a service request from the portal');
select ok((select request_no ~ '^SR-\d{4}-\d{5}$' from public.service_requests where id = (select v from t where k = 'sr')),
  'numbered SR-YYYY-NNNNN (a service request, never a "ticket")');
select is((select array[extract(epoch from ack_due_at - created_at) / 3600, extract(day from resolve_due_at - created_at)]
           from public.service_requests where id = (select v from t where k = 'sr')),
  array[48, 30]::numeric[], 'E-Commerce Rules: acknowledge within 48 h, resolve within a month');

select throws_ok($$ select public.raise_service_request('{"property_id":"31000000-0000-0000-0000-00000000000b","subject":"Not mine"}') $$,
  '42501', null, 'P1: a customer cannot raise against another customer''s property');
select throws_ok($$ select public.raise_service_request('{"customer_id":"30000000-0000-0000-0000-00000000000b","subject":"Not mine"}') $$,
  '42501', null, 'P1: … or on another customer''s account');
select throws_ok($$ select public.progress_service_request((select v from t where k = 'sr'), 'resolved', 'fixed myself') $$,
  '42501', null, 'a customer cannot mark their own request resolved');

set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000f2","user_role":"customer"}';
select is((select count(*)::int from public.service_requests), 0, 'P1: another customer sees none of it');

set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000b1","user_role":"surveyor"}';
select throws_ok($$ select public.raise_service_request('{"customer_id":"30000000-0000-0000-0000-00000000000a","subject":"x y z"}') $$,
  '42501', null, 'a surveyor does not raise service requests');

-- ── the care team ──────────────────────────────────────────────────────────
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000c1","user_role":"cc_exec"}';
select is((select count(*)::int from public.service_requests where id = (select v from t where k = 'sr')), 1,
  'TN12: the request lands in the shared care queue');
select public.progress_service_request((select v from t where k = 'sr'), 'acknowledged');
select ok((select status = 'acknowledged' and acknowledged_at is not null and assigned_to = '00000000-0000-0000-0000-0000000000c1'
           from public.service_requests where id = (select v from t where k = 'sr')),
  'acknowledging stamps the clock and assigns the executive');
select throws_ok($$ select public.progress_service_request((select v from t where k = 'sr'), 'open') $$,
  '22023', null, 'a request only moves forward');
select throws_ok($$ select public.progress_service_request((select v from t where k = 'sr'), 'resolved') $$,
  '23514', null, 'resolving needs a note on what was done');
select public.progress_service_request((select v from t where k = 'sr'), 'resolved', 'Cartridge replaced under warranty');
select ok((select resolved_at is not null from public.service_requests where id = (select v from t where k = 'sr')),
  'resolved, with the time recorded');
update public.service_requests set subject = 'edited' where id = (select v from t where k = 'sr');  -- no user write policy: 0 rows
select is((select subject from public.service_requests where id = (select v from t where k = 'sr')), 'Mixer in 204 dripping again',
  'nobody edits a request directly');

-- ── SLA view ───────────────────────────────────────────────────────────────
reset role;
set local request.jwt.claims = '{"role":"service_role"}';
insert into t select 'late', (r ->> 'id')::uuid from (select public.raise_service_request(
  '{"customer_id":"30000000-0000-0000-0000-00000000000b","subject":"Shower head loose"}') r) s;
update public.service_requests set ack_due_at = now() - interval '1 hour' where id = (select v from t where k = 'late');
select ok((select ack_overdue from public.v_service_requests_overdue where id = (select v from t where k = 'late')),
  'D13-07: an unacknowledged request past 48 h is flagged');
select is((select count(*)::int from public.v_service_requests_overdue where id = (select v from t where k = 'sr')), 0,
  '… a handled one is not');

select * from finish();
rollback;
