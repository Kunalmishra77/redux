-- CR-001 phase 6 · referrals and rewards · BR-R1…R6.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000007a1', 'admin.ref@test.local'),
  ('00000000-0000-0000-0000-0000000007c1', 'exec.ref@test.local'),
  ('00000000-0000-0000-0000-0000000007d1', 'cust.ref@test.local');
insert into public.profiles (id, full_name) values
  ('00000000-0000-0000-0000-0000000007a1', 'Admin'), ('00000000-0000-0000-0000-0000000007c1', 'Exec');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000007a1', 'super_admin'), ('00000000-0000-0000-0000-0000000007c1', 'cc_exec');
update public.settings set value = '2' where key = 'discount_threshold_pct';   -- so the 5% would normally need approval

-- the referrer (with a portal contact) and two branches of one chain
insert into public.customer_groups (id, name) values ('35000000-0000-0000-0000-0000000007a1', 'Test Chain');
insert into public.customers (id, name, type, is_prospect, converted_at, group_id) values
  ('30000000-0000-0000-0000-0000000007a1', 'Hotel Referrer', 'hotel', false, now() - interval '1 year', '35000000-0000-0000-0000-0000000007a1'),
  ('30000000-0000-0000-0000-0000000007a2', 'Hotel Referrer Branch', 'hotel', true, null, '35000000-0000-0000-0000-0000000007a1');
insert into public.customer_contacts (customer_id, name, phone, is_primary, is_admin, user_id) values
  ('30000000-0000-0000-0000-0000000007a1', 'Ravi', '+919700000791', true, true, '00000000-0000-0000-0000-0000000007d1');

create temp table code on commit drop as select public.referral_code_for('30000000-0000-0000-0000-0000000007a1') as c;
select matches((select c from code), '^[A-Z0-9]{4,12}$', 'an account gets a referral code');
select is(public.referral_code_for('30000000-0000-0000-0000-0000000007a1'), (select c from code), 'one code per account');

-- BR-R1: a Google Ads lead carrying the code is referred; its source stays Google Ads
insert into public.leads (id, phone, source_id, customer_type, raw_payload) values
  ('20000000-0000-0000-0000-0000000007b1', '+919700000792', (select id from public.lead_sources where code = 'google_ads'), 'hotel',
   jsonb_build_object('referral_code', (select c from code)));
select is((select referrer_customer_id from public.referrals where referred_lead_id = '20000000-0000-0000-0000-0000000007b1'),
  '30000000-0000-0000-0000-0000000007a1'::uuid, 'BR-R1: the code on the enquiry records the referral');
select is((select s.code from public.leads l join public.lead_sources s on s.id = l.source_id where l.id = '20000000-0000-0000-0000-0000000007b1'),
  'google_ads', 'BR-R1: the lead source is unchanged');
select ok((select (inputs ->> 'referral')::boolean from public.lead_scores where lead_id = '20000000-0000-0000-0000-0000000007b1' order by created_at desc limit 1),
  'the score counts the referral');

-- BR-R4: a branch of the same chain may refer; an account may not refer itself
insert into public.leads (id, phone, source_id, customer_type, customer_id, raw_payload) values
  ('20000000-0000-0000-0000-0000000007b2', '+919700000793', (select id from public.lead_sources where code = 'call'), 'hotel',
   '30000000-0000-0000-0000-0000000007a2', jsonb_build_object('referral_code', (select c from code)));
select is((select count(*)::int from public.referrals where referred_customer_id = '30000000-0000-0000-0000-0000000007a2'), 1,
  'BR-R4: a branch of the same chain counts');
select throws_ok($$ insert into public.referrals (referrer_customer_id, referred_customer_id, channel)
  values ('30000000-0000-0000-0000-0000000007a1', '30000000-0000-0000-0000-0000000007a1', 'manual') $$, '23514', null, 'BR-R4: no self-referral');

-- the referred business books, is assessed and quoted
insert into public.customers (id, lead_id, name, type, is_prospect) values
  ('30000000-0000-0000-0000-0000000007a3', '20000000-0000-0000-0000-0000000007b1', 'Hotel Referred', 'hotel', true);
