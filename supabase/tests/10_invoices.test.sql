-- §12 invoices, payments, credit notes · BR-I1…I8 · P8 (sequential form).
begin;
create extension if not exists pgtap with schema extensions;
select plan(35);

-- ── fixtures: three approved quotes, three completed jobs ──────────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'exec1@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'surveyor1@test.local'),
  ('00000000-0000-0000-0000-0000000000f1', 'portal1@test.local');
insert into public.profiles (id, full_name) values
  ('00000000-0000-0000-0000-0000000000a1', 'Admin'), ('00000000-0000-0000-0000-0000000000c1', 'Exec One'),
  ('00000000-0000-0000-0000-0000000000b1', 'Surveyor One');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'super_admin'), ('00000000-0000-0000-0000-0000000000c1', 'cc_exec'),
  ('00000000-0000-0000-0000-0000000000b1', 'surveyor');

-- Staging may hold real A11 values: clear them inside this transaction
update public.settings set value = 'null'
where key in ('supplier_gstin','supplier_legal_name','supplier_address','invoice_series_code','credit_note_series_code');

insert into public.cities (id, name, state_code) values ('10000000-0000-0000-0000-0000000000d1', 'Inv Test Delhi', '07');
insert into public.customers (id, name, type, is_prospect, converted_at, billing_address) values
  ('30000000-0000-0000-0000-000000000001', 'The Grand Orchid', 'hotel', false, now(), '1 Janpath, New Delhi 110001');
insert into public.customer_contacts (customer_id, user_id, name, phone)
values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f1', 'CE', '+919880000001');
insert into public.properties (id, customer_id, name, address, city_id) values
  ('31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Orchid', 'Janpath', '10000000-0000-0000-0000-0000000000d1');
insert into public.rate_cards (id, version, effective_from) values ('42000000-0000-0000-0000-000000000001', 9201, current_date);
insert into public.surveys (id, property_id, surveyor_id, scheduled_at, slot_end_at, status, submitted_at) values
  ('32000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1',
   now() - interval '40 days', now() - interval '40 days' + interval '2 hours', 'submitted', now() - interval '40 days');

insert into public.quotations (id, quote_no, survey_id, customer_id, property_id, rate_card_id) values
  ('60000000-0000-0000-0000-000000000001', 'Q-INV-1', '32000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-000000000002', 'Q-INV-2', '32000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-000000000003', 'Q-INV-3', '32000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-000000000001');
insert into public.quotation_lines (quotation_id, unit_label, description, unit_price, line_total, gst_rate, hsn_sac,
                                    taxable_value, cgst, sgst, market_price) values
  ('60000000-0000-0000-0000-000000000001', '204', 'Basin mixer — Restore finish', 1500, 1500, 18, null, 1500, 135, 135, 9000),
  ('60000000-0000-0000-0000-000000000002', '205', 'Basin mixer — Repair', 1000, 1000, 18, '998719', 1000, 90, 90, 9000),
  ('60000000-0000-0000-0000-000000000003', '301', '40 rooms — Restore finish', 60000, 60000, 18, '998719', 60000, 5400, 5400, 90000);
update public.quotations q set status = 'approved', issued_at = now() - interval '35 days', valid_until = current_date,
  terms_text = 'T', pdf_sha256 = repeat('a', 64), place_of_supply_state_code = '07', supplier_state_code = '07',
  subtotal = s.t, taxable_value = s.t, cgst = s.c, sgst = s.c, total = s.t + 2 * s.c
from (select quotation_id, sum(taxable_value) t, sum(cgst) c from public.quotation_lines
      where quotation_id::text like '60000000-0000-0000-0000-00000000000_' group by quotation_id) s
where s.quotation_id = q.id;

insert into public.jobs (id, job_no, quotation_id, customer_id, property_id, status, actual_end) values
  ('70000000-0000-0000-0000-000000000001', 'J-INV-1', '60000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', 'completed', current_date - 26),
  ('70000000-0000-0000-0000-000000000002', 'J-INV-2', '60000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', 'completed', current_date - 26),
  ('70000000-0000-0000-0000-000000000003', 'J-INV-3', '60000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', 'completed', current_date - 3);

create temp table t (k text primary key, v uuid) on commit drop;
grant all on t to authenticated;

-- ── BR-I8: the warning before the 30-day limit ─────────────────────────────
select is((select array_agg(job_no order by job_no) from public.v_invoices_due where job_no like 'J-INV-%'),
  array['J-INV-1','J-INV-2'], 'BR-I8: jobs 26 days past supply without an invoice are flagged (3 days is not)');

