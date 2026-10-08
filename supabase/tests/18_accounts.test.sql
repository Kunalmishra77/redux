-- CR-001 phase 1 · accounts · BR-B1…B4, ADR-016, ADR-017.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'exec1@test.local');
insert into public.profiles (id, full_name) values
  ('00000000-0000-0000-0000-0000000000a1', 'Admin'), ('00000000-0000-0000-0000-0000000000c1', 'Exec');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'super_admin'), ('00000000-0000-0000-0000-0000000000c1', 'cc_exec');

-- masters and switches
select is((select count(*)::int from public.segments where code in ('hotel','hospital','office','home')), 4, 'segments seeded');
select is((select is_b2c from public.segments where code = 'home'), true, 'home is the B2C segment');
select is((select value #>> '{}' from public.settings where key = 'b2c_enabled'), 'false', 'BR-B3: B2C is off');

-- an existing, converted account with a known contact
insert into public.customers (id, name, type, is_prospect, converted_at) values
  ('30000000-0000-0000-0000-0000000001a1', 'Radisson Blu Dwarka', 'hotel', false, now());
insert into public.customer_contacts (customer_id, name, phone, is_primary) values
  ('30000000-0000-0000-0000-0000000001a1', 'Sanjay Gupta', '+919700000181', true);

-- BR-B1: the known contact enquires again → the new lead is linked to the account
insert into public.leads (id, phone, source_id, customer_type) values
  ('20000000-0000-0000-0000-0000000001b1', '+919700000181', (select id from public.lead_sources where code = 'call'), 'hotel');
select is((select customer_id from public.leads where id = '20000000-0000-0000-0000-0000000001b1'),
  '30000000-0000-0000-0000-0000000001a1'::uuid, 'BR-B1: a repeat enquiry links to the account');
select is((select s.code from public.leads l join public.segments s on s.id = l.segment_id where l.id = '20000000-0000-0000-0000-0000000001b1'),
  'hotel', 'the segment follows the enquiry type');

-- BR-S8 + BR-B1: booking reuses the linked account, never creates a second one
select is((public.ensure_prospect('20000000-0000-0000-0000-0000000001b1', '{"address":"Sector 13, Dwarka, New Delhi"}') ->> 'customer_id')::uuid,
  '30000000-0000-0000-0000-0000000001a1'::uuid, 'ensure_prospect reuses the linked account');

-- a brand-new business becomes a prospect account with an admin contact, linked to its lead
insert into public.leads (id, phone, source_id, customer_type, business_name, estimated_units) values
  ('20000000-0000-0000-0000-0000000001b2', '+919700000182', (select id from public.lead_sources where code = 'call'), 'hotel', 'Hotel Aurum', 48);
create temp table t on commit drop as
  select (public.ensure_prospect('20000000-0000-0000-0000-0000000001b2', '{"address":"MG Road, Gurugram"}') ->> 'customer_id')::uuid as cid;
select is((select row(c.kind, c.name, c.size_units, c.is_prospect)::text from public.customers c where c.id = (select cid from t)),
  '(business,"Hotel Aurum",48,t)', 'a new business account takes the business name and size');
select is((select customer_id from public.leads where id = '20000000-0000-0000-0000-0000000001b2'), (select cid from t), 'the lead is linked to its new account');
select is((select is_admin from public.customer_contacts where customer_id = (select cid from t)), true, 'the first contact is the account admin');

-- BR-B3: the website cannot create a home lead while B2C is off; staff entry still can
select throws_ok($$ insert into public.leads (phone, source_id, customer_type)
  values ('+919700000183', (select id from public.lead_sources where code = 'website'), 'home') $$,
  '23514', null, 'BR-B3: a public home enquiry is refused while B2C is off');
select lives_ok($$ insert into public.leads (phone, source_id, customer_type)
  values ('+919700000184', (select id from public.lead_sources where code = 'call'), 'home') $$,
  'BR-B3: staff can still record a home enquiry');

-- ADR-016: a login links to a PROSPECT contact, and the prospect sees its own account
insert into auth.users (id, email, phone) values ('00000000-0000-0000-0000-0000000001d1', 'aurum@test.local', '919700000182');
select is((select user_id from public.customer_contacts where customer_id = (select cid from t)),
  '00000000-0000-0000-0000-0000000001d1'::uuid, 'ADR-016: a prospect contact is linked at login');

insert into public.properties (id, customer_id, name, address) values
  ('31000000-0000-0000-0000-0000000001e1', (select cid from t), 'Hotel Aurum', 'MG Road');
insert into public.rate_cards (id, version, effective_from) values ('42000000-0000-0000-0000-0000000001f1', 9801, current_date);
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b1', 'surveyor.acc@test.local');
insert into public.profiles (id, full_name) values ('00000000-0000-0000-0000-0000000000b1', 'Surveyor');
insert into public.surveys (id, lead_id, property_id, surveyor_id, scheduled_at, slot_end_at, status) values
  ('32000000-0000-0000-0000-0000000001f1', '20000000-0000-0000-0000-0000000001b2', '31000000-0000-0000-0000-0000000001e1',
   '00000000-0000-0000-0000-0000000000b1', now() - interval '2 days', now() - interval '2 days' + interval '2 hours', 'submitted');
insert into public.quotations (id, quote_no, survey_id, lead_id, customer_id, property_id, rate_card_id, status)
values ('60000000-0000-0000-0000-0000000001f1', 'Q-ACC', '32000000-0000-0000-0000-0000000001f1', '20000000-0000-0000-0000-0000000001b2',
        (select cid from t), '31000000-0000-0000-0000-0000000001e1', '42000000-0000-0000-0000-0000000001f1', 'draft');
insert into public.account_activities (customer_id, kind, title, actor_id)
values ((select cid from t), 'meeting', 'Met the GM about a pilot room', '00000000-0000-0000-0000-0000000000a1');

grant select on t to authenticated;
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000001d1","user_role":"customer"}';
select is((select count(*)::int from public.customers), 1, 'ADR-016: the prospect sees its own account — and only that');
select is((select count(*)::int from public.surveys where id = '32000000-0000-0000-0000-0000000001f1'), 1, 'the prospect sees its own assessment');
select is((select count(*)::int from public.quotations), 0, 'a prospect never sees a draft quotation');
select is((select count(*)::int from public.v_account_timeline where kind in ('activity', 'note')), 0,
  'ADR-017: internal notes and activities never reach the customer timeline');

-- staff timeline for the same account shows the internal activity and the survey
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000a1","user_role":"super_admin"}';
select is((select count(*)::int from public.v_account_timeline where customer_id = (select cid from t) and kind in ('activity', 'survey', 'quotation')), 3,
  'ADR-017: the staff timeline shows the activity, the assessment and the proposal');
update public.account_activities set title = 'rewritten';
select is((select title from public.account_activities where customer_id = (select cid from t)), 'Met the GM about a pilot room',
  'account activities are append-only (no update policy; trigger forbids it for the owner)');

select * from finish();
rollback;
