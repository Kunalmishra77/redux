-- CR-001 phase 9 · cadences, offers, outreach · BR-C1…C3, BR-R5, BR-L8.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000008a1', 'admin.out@test.local'),
  ('00000000-0000-0000-0000-0000000008c1', 'exec.out@test.local');
insert into public.profiles (id, full_name) values
  ('00000000-0000-0000-0000-0000000008a1', 'Admin'), ('00000000-0000-0000-0000-0000000008c1', 'Exec');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000008a1', 'super_admin'), ('00000000-0000-0000-0000-0000000008c1', 'cc_exec');
insert into public.privacy_notices (id, version, language, body, effective_from) values
  ('36000000-0000-0000-0000-0000000008a1', 'test-out-1', 'en', 'Test notice', current_date);
insert into public.lost_reasons (id, code, name) values ('37000000-0000-0000-0000-0000000008a1', 'out_test_price', 'Price') on conflict do nothing;

-- ── cadences: an A-tier new lead gets its executive tasks ─────────────────
insert into public.leads (id, phone, name, source_id, customer_type, estimated_units, assigned_to) values
  ('20000000-0000-0000-0000-0000000008b1', '+919700000891', 'Cad', (select id from public.lead_sources where code = 'call'), 'hotel', 60,
   '00000000-0000-0000-0000-0000000008c1');
select is((select count(*)::int from public.follow_ups f join public.followup_cadences c on c.id = f.cadence_id
  where f.lead_id = '20000000-0000-0000-0000-0000000008b1' and c.name = 'A-tier new enquiry'), 4, 'an A-tier new enquiry gets the A cadence tasks');
update public.leads set status = 'contacted' where id = '20000000-0000-0000-0000-0000000008b1';
select is((select count(*)::int from public.follow_ups where lead_id = '20000000-0000-0000-0000-0000000008b1' and completed_at is null), 0,
  'moving on closes the open cadence tasks');

-- ── audience: three lost leads; consent and the frequency cap decide ──────
insert into public.leads (id, phone, name, source_id, customer_type, status, lost_reason_id) values
  ('20000000-0000-0000-0000-0000000008b2', '+919700000892', 'Has Consent', (select id from public.lead_sources where code = 'call'), 'hotel', 'new', null),
  ('20000000-0000-0000-0000-0000000008b3', '+919700000893', 'No Consent',  (select id from public.lead_sources where code = 'call'), 'hotel', 'new', null),
  ('20000000-0000-0000-0000-0000000008b4', '+919700000894', 'Capped',      (select id from public.lead_sources where code = 'call'), 'hotel', 'new', null);
update public.leads set status = 'lost', lost_reason_id = '37000000-0000-0000-0000-0000000008a1'
where id in ('20000000-0000-0000-0000-0000000008b2', '20000000-0000-0000-0000-0000000008b3', '20000000-0000-0000-0000-0000000008b4');
insert into public.consent_records (subject_phone, lead_id, purpose, granted, notice_id, notice_version, method) values
  ('+919700000892', '20000000-0000-0000-0000-0000000008b2', 'marketing', true, '36000000-0000-0000-0000-0000000008a1', 'test-out-1', 'web_form'),
  ('+919700000893', '20000000-0000-0000-0000-0000000008b3', 'marketing', false, '36000000-0000-0000-0000-0000000008a1', 'test-out-1', 'web_form'),
  ('+919700000894', '20000000-0000-0000-0000-0000000008b4', 'marketing', true, '36000000-0000-0000-0000-0000000008a1', 'test-out-1', 'web_form');
insert into public.messages (template_code, channel, category, to_address, dedup_key) values
  ('outreach_restore_season', 'whatsapp', 'marketing', '+919700000894', 'cap-test-1'),
  ('outreach_restore_season', 'whatsapp', 'marketing', '+919700000894', 'cap-test-2');

create temp table aud on commit drop as select '{"target":"leads","statuses":["lost"],"lost_reason_ids":["37000000-0000-0000-0000-0000000008a1"]}'::jsonb as a;
grant select on aud to authenticated;
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000008a1","user_role":"super_admin"}';
select is((public.preview_audience((select a from aud), 'whatsapp') ->> 'matched')::int, 3, 'the audience matches the three lost leads');
select is((public.preview_audience((select a from aud), 'whatsapp') ->> 'eligible')::int, 1, 'BR-C1/C2: only one may be messaged');
select is((public.preview_audience((select a from aud), 'whatsapp') ->> 'no_marketing_consent')::int, 1, 'BR-C1: no marketing consent → excluded');
select is((public.preview_audience((select a from aud), 'whatsapp') ->> 'frequency_cap')::int, 1, 'BR-C2: over the frequency cap → excluded');

-- ── the template gate ──────────────────────────────────────────────────────
select throws_ok($$ insert into public.outreach_campaigns (name, channel, template_code, audience) values ('Bad', 'whatsapp', 'survey_booked', '{}') $$,
  '23514', null, 'BR-C1: a utility template can never carry outreach');

-- ── an offer, launched ─────────────────────────────────────────────────────
insert into public.offers (id, code, title, discount_pct, valid_until, eligible_tiers) values
  ('38000000-0000-0000-0000-0000000008a1', 'COMEBACK10', 'Come-back offer', 10, current_date + 30, '{A,B,C}');