update public.leads set customer_id = '30000000-0000-0000-0000-0000000007a3' where id = '20000000-0000-0000-0000-0000000007b1';
select is((select referred_customer_id from public.referrals where referred_lead_id = '20000000-0000-0000-0000-0000000007b1'),
  '30000000-0000-0000-0000-0000000007a3'::uuid, 'the referral follows the lead to its account');
insert into public.properties (id, customer_id, name, address) values ('31000000-0000-0000-0000-0000000007a3', '30000000-0000-0000-0000-0000000007a3', 'Hotel Referred', 'Lajpat Nagar');
insert into public.surveys (id, property_id, mode, scheduled_at, slot_end_at, status, submitted_at) values
  ('32000000-0000-0000-0000-0000000007a3', '31000000-0000-0000-0000-0000000007a3', 'self', now() - interval '1 day', now() + interval '5 days', 'submitted', now());
insert into public.rate_cards (id, version, effective_from, created_by) values ('42000000-0000-0000-0000-0000000007f1', 9701, current_date, '00000000-0000-0000-0000-0000000007a1');
insert into public.quotations (id, quote_no, survey_id, customer_id, property_id, rate_card_id, created_by) values
  ('60000000-0000-0000-0000-0000000007f1', 'Q-REF', '32000000-0000-0000-0000-0000000007a3', '30000000-0000-0000-0000-0000000007a3',
   '31000000-0000-0000-0000-0000000007a3', '42000000-0000-0000-0000-0000000007f1', '00000000-0000-0000-0000-0000000007a1');
select is((select row(discount_pct, referral_discount_pct, referral_id is not null)::text from public.quotations where id = '60000000-0000-0000-0000-0000000007f1'),
  '(5.00,5.00,t)', 'BR-R2: the first quotation carries the 5% referral discount');

-- pre-approved: the 5% needs no approval even above the threshold; more than that does
create temp table q on commit drop as select '60000000-0000-0000-0000-0000000007f1'::uuid as id;
grant select on q to authenticated;
update public.surveys set reviewer_id = '00000000-0000-0000-0000-0000000007c1' where id = '32000000-0000-0000-0000-0000000007a3';
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000007c1', 'surveyor') on conflict do nothing;
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000007c1","user_role":"surveyor"}';
select is(public.set_quote_discount((select id from q), 5)::text, 'draft', 'BR-R2: the referral 5% is pre-approved');
select is(public.set_quote_discount((select id from q), 8, 'GM asked')::text, 'pending_approval', 'BR-R2: anything above it needs approval');
reset role;
update public.quotations set status = 'draft', discount_pct = 5 where id = '60000000-0000-0000-0000-0000000007f1';
delete from public.discount_approvals where quotation_id = '60000000-0000-0000-0000-0000000007f1';

-- two earlier conversions already on record, so this one is the third
insert into public.customers (id, name, type, is_prospect) values
  ('30000000-0000-0000-0000-0000000007a4', 'Earlier One', 'hotel', true), ('30000000-0000-0000-0000-0000000007a5', 'Earlier Two', 'hotel', true);
insert into public.referrals (referrer_customer_id, referred_customer_id, channel, status, converted_at) values
  ('30000000-0000-0000-0000-0000000007a1', '30000000-0000-0000-0000-0000000007a4', 'manual', 'rewarded', now()),
  ('30000000-0000-0000-0000-0000000007a1', '30000000-0000-0000-0000-0000000007a5', 'manual', 'converted', now());

-- BR-R3: approval converts the referral; the third conversion earns a free fitting
update public.quotations set status = 'sent', issued_at = now(), valid_until = current_date + 30, terms_text = 'T', pdf_sha256 = repeat('a', 64)
where id = '60000000-0000-0000-0000-0000000007f1';
update public.quotations set status = 'approved' where id = '60000000-0000-0000-0000-0000000007f1';
select is((select status from public.referrals where referred_lead_id = '20000000-0000-0000-0000-0000000007b1'), 'converted', 'BR-R3: the approved first order converts the referral');
select is((select count(*)::int from public.rewards where customer_id = '30000000-0000-0000-0000-0000000007a1' and kind = 'free_fitting'), 1,
  'BR-R3: the third conversion earns one free fitting');

