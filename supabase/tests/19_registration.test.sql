-- CR-001 phase 2 · registration and colleagues · BR-B1, BR-B2, BR-B3.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'admin@test.local');
insert into public.profiles (id, full_name) values ('00000000-0000-0000-0000-0000000000a1', 'Admin');
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000a1', 'super_admin');

create temp table k on commit drop as
  select jsonb_build_object('notice_version', (select version from public.privacy_notices where is_active and language = 'en' limit 1),
                            'language', 'en', 'method', 'web_form', 'purposes', jsonb_build_object('service', true, 'marketing', false)) as consent;
create temp table r (k text primary key, v jsonb) on commit drop;
grant all on k, r to authenticated;

-- only the server registers
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000a1","user_role":"super_admin"}';
select throws_ok($$ select public.register_business('{"phone":"+919700000191","business_name":"X","contact_name":"Y"}', (select consent from k)) $$,
  '42501', null, 'registration is server-side only');
reset role;
set local request.jwt.claims = '{"role":"service_role"}';

insert into r values ('first', public.register_business(
  '{"phone":"+919700000191","business_name":"Hotel Saffron Court","legal_name":"Saffron Hospitality Pvt Ltd","contact_name":"Ritu Anand","email":"ritu@saffron.test","segment":"hotel","size_units":"36","pincode":"110001","role_title":"General Manager","referred_by":"Grand Orchid"}',
  (select consent from k)));
select is((select (v ->> 'created')::boolean from r where k = 'first'), true, 'BR-B2: a new business gets an account');
select is((select row(c.kind, c.is_prospect, c.verified_at is null, c.legal_name, c.size_units)::text
           from public.customers c where c.id = (select (v ->> 'customer_id')::uuid from r where k = 'first')),
  '(business,t,t,"Saffron Hospitality Pvt Ltd",36)', 'the account is an unverified business prospect with its details');
select is((select s.code from public.customers c join public.segments s on s.id = c.segment_id where c.id = (select (v ->> 'customer_id')::uuid from r where k = 'first')),
  'hotel', 'the segment is recorded');
select is((select row(is_admin, role_code)::text from public.customer_contacts where phone = '+919700000191'), '(t,owner)', 'the registrant is the account admin');
select is((select row(l.customer_id = (select (v ->> 'customer_id')::uuid from r where k = 'first'), l.business_name, s.code)::text
           from public.leads l join public.lead_sources s on s.id = l.source_id where l.id = (select (v ->> 'lead_id')::uuid from r where k = 'first')),
  '(t,"Hotel Saffron Court",website)', 'BR-B1: the enquiry lead is linked to the account');
select is((select count(*)::int from public.consent_records where subject_phone = '+919700000191' and customer_id is not null), 2,
  'consent (service granted, marketing declined) is recorded against the account');
select ok((select count(*)::int from public.team_notifications where rule_code = 'TN16' and entity_id = (select (v ->> 'customer_id')::uuid from r where k = 'first')
            and user_id = '00000000-0000-0000-0000-0000000000a1') = 1,
  'every super admin is told a business registered');

-- the same number registering again signs in to the same account; no duplicate
insert into r values ('again', public.register_business('{"phone":"+919700000191","business_name":"Saffron Court","contact_name":"Ritu"}', (select consent from k)));
select is((select (v ->> 'customer_id')::uuid from r where k = 'again'), (select (v ->> 'customer_id')::uuid from r where k = 'first'),
  'a known number reaches its existing account');
select throws_ok($$ select public.register_business('{"phone":"+919700000192","business_name":"My flat","contact_name":"Z","segment":"home"}', (select consent from k)) $$,
  '23514', null, 'BR-B3: no homeowner registrations while B2C is off');

-- colleagues: the admin invites; a non-admin cannot
insert into auth.users (id, email, phone) values ('00000000-0000-0000-0000-0000000001e1', 'ritu@test.local', '919700000191');
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000001e1","user_role":"customer"}';
insert into r values ('colleague', to_jsonb(public.invite_contact((select (v ->> 'customer_id')::uuid from r where k = 'first'), 'Vivek Rao', '+919700000193', 'engineering')));
reset role;
select is((select count(*)::int from public.messages where rule_code = 'CN19' and to_address = '+919700000193'), 1,
  'CN19: the colleague is invited on WhatsApp');
insert into auth.users (id, email, phone) values ('00000000-0000-0000-0000-0000000001e2', 'vivek@test.local', '919700000193');
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000001e2","user_role":"customer"}';
select throws_ok($$ select public.invite_contact((select (v ->> 'customer_id')::uuid from r where k = 'first'), 'X', '+919700000194') $$,
  '42501', null, 'a colleague who is not an admin cannot invite');
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000001e1","user_role":"customer"}';
select throws_ok($$ select public.deactivate_contact((select id from public.customer_contacts where phone = '+919700000191')) $$,
  '22023', null, 'an admin cannot remove themselves');
select public.deactivate_contact((select (v #>> '{}')::uuid from r where k = 'colleague'));
reset role;
select is((select is_active from public.customer_contacts where phone = '+919700000193'), false, 'the admin removes a colleague');

select * from finish();
rollback;
