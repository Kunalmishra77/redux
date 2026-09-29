-- §4 rate cards + §9 assessments · D9-02/03, BR-A1…A5, P4, review item 2.
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

-- ── fixtures ───────────────────────────────────────────────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'exec1@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'surveyor1@test.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'surveyor2@test.local');
insert into public.profiles (id, full_name) values
  ('00000000-0000-0000-0000-0000000000a1', 'Admin'),
  ('00000000-0000-0000-0000-0000000000c1', 'Exec One'),
  ('00000000-0000-0000-0000-0000000000b1', 'Surveyor One'),
  ('00000000-0000-0000-0000-0000000000b2', 'Surveyor Two');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'super_admin'),
  ('00000000-0000-0000-0000-0000000000c1', 'cc_exec'),
  ('00000000-0000-0000-0000-0000000000b1', 'surveyor'),
  ('00000000-0000-0000-0000-0000000000b2', 'surveyor');

-- Staging may already hold real rate cards: step them aside inside this transaction
update public.rate_cards set is_active = false where is_active;

insert into public.fitting_types (id, code, name) values
  ('40000000-0000-0000-0000-000000000001', 'rc_test_basin', 'Basin mixer'),
  ('40000000-0000-0000-0000-000000000002', 'rc_test_cheap', 'Cheap fitting');
insert into public.finishes (id, code, name) values
  ('41000000-0000-0000-0000-000000000001', 'rc_test_chrome', 'Chrome'),
  ('41000000-0000-0000-0000-000000000002', 'rc_test_gold',   'PVD Brushed Gold');

insert into public.customers (id, name, type) values ('30000000-0000-0000-0000-000000000001', 'Orchid', 'hotel');
insert into public.properties (id, customer_id, name, address) values
  ('31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Orchid', '12 Janpath');
insert into public.surveys (id, property_id, surveyor_id, scheduled_at, slot_end_at, status) values
  ('32000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-0000000000b1', now() + interval '1 day', now() + interval '1 day 2 hours', 'checked_in');
insert into public.fittings (id, survey_id, unit_label, fitting_type_id, current_finish_id, idem_key, captured_at) values
  ('50000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '204',
   '40000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', 'rc-f1', now()),
  ('50000000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000001', '204',
   '40000000-0000-0000-0000-000000000002', null, 'rc-f2', now()),
  ('50000000-0000-0000-0000-000000000003', '32000000-0000-0000-0000-000000000001', '205',
   '40000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', 'rc-f3', now());

create temp table t (k text primary key, v uuid) on commit drop;
grant all on t to authenticated;

set local role authenticated;

-- ── No prices loaded yet ───────────────────────────────────────────────────
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","user_role":"surveyor"}';
select throws_ok(
  $$ select public.upsert_assessment('{"fitting_id":"50000000-0000-0000-0000-000000000001","recommended":"restore_finish"}') $$,
  '55000', null, 'D9: no active rate card → no assessment (nothing is priced by guesswork)');

-- ── Rate card v1: admin builds and activates ───────────────────────────────
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","user_role":"super_admin"}';
insert into t values ('v1', public.new_rate_card_version(current_date, null, 'test v1'));
select throws_ok($$ select public.activate_rate_card((select v from t where k = 'v1')) $$,
  '23514', null, 'an empty rate card cannot be activated');

insert into public.rate_card_items (rate_card_id, fitting_type_id, work_type_id, finish_id, price)
select (select v from t where k = 'v1'), ft, (select id from public.work_types where code = wt), fin, pr
from (values
  ('40000000-0000-0000-0000-000000000001'::uuid, 'restore_finish',    '41000000-0000-0000-0000-000000000001'::uuid, 1500.00),
  ('40000000-0000-0000-0000-000000000001'::uuid, 'restore_finish',    '41000000-0000-0000-0000-000000000002'::uuid, 2500.00),
  ('40000000-0000-0000-0000-000000000001'::uuid, 'repair_function',   null, 800.00),
  ('40000000-0000-0000-0000-000000000001'::uuid, 'replace_eurobrass', '41000000-0000-0000-0000-000000000001'::uuid, 6000.00),
  ('40000000-0000-0000-0000-000000000002'::uuid, 'repair_function',   null, 800.00),
  ('40000000-0000-0000-0000-000000000002'::uuid, 'replace_eurobrass', null, 900.00)
) v(ft, wt, fin, pr);
insert into public.market_prices (rate_card_id, fitting_type_id, finish_id, price) values
  ((select v from t where k = 'v1'), '40000000-0000-0000-0000-000000000001', null, 9000.00),
  ((select v from t where k = 'v1'), '40000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000002', 14000.00),
  ((select v from t where k = 'v1'), '40000000-0000-0000-0000-000000000002', null, 500.00);

