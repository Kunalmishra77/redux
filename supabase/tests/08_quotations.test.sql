-- §10 quotations · BR-A1, A4, A6 · BR-Q1…Q5, Q7 · items 3, 12 · GST place of supply.
begin;
create extension if not exists pgtap with schema extensions;
select plan(40);

-- ── fixtures (written as the system; the flows under test run as each role) ─
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'exec1@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'surveyor1@test.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'surveyor2@test.local'),
  ('00000000-0000-0000-0000-0000000000f1', 'portal1@test.local');
insert into public.profiles (id, full_name) values
  ('00000000-0000-0000-0000-0000000000a1', 'Admin'), ('00000000-0000-0000-0000-0000000000c1', 'Exec One'),
  ('00000000-0000-0000-0000-0000000000b1', 'Surveyor One'), ('00000000-0000-0000-0000-0000000000b2', 'Surveyor Two');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'super_admin'), ('00000000-0000-0000-0000-0000000000c1', 'cc_exec'),
  ('00000000-0000-0000-0000-0000000000b1', 'surveyor'), ('00000000-0000-0000-0000-0000000000b2', 'surveyor');

insert into public.cities (id, name, state_code) values
  ('10000000-0000-0000-0000-0000000000d1', 'Quote Test Delhi', '07'),
  ('10000000-0000-0000-0000-0000000000d2', 'Quote Test Gurugram', '06');
insert into public.fitting_types (id, code, name) values ('40000000-0000-0000-0000-000000000001', 'q_test_basin', 'Basin mixer');
insert into public.finishes (id, code, name) values ('41000000-0000-0000-0000-000000000001', 'q_test_chrome', 'Chrome');

update public.rate_cards set is_active = false where is_active;
insert into public.rate_cards (id, version, effective_from)
values ('42000000-0000-0000-0000-000000000001', 9001, current_date);   -- draft: prices first, then activate
insert into public.rate_card_items (rate_card_id, fitting_type_id, work_type_id, finish_id, price, gst_rate, hsn_sac)
select '42000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', w.id,
       '41000000-0000-0000-0000-000000000001', p, 18.00, '998719'