-- ── Drafts from the approved quote ─────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","user_role":"cc_exec"}';
select throws_ok($$ select public.create_invoice_from_job('70000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'an executive cannot raise an invoice');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","user_role":"super_admin"}';
insert into t values ('i1', public.create_invoice_from_job('70000000-0000-0000-0000-000000000001'));
select is((select invoice_no from public.invoices where id = (select v from t where k = 'i1')), null,
  'BR-I1: a draft has no number, so it can never leave a gap');
select is((select array[taxable_value, cgst, sgst, igst, total] from public.invoices where id = (select v from t where k = 'i1')),
  array[1500.00, 135.00, 135.00, 0.00, 1770.00]::numeric[], 'the invoice carries the approved quote''s GST exactly');
select is((select recipient_address || ' | ' || place_of_supply_state_code from public.invoices where id = (select v from t where k = 'i1')),
  '1 Janpath, New Delhi 110001 | 07', 'Rule 46: recipient address and place of supply are stored');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","user_role":"customer"}';
select is((select count(*)::int from public.invoices), 0, 'the customer does not see a draft');

-- ── Issue: A11 first, HSN/SAC on every line ────────────────────────────────
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","user_role":"super_admin"}';
select throws_ok($$ select public.issue_invoice((select v from t where k = 'i1')) $$,
  '55000', null, 'A11: no GSTIN / series loaded → nothing is issued (nothing invented)');
reset role;
update public.settings set value = to_jsonb(v) from (values
  ('supplier_gstin', '07AAACR5055K1Z5'), ('supplier_legal_name', 'Test Supplier Pvt Ltd'),
  ('supplier_address', 'D 8/7, Okhla Phase 1, New Delhi 110020'), ('invoice_series_code', 'TRDX')) s(k, v)
where key = s.k;
set local role authenticated;
select throws_ok($$ select public.issue_invoice((select v from t where k = 'i1')) $$,
  '23514', null, 'Rule 46: a line without HSN/SAC blocks issue');
reset role;
update public.invoice_lines set hsn_sac = '998719' where invoice_id = (select v from t where k = 'i1');
set local role authenticated;

select is(public.issue_invoice((select v from t where k = 'i1')),
  'TRDX/' || to_char(public.fy_start_of(current_date), 'YY') || to_char(public.fy_start_of(current_date) + interval '1 year', 'YY') || '/00001',
  'BR-I1: the first invoice of the FY is 00001, in CODE/YYYY/NNNNN form');
select ok((select char_length(invoice_no) <= 16 and supplier_gstin = '07AAACR5055K1Z5' and supplier_state_code = '07'
           from public.invoices where id = (select v from t where k = 'i1')),
  'Rule 46: ≤ 16 characters; supplier identity frozen onto the invoice');
select is((select payment_route from public.invoices where id = (select v from t where k = 'i1')), 'payment_link',
  'BR-I6: ₹1,770 → Payment Link');

-- BR-I1: an abandoned draft between two issues leaves no gap
insert into t values ('i2', public.create_invoice_from_job('70000000-0000-0000-0000-000000000002'));
insert into t values ('i3', public.create_invoice_from_job('70000000-0000-0000-0000-000000000003'));
reset role;
delete from public.invoice_lines where invoice_id = (select v from t where k = 'i2');
delete from public.invoices where id = (select v from t where k = 'i2');
set local role authenticated;
select is(right(public.issue_invoice((select v from t where k = 'i3')), 5), '00002',
  'BR-I1: the next issued invoice is 00002 — a deleted draft left no hole');
select is((select payment_route from public.invoices where id = (select v from t where k = 'i3')), 'virtual_account',
  'BR-I6: ₹70,800 → virtual account (NEFT/RTGS) first');

-- BR-I1: the series resets on 1 April (IST financial year)
reset role;
select is(public.allocate_document_no('TFY', '2027-03-31') ->> 'number', 'TFY/2627/00001', 'FY 2026-27 series');
select is(public.allocate_document_no('TFY', '2027-03-31') ->> 'number', 'TFY/2627/00002', '… sequential within it');
select is(public.allocate_document_no('TFY', '2027-04-01') ->> 'number', 'TFY/2728/00001', 'BR-I1: 1 April starts again at 00001');
select throws_ok($$ select public.allocate_document_no('TOOLONG', current_date) $$, '23514', null,
  'a series code longer than 5 characters is rejected (keeps numbers ≤ 16)');

-- ── BR-I2 / BR-I3: frozen after issue ──────────────────────────────────────
select throws_ok($$ update public.invoices set total = 1 where id = (select v from t where k = 'i1') $$,
  '42501', null, 'BR-I3: GST fields of an issued invoice are frozen, even for the system');
select throws_ok($$ update public.invoice_lines set gst_rate = 12 where invoice_id = (select v from t where k = 'i1') $$,
  '42501', null, 'BR-I3: … and so are its lines');
select throws_ok($$ delete from public.invoices where id = (select v from t where k = 'i1') $$,
  '42501', null, 'BR-I2: an issued invoice is never deleted');

-- ── BR-I5 / BR-I7: payments only from the verified webhook ─────────────────
set local role authenticated;
select throws_ok($$ select public.record_payment(jsonb_build_object('invoice_id', (select v from t where k = 'i1'),
                     'provider_payment_id', 'pay_x', 'amount', 1770, 'status', 'captured')) $$,
  '42501', null, 'BR-I5: nobody marks an invoice paid from the app — not even super_admin');
update public.invoices set status = 'paid', amount_paid = 1770 where id = (select v from t where k = 'i1');  -- RLS: 0 rows
select is((select status::text || ':' || amount_paid from public.invoices where id = (select v from t where k = 'i1')),
  'issued:0.00', 'BR-I5: … nor by editing it (no user has a write policy on invoices)');

reset role;
set local request.jwt.claims = '{"role":"service_role"}';
select is(public.record_payment(jsonb_build_object('invoice_id', (select v from t where k = 'i1'),
            'provider_payment_id', 'pay_TEST1', 'amount', 1000, 'status', 'captured', 'method', 'upi')) ->> 'invoice_status',
  'part_paid', 'a captured ₹1,000 against ₹1,770 → part paid');
select is(public.record_payment(jsonb_build_object('invoice_id', (select v from t where k = 'i1'),
            'provider_payment_id', 'pay_TEST1', 'amount', 1000, 'status', 'captured')) ->> 'recorded',
  'false', 'BR-I7: the same payment delivered twice is recorded once');
select is((select amount_paid from public.invoices where id = (select v from t where k = 'i1')), 1000.00::numeric,
  'BR-I7: … and counted once');
select public.record_payment(jsonb_build_object('invoice_id', (select v from t where k = 'i1'),
  'provider_payment_id', 'pay_TEST2', 'amount', 770, 'status', 'created'));
select is((select status::text from public.invoices where id = (select v from t where k = 'i1')), 'part_paid',
  'a created (not captured) payment does not count');
select is(public.record_payment(jsonb_build_object('invoice_id', (select v from t where k = 'i1'),
            'provider_payment_id', 'pay_TEST2', 'amount', 770, 'status', 'captured')) ->> 'invoice_status',
  'paid', 'the same payment captured → paid in full');

select lives_ok($$ select public.set_invoice_pdf((select v from t where k = 'i1'), 'invoices/i1.pdf', repeat('f', 64)) $$,
  'the rendered PDF is recorded');
select throws_ok($$ select public.set_invoice_pdf((select v from t where k = 'i1'), 'invoices/other.pdf', repeat('0', 64)) $$,
  '22023', null, 'BR-I3: … once — a later render cannot replace it');

-- ── Customer view ──────────────────────────────────────────────────────────
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","user_role":"customer"}';
select is((select count(*)::int from public.invoices), 2, 'the customer sees their issued invoices');
select is((select count(*)::int from public.payments), 2, '… and their payments');

-- ── BR-I2: cancel by credit note ───────────────────────────────────────────
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","user_role":"super_admin"}';
select throws_ok($$ select public.cancel_invoice((select v from t where k = 'i1'), 'Wrong customer') $$,
  '22023', null, 'a paid invoice is not cancelled silently');
select throws_ok($$ select public.cancel_invoice((select v from t where k = 'i3'), 'Wrong rooms') $$,
  '55000', null, 'A11: no credit note series loaded → no credit note');
reset role;
update public.settings set value = '"TRDXC"' where key = 'credit_note_series_code';
set local role authenticated;
select alike(public.cancel_invoice((select v from t where k = 'i3'), 'Wrong rooms'), 'TRDXC/%/00001',
  'BR-I2: cancelling issues a credit note from its own series');
select lives_ok($$ select public.create_invoice_from_job('70000000-0000-0000-0000-000000000003') $$,
  'after a credit note, the job can be invoiced again');

select * from finish();
rollback;