insert into public.outreach_campaigns (id, name, channel, template_code, offer_id, audience) values
  ('39000000-0000-0000-0000-0000000008a1', 'Lost on price', 'whatsapp', 'outreach_reactivation', '38000000-0000-0000-0000-0000000008a1', (select a from aud));
select is((public.launch_campaign('39000000-0000-0000-0000-0000000008a1') ->> 'queued')::int, 1, 'BR-C3: launch queues exactly the previewed count');
reset role;
select is((select count(*)::int from public.outreach_recipients where campaign_id = '39000000-0000-0000-0000-0000000008a1' and status = 'skipped'), 2,
  'the skipped contacts are recorded with their reason');
select is((select row(category, template_code, variables ->> 'code')::text from public.messages where entity_id = '39000000-0000-0000-0000-0000000008a1'),
  '(marketing,outreach_reactivation,COMEBACK10)', 'the message is a marketing message carrying the offer code');
select ok((select send_after >= queued_at from public.messages where entity_id = '39000000-0000-0000-0000-0000000008a1'), 'BR-C2: quiet hours decide the send time');
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000008a1","user_role":"super_admin"}';
select throws_ok($$ select public.launch_campaign('39000000-0000-0000-0000-0000000008a1') $$, '22023', null, 'a campaign goes out once');
reset role;

-- ── replies ────────────────────────────────────────────────────────────────
insert into public.whatsapp_conversations (id, wa_id, lead_id) values ('33000000-0000-0000-0000-0000000008a1', '919700000892', '20000000-0000-0000-0000-0000000008b2');
insert into public.whatsapp_messages (conversation_id, direction, body) values ('33000000-0000-0000-0000-0000000008a1', 'inbound', 'Yes please call');
select is((select status::text from public.leads where id = '20000000-0000-0000-0000-0000000008b2'), 'contacted', 'BR-L8: a lost lead that replies is reopened');
select is((select status from public.outreach_recipients where address = '+919700000892'), 'reactivated', '…and counted as reactivated');
select is((select count(*)::int from public.lead_status_history where lead_id = '20000000-0000-0000-0000-0000000008b2' and to_status in ('lost', 'contacted')), 2,
  'BR-L8: both the loss and the reopen are in the history');
insert into public.whatsapp_messages (conversation_id, direction, body) values ('33000000-0000-0000-0000-0000000008a1', 'inbound', 'STOP');
select is(public.has_consent('+919700000892', null, 'marketing'), false, 'BR-C1: STOP withdraws marketing consent');
select is(public.has_consent('+919700000892', null, 'service'), false, '…service consent was never given here, and stays as it was');

-- ── offers on a quote: no stacking (BR-R5) ─────────────────────────────────
insert into public.customers (id, name, type, is_prospect, tier) values ('30000000-0000-0000-0000-0000000008a1', 'Hotel Offer', 'hotel', true, 'B');
insert into public.properties (id, customer_id, name, address) values ('31000000-0000-0000-0000-0000000008a1', '30000000-0000-0000-0000-0000000008a1', 'Hotel Offer', 'Saket');
insert into public.surveys (id, property_id, mode, scheduled_at, slot_end_at, status, submitted_at) values
  ('32000000-0000-0000-0000-0000000008a1', '31000000-0000-0000-0000-0000000008a1', 'self', now() - interval '1 day', now() + interval '5 days', 'submitted', now());
insert into public.rate_cards (id, version, effective_from, created_by) values ('42000000-0000-0000-0000-0000000008f1', 9801, current_date, '00000000-0000-0000-0000-0000000008a1');
insert into public.quotations (id, quote_no, survey_id, customer_id, property_id, rate_card_id, created_by, referral_discount_pct, discount_pct) values
  ('60000000-0000-0000-0000-0000000008f1', 'Q-OFF1', '32000000-0000-0000-0000-0000000008a1', '30000000-0000-0000-0000-0000000008a1', '31000000-0000-0000-0000-0000000008a1', '42000000-0000-0000-0000-0000000008f1', '00000000-0000-0000-0000-0000000008a1', 5, 5),
  ('60000000-0000-0000-0000-0000000008f2', 'Q-OFF2', '32000000-0000-0000-0000-0000000008a1', '30000000-0000-0000-0000-0000000008a1', '31000000-0000-0000-0000-0000000008a1', '42000000-0000-0000-0000-0000000008f1', '00000000-0000-0000-0000-0000000008a1', 12, 12);
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000008a1","user_role":"super_admin"}';
select is((public.apply_offer('60000000-0000-0000-0000-0000000008f1', 'comeback10') ->> 'applied')::boolean, true, 'BR-R5: a 10% offer beats a 5% referral');
select is((select discount_pct from public.quotations where id = '60000000-0000-0000-0000-0000000008f1'), 10.00::numeric, '…and replaces it — not 15%');
select is((public.apply_offer('60000000-0000-0000-0000-0000000008f2', 'COMEBACK10') ->> 'applied')::boolean, false, 'BR-R5: a larger referral discount stays');
select throws_ok($$ select public.apply_offer('60000000-0000-0000-0000-0000000008f1', 'NOSUCH') $$, '22023', null, 'an unknown code is refused');

select * from finish();
rollback;