select throws_ok(
  $$ insert into public.rate_card_items (rate_card_id, fitting_type_id, work_type_id, finish_id, price)
     values ((select v from t where k = 'v1'), '40000000-0000-0000-0000-000000000001',
             (select id from public.work_types where code = 'repair_function'), null, 1.00) $$,
  '23505', null, 'NULLS NOT DISTINCT: "finish irrelevant" cannot be priced twice');

select lives_ok($$ select public.activate_rate_card((select v from t where k = 'v1')) $$, 'D9: admin activates v1');

-- ── P4 and item 2 ──────────────────────────────────────────────────────────
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","user_role":"surveyor"}';
select throws_ok(
  $$ insert into public.rate_card_items (rate_card_id, fitting_type_id, work_type_id, price)
     values ((select v from t where k = 'v1'), '40000000-0000-0000-0000-000000000001',
             (select id from public.work_types where code = 'restore_finish'), 1.00) $$,
  '42501', null, 'P4: a surveyor cannot write rate card items');
select is((select count(*)::int from public.rate_card_items where rate_card_id = (select v from t where k = 'v1')), 6,
  'item 2: the surveyor reads the active card''s prices (to price on site)');
select is((select count(*)::int from public.market_prices where rate_card_id = (select v from t where k = 'v1')), 3,
  'item 2: … and its market prices');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","user_role":"cc_exec"}';
select is((select count(*)::int from public.rate_cards), 0, 'an executive sees no rate card (no pricing outside a quote)');

-- ── BR-A2 / A3 / A4: the server prices all three options ───────────────────
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","user_role":"surveyor"}';
insert into t values ('a1', public.upsert_assessment(
  '{"fitting_id":"50000000-0000-0000-0000-000000000001","recommended":"restore_finish"}'));
select is((select array[price_recommended, price_replace_eurobrass, price_market_replacement]
           from public.assessments where id = (select v from t where k = 'a1')),
  array[1500.00, 6000.00, 9000.00]::numeric[],
  'BR-A2: restore (chrome), Eurobrass replacement and market replacement all priced from the card');
select is((select you_save from public.assessments where id = (select v from t where k = 'a1')), 7500.00::numeric,
  'BR-A4: you save = market − recommended');
select is((select rate_card_id from public.assessments where id = (select v from t where k = 'a1')),
  (select v from t where k = 'v1'), 'BR-A3: the rate card version is stored on the assessment');

-- write first, read in a later statement: a query sees its own start-of-statement snapshot
select public.upsert_assessment('{"fitting_id":"50000000-0000-0000-0000-000000000001","recommended":"repair_function"}');
select is((select price_recommended from public.assessments where fitting_id = '50000000-0000-0000-0000-000000000001'),
  800.00::numeric, 'a finish-irrelevant repair falls back to the finish-less price');
select is((select count(*)::int from public.assessments where fitting_id = '50000000-0000-0000-0000-000000000001'), 1,
  'upsert is idempotent per fitting (offline outbox retries)');

select throws_ok(
  $$ select public.upsert_assessment('{"fitting_id":"50000000-0000-0000-0000-000000000001","recommended":"restore_finish","finish_id":"41000000-0000-0000-0000-000000000002"}') $$,
  '23514', null, 'BR-A2: no Eurobrass replacement price in gold → rejected, never saved with a gap');
select throws_ok(
  $$ select public.upsert_assessment('{"fitting_id":"50000000-0000-0000-0000-000000000001","recommended":"restore_finish","finish_id":"41000000-0000-0000-0000-000000000002","override":{"price_replace_eurobrass":8000}}') $$,
  '23514', null, 'BR-A5: a manual price without a reason is rejected');
