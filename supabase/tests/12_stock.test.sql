-- §13 stock · D15 · BR-ST1, BR-ST2, BR-ST3.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'exec1@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'surveyor1@test.local');
insert into public.profiles (id, full_name) values
  ('00000000-0000-0000-0000-0000000000a1', 'Admin'), ('00000000-0000-0000-0000-0000000000c1', 'Exec'),
  ('00000000-0000-0000-0000-0000000000b1', 'Surveyor');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'super_admin'), ('00000000-0000-0000-0000-0000000000c1', 'cc_exec'),
  ('00000000-0000-0000-0000-0000000000b1', 'surveyor');

-- a job to consume against
insert into public.customers (id, name, type, is_prospect, converted_at) values ('30000000-0000-0000-0000-000000000001', 'Stock Hotel', 'hotel', false, now());
insert into public.properties (id, customer_id, name, address) values ('31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Stock Hotel', 'MG Road');
insert into public.rate_cards (id, version, effective_from) values ('42000000-0000-0000-0000-000000000001', 9401, current_date);
insert into public.surveys (id, property_id, surveyor_id, scheduled_at, slot_end_at, status) values
  ('32000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1',
   now() - interval '9 days', now() - interval '9 days' + interval '2 hours', 'submitted');
insert into public.quotations (id, quote_no, survey_id, customer_id, property_id, rate_card_id, status, issued_at, valid_until, terms_text, pdf_sha256)
values ('60000000-0000-0000-0000-000000000001', 'Q-STOCK', '32000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
        '31000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-000000000001', 'approved', now(), current_date, 'T', repeat('a', 64));
insert into public.jobs (id, job_no, quotation_id, customer_id, property_id) values
  ('70000000-0000-0000-0000-000000000001', 'J-STOCK', '60000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001');

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000a1","user_role":"super_admin"}';

select throws_ok($$ insert into public.stock_items (sku, name, quantity) values ('T-CART-X', 'Cartridge', 5) $$,
  '42501', null, 'BR-ST2: opening stock is a movement, not a typed-in number');
insert into public.stock_items (id, sku, name, category, min_level) values
  ('80000000-0000-0000-0000-000000000001', 'T-CART-35', '35 mm ceramic cartridge', 'cartridge', 0);

select is(public.record_stock_movement('{"item_id":"80000000-0000-0000-0000-000000000001","type":"in","quantity":10}'),
  10.00::numeric, 'D15-03: stock in');
update public.stock_items set min_level = 5 where id = '80000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.stock_alerts where item_id = '80000000-0000-0000-0000-000000000001'), 0,
  'setting a minimum below the stock raises nothing');

select public.record_stock_movement('{"item_id":"80000000-0000-0000-0000-000000000001","type":"out","quantity":4}');
select is((select count(*)::int from public.stock_alerts where item_id = '80000000-0000-0000-0000-000000000001'), 0,
  '6 of minimum 5: no alert');
select public.record_stock_movement('{"item_id":"80000000-0000-0000-0000-000000000001","type":"out","quantity":2}');
select is((select count(*)::int from public.stock_alerts where item_id = '80000000-0000-0000-0000-000000000001'), 1,
  'BR-ST3: falling below the minimum fires the alert');
select public.record_stock_movement('{"item_id":"80000000-0000-0000-0000-000000000001","type":"out","quantity":1}');
select public.record_stock_movement('{"item_id":"80000000-0000-0000-0000-000000000001","type":"in","quantity":1}');
select is((select count(*)::int from public.stock_alerts where item_id = '80000000-0000-0000-0000-000000000001'), 1,
  'BR-ST3: hovering below the minimum does not fire again');
select public.record_stock_movement('{"item_id":"80000000-0000-0000-0000-000000000001","type":"in","quantity":2}');
select is((select below_min_since from public.stock_items where id = '80000000-0000-0000-0000-000000000001'), null,
  'BR-ST3: back at the minimum re-arms the alert');
select public.record_stock_movement('{"item_id":"80000000-0000-0000-0000-000000000001","type":"out","quantity":3}');
select is((select count(*)::int from public.stock_alerts where item_id = '80000000-0000-0000-0000-000000000001'), 2,
  'BR-ST3: a new crossing is a new alert — once per crossing');

select throws_ok($$ select public.record_stock_movement('{"item_id":"80000000-0000-0000-0000-000000000001","type":"out","quantity":10}') $$,
  '23514', null, 'BR-ST1: issuing more than is in stock is rejected');
select is((select quantity from public.stock_items where id = '80000000-0000-0000-0000-000000000001'), 3.00::numeric,
  'BR-ST1: … and the quantity is untouched');

select throws_ok($$ select public.record_stock_movement('{"item_id":"80000000-0000-0000-0000-000000000001","type":"consumed","quantity":1}') $$,
  '23514', null, 'D15-04: consumption names its job');
select lives_ok($$ select public.record_stock_movement('{"item_id":"80000000-0000-0000-0000-000000000001","type":"consumed","quantity":1,"job_id":"70000000-0000-0000-0000-000000000001"}') $$,
  'D15-04: consumption against a job');
select is((select sum(quantity) from public.stock_movements where job_id = '70000000-0000-0000-0000-000000000001'), 1.00::numeric,
  'D15-04: usage per job is visible');

select throws_ok($$ select public.record_stock_movement('{"item_id":"80000000-0000-0000-0000-000000000001","type":"adjusted","quantity":-1}') $$,
  '23514', null, 'an adjustment needs a reason');
select is(public.record_stock_movement('{"item_id":"80000000-0000-0000-0000-000000000001","type":"adjusted","quantity":-1,"reason":"Damaged in transit"}'),
  1.00::numeric, 'a signed adjustment with a reason');

select is((select count(*)::int from public.stock_movements
           where item_id = '80000000-0000-0000-0000-000000000001' and actor_id = '00000000-0000-0000-0000-0000000000a1'), 9,
  'BR-ST2: every movement records its actor');
select throws_ok($$ update public.stock_items set quantity = 100 where id = '80000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'BR-ST2: nobody types a new quantity over the ledger');
select is((select array_agg(sku) from public.v_low_stock where sku like 'T-%'), array['T-CART-35'],
  'D15-02: the item shows as low stock');

reset role;
select throws_ok($$ update public.stock_movements set quantity = 99 $$, '42501', null,
  'movements are append-only, even for the system');

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000c1","user_role":"cc_exec"}';
select is((select count(*)::int from public.stock_items), 0, 'stock is super_admin only (roles matrix)');
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000b1","user_role":"surveyor"}';
select throws_ok($$ select public.record_stock_movement('{"item_id":"80000000-0000-0000-0000-000000000001","type":"in","quantity":1}') $$,
  '42501', null, 'a surveyor cannot move stock');

set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000a1","user_role":"super_admin"}';
insert into public.stock_items (id, sku, name, category, min_level) values
  ('80000000-0000-0000-0000-000000000002', 'T-SEAL-1', 'O-ring seal', 'spare', 3);
select is((select count(*)::int from public.stock_alerts where item_id = '80000000-0000-0000-0000-000000000002'), 1,
  'BR-ST3: a new item already under its minimum alerts at once');

select * from finish();
rollback;
