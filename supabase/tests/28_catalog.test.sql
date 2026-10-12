-- CR-001 phase 7 · product catalog · D30.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000aa1', 'admin.cat@test.local'),
  ('00000000-0000-0000-0000-000000000ac1', 'exec.cat@test.local'),
  ('00000000-0000-0000-0000-000000000ad1', 'cust.cat@test.local');
insert into public.profiles (id, full_name) values ('00000000-0000-0000-0000-000000000aa1', 'Admin'), ('00000000-0000-0000-0000-000000000ac1', 'Exec');
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-000000000aa1', 'super_admin'), ('00000000-0000-0000-0000-000000000ac1', 'cc_exec');
insert into public.fitting_types (id, code, name) values ('40000000-0000-0000-0000-000000000af1', 'cat_test_mixer', 'Cat test mixer');
insert into public.finishes (code, name) values ('cat_test_chrome', 'Cat chrome') on conflict do nothing;

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000ac1","user_role":"cc_exec"}';
select throws_ok($$ select public.import_products('[]') $$, '42501', null, 'only the Super Admin imports the catalog');

set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000aa1","user_role":"super_admin"}';
create temp table res on commit drop as select public.import_products('[
  {"sku":"EB-TEST-101","name":"Test Basin Mixer 101","category":"mixers","fitting_type":"cat_test_mixer","benefits":"Fast|Quiet","finishes":"cat_test_chrome","published":true,"image":"catalog/eb-test-101.jpg"},
  {"sku":"EB-TEST-102","name":"Test Draft Mixer","category":"mixers","published":false},
  {"sku":"bad sku!","name":"Broken"},
  {"sku":"EB-TEST-103","name":"Wrong category","category":"nope"}
]'::jsonb) as r;
select is((select (r ->> 'created')::int from res), 2, 'import creates the valid rows');
select is((select jsonb_array_length(r -> 'errors') from res), 2, '…and reports each bad row with its reason');
select is((select row(array_length(benefits, 1), array_length(finish_ids, 1), (select count(*) from public.product_media m where m.product_id = p.id))::text
  from public.products p where sku = 'EB-TEST-101'), '(2,1,1)', 'benefits, finishes and the image are read');
select is((public.import_products('[{"sku":"EB-TEST-101","name":"Test Basin Mixer 101 v2","category":"mixers","published":true}]') ->> 'updated')::int, 1,
  'importing the same SKU updates it');

-- customers see only published products
reset role;
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000ad1","user_role":"customer"}';
select is((select count(*)::int from public.products where sku in ('EB-TEST-101', 'EB-TEST-102')), 1, 'a customer sees published products only');
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000ac1","user_role":"cc_exec"}';
select is((select count(*)::int from public.products where sku in ('EB-TEST-101', 'EB-TEST-102')), 2, 'staff see drafts too');
reset role;

-- a quote line takes its fitting's product
insert into public.customers (id, name, type, is_prospect) values ('30000000-0000-0000-0000-000000000aa1', 'Cat Hotel', 'hotel', true);
insert into public.properties (id, customer_id, name, address) values ('31000000-0000-0000-0000-000000000aa1', '30000000-0000-0000-0000-000000000aa1', 'Cat Hotel', 'CP');
insert into public.surveys (id, property_id, mode, scheduled_at, slot_end_at, status, submitted_at) values
  ('32000000-0000-0000-0000-000000000aa1', '31000000-0000-0000-0000-000000000aa1', 'self', now() - interval '1 day', now() + interval '1 day', 'submitted', now());
insert into public.fittings (id, survey_id, unit_label, fitting_type_id, idem_key, captured_at, product_id) values
  ('50000000-0000-0000-0000-000000000aa1', '32000000-0000-0000-0000-000000000aa1', '1', '40000000-0000-0000-0000-000000000af1', 'cat-f1', now(),
   (select id from public.products where sku = 'EB-TEST-101'));
insert into public.rate_cards (id, version, effective_from, created_by) values ('42000000-0000-0000-0000-000000000af1', 9901, current_date, '00000000-0000-0000-0000-000000000aa1');
insert into public.quotations (id, quote_no, survey_id, customer_id, property_id, rate_card_id, created_by) values
  ('60000000-0000-0000-0000-000000000af1', 'Q-CAT', '32000000-0000-0000-0000-000000000aa1', '30000000-0000-0000-0000-000000000aa1', '31000000-0000-0000-0000-000000000aa1', '42000000-0000-0000-0000-000000000af1', '00000000-0000-0000-0000-000000000aa1');
insert into public.quotation_lines (quotation_id, fitting_id, description, unit_price, line_total, gst_rate) values
  ('60000000-0000-0000-0000-000000000af1', '50000000-0000-0000-0000-000000000aa1', 'Restore', 1000, 1000, 18);
select is((select p.sku from public.quotation_lines l join public.products p on p.id = l.product_id where l.quotation_id = '60000000-0000-0000-0000-000000000af1'),
  'EB-TEST-101', 'a quote line takes its fitting''s catalog product');

select is((select count(*)::int from public.product_categories where slug in ('mixers', 'showers', 'diverters', 'spouts-faucets', 'valves-accessories')), 5,
  'the catalog categories are seeded (works on an empty database too)');

select * from finish();
rollback;