select lives_ok(
  $$ select public.upsert_assessment('{"fitting_id":"50000000-0000-0000-0000-000000000001","recommended":"restore_finish","finish_id":"41000000-0000-0000-0000-000000000002","override":{"price_replace_eurobrass":8000,"reason":"Gold replacement quoted by factory"}}') $$,
  'BR-A5: a manual price with a reason is accepted');
select is((select array[price_recommended, price_replace_eurobrass, price_market_replacement]
           from public.assessments where fitting_id = '50000000-0000-0000-0000-000000000001'),
  array[2500.00, 8000.00, 14000.00]::numeric[],
  'gold: card price for restore, override for replacement, exact-finish market price');
select ok((select is_manual_override from public.assessments where fitting_id = '50000000-0000-0000-0000-000000000001'),
  'the override is flagged');

select public.upsert_assessment('{"fitting_id":"50000000-0000-0000-0000-000000000002","recommended":"repair_function"}');
select public.upsert_assessment('{"fitting_id":"50000000-0000-0000-0000-000000000003","recommended":"no_action"}');
select ok((select you_save is null and price_market_replacement < price_recommended
           from public.assessments where fitting_id = '50000000-0000-0000-0000-000000000002'),
  'BR-A4: when market (500) is below the work (800), "You save" is hidden, never negative');
select is((select array[price_recommended, price_replace_eurobrass, price_market_replacement]
           from public.assessments where fitting_id = '50000000-0000-0000-0000-000000000003'),
  array[0.00, 6000.00, 9000.00]::numeric[], 'no action is priced at zero, with the alternatives still shown');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","user_role":"surveyor"}';
select throws_ok(
  $$ select public.upsert_assessment('{"fitting_id":"50000000-0000-0000-0000-000000000001","recommended":"repair_function"}') $$,
  '42501', null, 'another surveyor cannot assess this fitting');
select is((select count(*)::int from public.assessments), 0, '… nor see its assessments');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","user_role":"cc_exec"}';
select is((select count(*)::int from public.assessments), 0, 'an executive sees no assessment prices');

-- ── D9-02 / BR-A3: activated versions are frozen; editing = new version ────
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","user_role":"super_admin"}';
select throws_ok(
  $$ update public.rate_card_items set price = 1.00 where rate_card_id = (select v from t where k = 'v1') $$,
  '42501', null, 'D9-02: an activated version''s prices cannot be edited');
select throws_ok(
  $$ delete from public.rate_card_items where rate_card_id = (select v from t where k = 'v1') $$,
  '42501', null, 'D9-02: … nor deleted');

insert into t values ('v2', public.new_rate_card_version(current_date, null, 'test v2'));
select is((select count(*)::int from public.rate_card_items where rate_card_id = (select v from t where k = 'v2')), 6,
  'D9-02: a new version starts as a copy of the active one');
update public.rate_card_items set price = 1800.00
where rate_card_id = (select v from t where k = 'v2')
  and fitting_type_id = '40000000-0000-0000-0000-000000000001'
  and finish_id = '41000000-0000-0000-0000-000000000001'
  and work_type_id = (select id from public.work_types where code = 'restore_finish');
select lives_ok($$ select public.activate_rate_card((select v from t where k = 'v2')) $$, 'D9: v2 activated');
select is((select array_agg(t.k order by t.k) from public.rate_cards r join t on t.v = r.id
           where r.is_active), array['v2'], 'D9-03: only v2 is active now');

select is((select price_recommended from public.assessments where fitting_id = '50000000-0000-0000-0000-000000000003'),
  0.00::numeric, 'BR-A3: existing assessments keep their prices after a new version goes live');
select is((select rate_card_id from public.assessments where fitting_id = '50000000-0000-0000-0000-000000000002'),
  (select v from t where k = 'v1'), 'BR-A3: … and keep pointing at the version they were priced from');

reset role;
select ok(exists (select 1 from public.audit_log
                  where entity_type = 'assessments'
                    and after ->> 'override_reason' = 'Gold replacement quoted by factory'
                    and actor_id = '00000000-0000-0000-0000-0000000000b1'),
  'BR-A5: the override is in audit_log with its actor and reason');

select * from finish();
rollback;