-- BR-R3: the credit is issued when the order is PAID
insert into public.invoice_series (id, code, fy_start, fy_end) values ('70000000-0000-0000-0000-0000000007f1', 'TREF', '2026-04-01', '2027-03-31');
insert into public.invoices (id, invoice_no, series_id, quotation_id, customer_id, status, issue_date, recipient_name, recipient_address,
  place_of_supply_state_code, supplier_gstin, supplier_name, supplier_address, payment_route, taxable_value, total)
values ('71000000-0000-0000-0000-0000000007f1', 'TREF/2627/00001', '70000000-0000-0000-0000-0000000007f1', '60000000-0000-0000-0000-0000000007f1',
  '30000000-0000-0000-0000-0000000007a3', 'issued', current_date, 'Hotel Referred', 'Lajpat Nagar', '07', '07AAACE1234F1Z5', 'REDUX', 'Okhla', 'payment_link', 100000, 118000);
update public.referrals set first_order_value = 100000 where referred_lead_id = '20000000-0000-0000-0000-0000000007b1';
select is((select count(*)::int from public.rewards where kind = 'credit' and customer_id = '30000000-0000-0000-0000-0000000007a1'), 0, 'no credit before payment');
update public.invoices set status = 'paid', amount_paid = 118000 where id = '71000000-0000-0000-0000-0000000007f1';
select is((select amount from public.rewards where kind = 'credit' and customer_id = '30000000-0000-0000-0000-0000000007a1'), 5000.00,
  'BR-R3: payment issues credit of 5% of the first order');
select is((select status from public.referrals where referred_lead_id = '20000000-0000-0000-0000-0000000007b1'), 'rewarded', '…and the referral is rewarded');
select throws_ok($$ update public.rewards set amount = 1 where kind = 'credit' $$, null, null, 'BR-R6: the ledger is append-only');

-- BR-R6: redeem the credit on the referrer's own invoice, once
insert into public.invoices (id, invoice_no, series_id, customer_id, status, issue_date, recipient_name, recipient_address,
  place_of_supply_state_code, supplier_gstin, supplier_name, supplier_address, payment_route, taxable_value, total)
values ('71000000-0000-0000-0000-0000000007f2', 'TREF/2627/00002', '70000000-0000-0000-0000-0000000007f1', '30000000-0000-0000-0000-0000000007a1',
  'issued', current_date, 'Hotel Referrer', 'CP', '07', '07AAACE1234F1Z5', 'REDUX', 'Okhla', 'payment_link', 20000, 23600);
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000007a1","user_role":"super_admin"}';
select lives_ok($$ select public.redeem_reward((select id from public.rewards where kind = 'credit' and customer_id = '30000000-0000-0000-0000-0000000007a1'),
  '71000000-0000-0000-0000-0000000007f2', null) $$, 'BR-R6: the credit settles part of the next invoice');
select throws_ok($$ select public.redeem_reward((select id from public.rewards where kind = 'credit' and customer_id = '30000000-0000-0000-0000-0000000007a1'),
  '71000000-0000-0000-0000-0000000007f2', null) $$, '23505', null, 'BR-R6: a reward is redeemed once');
reset role;
select is((select row(status, amount_paid)::text from public.invoices where id = '71000000-0000-0000-0000-0000000007f2'), '(part_paid,5000.00)',
  'the invoice shows the credit as paid, its GST untouched');

-- the referrer sees their programme through the portal functions
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000007d1","user_role":"customer"}';
select is((select count(*)::int from public.my_referrals()), 4, 'the referrer sees their referrals');
select is((select count(*)::int from public.my_rewards() where status = 'redeemed'), 1, '…and their rewards with status');

select * from finish();
rollback;