from (values ('restore_finish', 1500.00), ('replace_eurobrass', 6000.00)) v(code, p)
join public.work_types w on w.code = v.code;
insert into public.market_prices (rate_card_id, fitting_type_id, price)
values ('42000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 9000.00);
update public.rate_cards set is_active = true, activated_at = now() where id = '42000000-0000-0000-0000-000000000001';

insert into public.lead_sources (code, name) values ('website', 'Website') on conflict do nothing;
insert into public.leads (id, phone, source_id, status, assigned_to) values
  ('20000000-0000-0000-0000-000000000001', '+919860000001', (select id from public.lead_sources where code = 'website'),
   'contacted', '00000000-0000-0000-0000-0000000000c1');
insert into public.customers (id, lead_id, name, type, is_prospect, converted_at) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Orchid', 'hotel', false, now()),
  ('30000000-0000-0000-0000-000000000002', null, 'Gurugram Hotel', 'hotel', true, null);
insert into public.customer_contacts (customer_id, user_id, name, phone)
values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f1', 'CE', '+919860000001');
insert into public.properties (id, customer_id, name, address, city_id) values
  ('31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Orchid Delhi', 'Janpath', '10000000-0000-0000-0000-0000000000d1'),
  ('31000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'Hotel GGN', 'Golf Course Rd', '10000000-0000-0000-0000-0000000000d2');
insert into public.surveys (id, lead_id, property_id, surveyor_id, scheduled_at, slot_end_at, status, submitted_at) values
  ('32000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-0000000000b1', now() - interval '2 days', now() - interval '2 days' + interval '2 hours', 'submitted', now()),
  ('32000000-0000-0000-0000-000000000002', null, '31000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-0000000000b1', now() - interval '3 days', now() - interval '3 days' + interval '2 hours', 'submitted', now());
update public.leads set status = 'survey_booked' where id = '20000000-0000-0000-0000-000000000001';
update public.leads set status = 'surveyed'      where id = '20000000-0000-0000-0000-000000000001';
insert into public.fittings (id, survey_id, unit_label, fitting_type_id, current_finish_id, idem_key, captured_at) values
  ('50000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '204', '40000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', 'q-f1', now()),
  ('50000000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000001', '204', '40000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', 'q-f2', now()),
  ('50000000-0000-0000-0000-000000000003', '32000000-0000-0000-0000-000000000002', '101', '40000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', 'q-f3', now());
insert into public.assessments (fitting_id, recommended, rate_card_id, price_recommended, price_replace_eurobrass, price_market_replacement) values
  ('50000000-0000-0000-0000-000000000001', 'restore_finish', '42000000-0000-0000-0000-000000000001', 1500, 6000, 9000),
  ('50000000-0000-0000-0000-000000000003', 'restore_finish', '42000000-0000-0000-0000-000000000001', 1500, 6000, 9000);

create temp table t (k text primary key, v uuid) on commit drop;
grant all on t to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","user_role":"surveyor"}';

-- ── Build from the audit (D10-01, BR-A1) ───────────────────────────────────
select throws_ok($$ select public.create_quote_from_survey('32000000-0000-0000-0000-000000000001') $$,
  '23514', null, 'BR-A1: a fitting without a recommendation blocks the quote');

reset role;
insert into public.assessments (fitting_id, recommended, rate_card_id, price_recommended, price_replace_eurobrass, price_market_replacement)
values ('50000000-0000-0000-0000-000000000002', 'no_action', '42000000-0000-0000-0000-000000000001', 0, 6000, 9000);
set local role authenticated;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","user_role":"surveyor"}';
select throws_ok($$ select public.create_quote_from_survey('32000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'another surveyor cannot quote this survey');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","user_role":"surveyor"}';
insert into t values ('q', public.create_quote_from_survey('32000000-0000-0000-0000-000000000001'));
select is((select count(*)::int from public.quotation_lines where quotation_id = (select v from t where k = 'q')), 1,
  'D10-01: one line per fitting to work on ("no action" is left off)');
select is((select array[unit_price, price_replace_eurobrass, market_price, gst_rate]
           from public.quotation_lines where quotation_id = (select v from t where k = 'q')),
  array[1500.00, 6000.00, 9000.00, 18.00]::numeric[], 'D8-02: the line carries all three prices and the GST rate');
select is((select hsn_sac from public.quotation_lines where quotation_id = (select v from t where k = 'q')), '998719',
  'the SAC code comes from the rate card');
select is((select array[subtotal, cgst, sgst, igst, total] from public.quotations where id = (select v from t where k = 'q')),
  array[1500.00, 135.00, 135.00, 0.00, 1770.00]::numeric[], 'D10-03: Delhi property → CGST + SGST at 9% each, total incl. GST');
select is((select array[market_total, you_save] from public.quotations where id = (select v from t where k = 'q')),
  array[9000.00, 7230.00]::numeric[], 'BR-A4: You save = market − total');

-- ── Discounts (BR-A6) ──────────────────────────────────────────────────────
select is(public.set_quote_discount((select v from t where k = 'q'), 3)::text, 'draft',
  'BR-A6: a 3% discount (under the 5% threshold) applies directly');
select is((select array[taxable_value, cgst, total] from public.quotations where id = (select v from t where k = 'q')),
  array[1455.00, 130.95, 1716.90]::numeric[], 'the discount is taken before GST');
select throws_ok($$ select public.set_quote_discount((select v from t where k = 'q'), 10) $$,
  '23514', null, 'BR-A6: a 10% discount needs a reason');
select is(public.set_quote_discount((select v from t where k = 'q'), 10, 'Pilot for a 200-room chain')::text,
  'pending_approval', 'BR-A6: above the threshold the quote waits for super_admin');
select throws_ok($$ select public.freeze_quote_for_issue((select v from t where k = 'q')) $$,
  '22023', null, 'BR-A6: … and cannot be sent meanwhile');

-- ── item 12: customers never see drafts or pending quotes ──────────────────
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","user_role":"customer"}';
select is((select count(*)::int from public.quotations), 0, 'item 12: the customer cannot see a pending quote');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","user_role":"super_admin"}';
select lives_ok($$ select public.decide_discount((select id from public.discount_approvals
                                                  where quotation_id = (select v from t where k = 'q')), true, 'OK for the pilot') $$,
  'super_admin approves the discount');
select is((select status::text || ':' || discount_pct from public.quotations where id = (select v from t where k = 'q')),
  'draft:10.00', 'the approved discount stands and the quote is sendable again');

-- ── Issue: terms snapshot (BR-Q3), validity (BR-Q1), PDF hash ──────────────
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","user_role":"surveyor"}';
reset role;
update public.settings set value = 'null' where key = 'warranty_terms';
set local role authenticated;
select throws_ok($$ select public.freeze_quote_for_issue((select v from t where k = 'q')) $$,
  '55000', null, 'A10: no warranty terms loaded → no quote goes out (nothing invented)');

reset role;
update public.settings
set value = '{"version":"W-1","text":"Mechanical 12 months, finish 24 months","mechanical_days":365,"finish_days":730}'
where key = 'warranty_terms';
set local role authenticated;
select public.freeze_quote_for_issue((select v from t where k = 'q'));
select is((select valid_until from public.quotations where id = (select v from t where k = 'q')),
  (now() at time zone 'Asia/Kolkata')::date + 15, 'BR-Q1: valid for 15 days from issue (IST)');

select throws_ok($$ select public.mark_quote_sent((select v from t where k = 'q'), 'quotes/x.pdf', 'not-a-hash') $$,
  '22023', null, 'the PDF hash must be a SHA-256 digest');
select lives_ok($$ select public.mark_quote_sent((select v from t where k = 'q'), 'quotes/x.pdf', repeat('a', 64)) $$,
  'the quote is sent with its PDF hash');
select is((select status::text from public.leads where id = '20000000-0000-0000-0000-000000000001'), 'quoted',
  'D2-07: the lead moves to Quoted');

reset role;
update public.settings set value = '{"version":"W-2","text":"Changed later","mechanical_days":1,"finish_days":1}'
where key = 'warranty_terms';
select is((select terms_version || ':' || warranty_mechanical_days from public.quotations where id = (select v from t where k = 'q')),
  'W-1:365', 'BR-Q3: later edits to the master terms never change an issued quote');
set local role authenticated;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","user_role":"customer"}';
select is((select count(*)::int from public.quotations), 1, 'the customer sees the sent quote');
select is((select count(*)::int from public.quotation_lines), 1, '… and its lines');

-- ── BR-Q2 / BR-Q7: sent is immutable ───────────────────────────────────────
-- Layer 1, RLS: no user has an UPDATE or DELETE policy on quotes — the write touches 0 rows
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","user_role":"super_admin"}';
update public.quotations set discount_pct = 0 where id = (select v from t where k = 'q');
update public.quotation_lines set unit_price = 1 where quotation_id = (select v from t where k = 'q');
delete from public.quotations where id = (select v from t where k = 'q');
reset role;
select is((select discount_pct || ':' || (select unit_price from public.quotation_lines where quotation_id = q.id)
           from public.quotations q where q.id = (select v from t where k = 'q')),
  '10.00:1500.00', 'BR-Q2: no user — not even super_admin — can edit, re-price or delete a sent quote');
-- Layer 2, trigger: even the system (service role, migrations) cannot
select throws_ok($$ update public.quotations set discount_pct = 0 where id = (select v from t where k = 'q') $$,
  '42501', null, 'BR-Q2: the trigger stops even the system editing a sent quote');
select throws_ok($$ update public.quotation_lines set unit_price = 1 where quotation_id = (select v from t where k = 'q') $$,
  '42501', null, 'BR-Q2: … or its lines');
select throws_ok($$ delete from public.quotations where id = (select v from t where k = 'q') $$,
  '42501', null, 'BR-Q2: … or deleting it');
set local role authenticated;

-- ── OTP request (BR-Q5 rate limit; server only) ────────────────────────────
select throws_ok($$ select public.request_quote_otp((select v from t where k = 'q'), '+919860000001', 'whatsapp') $$,
  '42501', null, 'an OTP can only be issued by the server');

reset role;
set local request.jwt.claims = '{"role":"service_role"}';
create temp table otp on commit drop as
  select public.request_quote_otp((select v from t where k = 'q'), '+919860000001', 'whatsapp') as r;
select ok((select (r ->> 'code') ~ '^[0-9]{6}$' from otp), 'a six-digit code is returned to the server to send');
select ok((select o.otp_hash = encode(extensions.digest(o.id::text || ':' || (select r ->> 'code' from otp), 'sha256'), 'hex')
                  and o.otp_hash <> (select r ->> 'code' from otp)
           from public.quote_otps o where o.id = (select (r ->> 'otp_id')::uuid from otp)),
  'only a salted hash is stored, never the code');
select public.request_quote_otp((select v from t where k = 'q'), '+919860000001', 'whatsapp');
select public.request_quote_otp((select v from t where k = 'q'), '+919860000001', 'sms');
select throws_ok($$ select public.request_quote_otp((select v from t where k = 'q'), '+919860000001', 'sms') $$,
  '53400', null, 'a fourth code within the hour is refused');

-- ── Versions (BR-Q2) and expiry (BR-Q1) ────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","user_role":"surveyor"}';
insert into t values ('q2', public.create_quote_version((select v from t where k = 'q')));
select is((select array[(select quote_no from public.quotations where id = (select v from t where k = 'q'))]),
          (select array[quote_no] from public.quotations where id = (select v from t where k = 'q2')),
  'BR-Q2: the new version keeps the quote number');
select is((select status::text from public.quotations where id = (select v from t where k = 'q')), 'superseded',
  'BR-Q2: v1 is superseded');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","user_role":"customer"}';
select is((select array_agg(version) from public.quotations), array[1],
  'item 12: the customer sees v1 (superseded) but not the v2 draft');

reset role;
update public.settings set value = '-1' where key = 'quote_validity_days';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","user_role":"surveyor"}';
select public.freeze_quote_for_issue((select v from t where k = 'q2'));
select public.mark_quote_sent((select v from t where k = 'q2'), 'quotes/v2.pdf', repeat('b', 64));
reset role;
select is(public.expire_quotes(), 1, 'BR-Q1: the daily sweep expires a quote past its validity');
set local request.jwt.claims = '{"role":"service_role"}';
select throws_ok($$ select public.request_quote_otp((select v from t where k = 'q2'), '+919860000002', 'whatsapp') $$,
  '22023', null, 'BR-Q1: an expired quote cannot be approved');

-- ── GST: inter-state → IGST; BR-Q7 approved is final ───────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","user_role":"surveyor"}';
insert into t values ('q3', public.create_quote_from_survey('32000000-0000-0000-0000-000000000002'));
select is((select array[cgst, sgst, igst, total] from public.quotations where id = (select v from t where k = 'q3')),
  array[0.00, 0.00, 270.00, 1770.00]::numeric[], 'BR-I4: a Haryana property is inter-state → IGST 18%');

reset role;
update public.settings set value = '15' where key = 'quote_validity_days';
set local role authenticated;
select public.freeze_quote_for_issue((select v from t where k = 'q3'));
select public.mark_quote_sent((select v from t where k = 'q3'), 'quotes/q3.pdf', repeat('c', 64));
reset role;
update public.quotations set status = 'approved' where id = (select v from t where k = 'q3');   -- verify_quote_otp() does this in §11
set local role authenticated;
select throws_ok($$ select public.create_quote_version((select v from t where k = 'q3')) $$,
  '42501', null, 'BR-Q7: an approved quote is final — no new version');

-- ── quote_approvals is append-only (BR-Q4, rule 9) ─────────────────────────
reset role;
insert into public.quote_approvals (quotation_id, quotation_version, pdf_sha256, approver_name, approver_phone,
  otp_hash, otp_generated_at, otp_verified_at, delivery_channel, terms_text)
values ((select v from t where k = 'q3'), 1, repeat('c', 64), 'CE', '+919860000001', 'h', now(), now(), 'whatsapp', 'T');
select throws_ok($$ update public.quote_approvals set approver_name = 'x' $$, '42501', null,
  'BR-Q4: approval evidence cannot be edited — even by the system');
select throws_ok($$ delete from public.quote_approvals $$, '42501', null, '… nor deleted');

select * from finish();
rollback;
