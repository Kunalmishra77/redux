-- §7 customers/properties · BR-S8 prospects · portal isolation (P1, partial) · review item 13.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

-- ── fixtures ───────────────────────────────────────────────────────────────
insert into public.cities (id, name, state_code) values
  ('10000000-0000-0000-0000-00000000000a', 'Cust Test City A', '07');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'exec1@test.local'),
  ('00000000-0000-0000-0000-0000000000c2', 'exec2@test.local'),
  ('00000000-0000-0000-0000-0000000000f1', 'portal1@test.local'),
  ('00000000-0000-0000-0000-0000000000f2', 'portal2@test.local');
insert into public.profiles (id, full_name, city_id) values
  ('00000000-0000-0000-0000-0000000000a1', 'Admin', null),
  ('00000000-0000-0000-0000-0000000000c1', 'Exec One', '10000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-0000000000c2', 'Exec Two', null);
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'super_admin'),
  ('00000000-0000-0000-0000-0000000000c1', 'cc_exec'),
  ('00000000-0000-0000-0000-0000000000c2', 'cc_exec');
update public.profiles set is_active = false
where id not in ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000c2')
  and id in (select user_id from public.user_roles where role = 'cc_exec');

set local request.jwt.claims = '{"role":"service_role"}';
select public.ingest_lead('{"phone":"+919820000001","source":"website","name":"Anita","customer_type":"hotel","property_name":"The Grand Orchid","city_id":"10000000-0000-0000-0000-00000000000a","enquirer_role":"Chief Engineer"}');

-- Executives can't see each other's leads, so keep the id where every role can read it
create temp table t on commit drop as
  select id as lead_id from public.leads where phone = '+919820000001';
grant select on t to authenticated;

-- ── BR-S8: booking creates a prospect customer + property ──────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c2","user_role":"cc_exec"}';
select throws_ok(
  $ select public.ensure_prospect((select lead_id from t), '{"address":"1 MG Road"}') $,
  '42501', null, 'P3: another executive cannot book for this lead');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","user_role":"cc_exec"}';
select throws_ok(
  $$ select public.ensure_prospect(null, '{"address":"x"}') $$,
  'P0002', null, 'an unknown lead is rejected');

select throws_ok(
  $$ select public.ensure_prospect((select lead_id from t), '{"name":"Orchid"}') $$,
  '22023', null, 'BR-S8: a survey needs the property address');

select is(
  public.ensure_prospect((select lead_id from t),
    '{"address":"12 Janpath, New Delhi","lat":"28.6139","lng":"77.2090"}') ->> 'created_customer',
  'true', 'BR-S8: first booking creates a prospect customer');

select is((select name from public.customers where lead_id = (select lead_id from t)), 'The Grand Orchid',
  'a hotel customer is named after the property');
select ok((select is_prospect from public.customers where lead_id = (select lead_id from t)),
  '… and is a prospect');
select is((select unit_label from public.properties p join public.customers c on c.id = p.customer_id
           where c.lead_id = (select lead_id from t)), 'Room', 'hotel units are Rooms (glossary)');
select is((select role_title from public.customer_contacts cc join public.customers c on c.id = cc.customer_id
           where c.lead_id = (select lead_id from t) and cc.is_primary), 'Chief Engineer',
  'the enquirer becomes the primary contact');

select is(
  public.ensure_prospect((select lead_id from t), '{"address":"Annexe, 14 Janpath"}') ->> 'created_customer',
  'false', 'a second booking reuses the customer');
select is((select count(*)::int from public.properties p join public.customers c on c.id = p.customer_id
           where c.lead_id = (select lead_id from t)), 2, '… and adds a second property');

-- ── Visibility ─────────────────────────────────────────────────────────────
select is((select count(*)::int from public.customers where lead_id = (select lead_id from t)), 1,
  'the owning executive sees their prospect');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c2","user_role":"cc_exec"}';
select is((select count(*)::int from public.customers where lead_id = (select lead_id from t)), 0,
  'P3: another executive cannot see someone else''s prospect');

-- Convert (approval, Phase 2 does this) → every executive can see the customer's job context
reset role;
update public.customers set is_prospect = false, converted_at = now() where lead_id = (select lead_id from t);
set local role authenticated;
select is((select count(*)::int from public.customers where lead_id = (select lead_id from t)), 1,
  'a converted customer is visible to every executive (roles matrix: track job status)');

-- ── Repeat customer: a new lead after won reuses the customer ──────────────
reset role;
set local request.jwt.claims = '{"role":"service_role"}';
update public.leads set status = 'won' where id = (select lead_id from t);
select public.ingest_lead('{"phone":"+919820000001","source":"call"}');
select is(
  public.ensure_prospect(
    (select id from public.leads where phone = '+919820000001' and status = 'new'),
    '{"address":"Orchid Jaipur, MI Road"}') ->> 'created_customer',
  'false', 'a returning customer is reused, not duplicated as a prospect');

-- ── Portal isolation (P1) and item 13: one phone, several customers ────────
insert into public.customers (id, name, type, is_prospect, converted_at) values
  ('30000000-0000-0000-0000-000000000001', 'Hotel One', 'hotel', false, now()),
  ('30000000-0000-0000-0000-000000000002', 'Hotel Two', 'hotel', false, now()),
  ('30000000-0000-0000-0000-000000000003', 'Hotel Three', 'hotel', false, now());
insert into public.customer_contacts (customer_id, user_id, name, phone) values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f1', 'CE', '+919830000001'),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000f1', 'CE', '+919830000001'),
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000f2', 'GM', '+919830000002');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","user_role":"customer"}';
select is((select array_agg(name order by name) from public.customers), array['Hotel One','Hotel Two'],
  'item 13: a contact of two hotels sees both');
select is((select count(*)::int from public.customers where name = 'Hotel Three'), 0,
  'P1: … and never another customer''s record');
update public.customers set name = 'Hacked' where id = '30000000-0000-0000-0000-000000000001'; -- RLS: 0 rows
reset role;
select is((select name from public.customers where id = '30000000-0000-0000-0000-000000000001'), 'Hotel One',
  'a customer cannot edit the customer record');

select * from finish();
rollback;
