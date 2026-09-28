-- §15 webhooks, queues, notifications, CAPI · ADR-008/009 · D3-03/06/07 · D5 · item 7.
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'exec1@test.local'),
  ('00000000-0000-0000-0000-0000000000c2', 'exec2@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'surveyor1@test.local');
insert into public.profiles (id, full_name) values
  ('00000000-0000-0000-0000-0000000000a1', 'Admin'), ('00000000-0000-0000-0000-0000000000c1', 'Exec One'),
  ('00000000-0000-0000-0000-0000000000c2', 'Exec Two'), ('00000000-0000-0000-0000-0000000000b1', 'Surveyor');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'super_admin'), ('00000000-0000-0000-0000-0000000000c1', 'cc_exec'),
  ('00000000-0000-0000-0000-0000000000c2', 'cc_exec'), ('00000000-0000-0000-0000-0000000000b1', 'surveyor');
update public.profiles set is_active = false
where id in (select user_id from public.user_roles where role in ('cc_exec','super_admin'))
  and id not in ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000c2');
insert into public.integration_accounts (provider, external_id, display_name, last_event_at)
values ('meta', 'page_test', 'Meta page (test)', now() - interval '7 hours'),
       ('razorpay', 'acc_test', 'Razorpay test', now() - interval '1 hour');

create temp table t (k text primary key, v uuid) on commit drop;
grant all on t to authenticated;

-- ── Webhooks (ADR-008, item 7) ─────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000a1","user_role":"super_admin"}';
select throws_ok($$ select public.record_webhook('razorpay', 'evt_x', 'payment.captured', '{}', true) $$,
  '42501', null, 'webhooks are recorded by the server only');
reset role;
set local request.jwt.claims = '{"role":"service_role"}';

insert into t select 'w1', (r ->> 'id')::uuid from (select public.record_webhook('razorpay', 'evt_T1', 'payment.authorized',
  '{"payload":{"payment":{"entity":{"id":"pay_T1"}}}}', true) r) s;
select is(public.record_webhook('razorpay', 'evt_T1', 'payment.authorized', '{}', true) ->> 'duplicate', 'true',
  'ADR-008: a redelivered event is a no-op');
select lives_ok($$ select public.record_webhook('razorpay', 'evt_T2', 'payment.captured',
  '{"payload":{"payment":{"entity":{"id":"pay_T1"}}}}', true) $$,
  'item 7: authorized and captured for the SAME payment are two events, both kept');
select is((select count(*)::int from public.webhook_events where external_id in ('evt_T1','evt_T2')), 2,
  'item 7: … two rows, keyed on the provider event id');
select is((select count(*)::int from pgmq.q_q_webhooks where message ->> 'webhook_event_id' = (select v from t where k = 'w1')::text), 1,
  'ADR-009: the event was queued in the same transaction');
select ok((select last_event_at > now() - interval '1 minute' from public.integration_accounts where provider = 'razorpay'),
  'D3-07: the source''s last-event time moves');

insert into t select 'bad', (r ->> 'id')::uuid from (select public.record_webhook('google_ads', 'lead_BAD', 'lead', '{}', false) r) s;
select is((select status::text from public.webhook_events where id = (select v from t where k = 'bad')), 'dead',
  'a bad signature is kept for audit but never processed');
select is((select count(*)::int from pgmq.q_q_webhooks where message ->> 'webhook_event_id' = (select v from t where k = 'bad')::text), 0,
  '… and never queued');

select is(public.webhook_failed((select v from t where k = 'w1'), 'Graph API 500')::text, 'failed', 'D3-03: a failure is retried');
update public.webhook_events set retry_count = 5 where id = (select v from t where k = 'w1');
select is(public.webhook_failed((select v from t where k = 'w1'), 'Graph API 500 again')::text, 'dead',
  'D3-03: after the maximum attempts it dead-letters …');
select ok(exists (select 1 from public.team_notifications
                  where rule_code = 'TN5' and entity_id = (select v from t where k = 'w1') and user_id = '00000000-0000-0000-0000-0000000000a1'),
  '… and super_admin is alerted');

-- ── CN1 / TN1: a new lead ──────────────────────────────────────────────────
select public.ingest_lead('{"phone":"+919910000001","source":"website","name":"Ravi"}');
insert into t select 'lead', id from public.leads where phone = '+919910000001';
select is((select count(*)::int from public.messages where rule_code = 'CN1' and lead_id = (select v from t where k = 'lead')), 1,
  'CN1: the enquiry is acknowledged on WhatsApp …');
select is((select count(*)::int from pgmq.q_q_notifications
           where message ->> 'message_id' = (select id::text from public.messages where rule_code = 'CN1' and lead_id = (select v from t where k = 'lead'))), 1,
  '… queued for the worker in the same transaction');
select public.ingest_lead('{"phone":"+919910000001","source":"whatsapp_chat"}');
select is((select count(*)::int from public.messages where rule_code = 'CN1' and lead_id = (select v from t where k = 'lead')), 1,
  'a repeat enquiry (a touch) does not send a second acknowledgement');
select ok(exists (select 1 from public.team_notifications t2 join public.leads l on l.assigned_to = t2.user_id
                  where t2.rule_code = 'TN1' and t2.entity_id = l.id and l.id = (select v from t where k = 'lead')),
  'TN1: the assigned executive is told');

update public.notification_rules set is_active = false where code = 'CN1';
select public.ingest_lead('{"phone":"+919910000002","source":"website"}');
select is((select count(*)::int from public.messages m join public.leads l on l.id = m.lead_id
           where l.phone = '+919910000002' and m.rule_code = 'CN1'), 0, 'D16-05: a rule switched off sends nothing');
update public.notification_rules set is_active = true where code = 'CN1';

-- ── Quiet hours ────────────────────────────────────────────────────────────
select is(public.next_send_time('2026-10-12 22:30:00+05:30'), '2026-10-13 09:00:00+05:30'::timestamptz,
  'quiet hours: 22:30 IST waits until 09:00 the next day');
select is(public.next_send_time('2026-10-12 06:15:00+05:30'), '2026-10-12 09:00:00+05:30'::timestamptz,
  'quiet hours: 06:15 IST waits until 09:00 the same day');
select is(public.next_send_time('2026-10-12 14:00:00+05:30'), '2026-10-12 14:00:00+05:30'::timestamptz,
  'daytime goes now');

-- ── CN2 / TN6 / CAPI on a booked survey; CN7 / CAPI on approval ────────────
insert into public.customers (id, lead_id, name, type) values ('30000000-0000-0000-0000-000000000001', (select v from t where k = 'lead'), 'Ravi', 'home');
insert into public.properties (id, customer_id, name, address) values ('31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Home', 'Sector 21');
insert into public.surveys (id, lead_id, property_id, surveyor_id, scheduled_at, slot_end_at) values
  ('32000000-0000-0000-0000-000000000001', (select v from t where k = 'lead'), '31000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-0000000000b1', now() + interval '2 days', now() + interval '2 days 2 hours');
select is((select count(*)::int from public.messages where rule_code = 'CN2' and entity_id = '32000000-0000-0000-0000-000000000001'), 1,
  'CN2: the customer gets "survey booked"');
select ok((select variables ? 'slot' and variables ? 'surveyor' from public.messages where rule_code = 'CN2' and entity_id = '32000000-0000-0000-0000-000000000001'),
  'CN2 carries the date, slot and surveyor name (J1 step 4)');
select ok(exists (select 1 from public.team_notifications where rule_code = 'TN6' and user_id = '00000000-0000-0000-0000-0000000000b1'),
  'TN6: the surveyor is told');
select is((select count(*)::int from public.capi_events where event_name = 'survey_booked' and lead_id = (select v from t where k = 'lead')), 1,
  'D3-06: CAPI survey_booked is queued for Meta');
insert into public.surveys (lead_id, property_id, surveyor_id, scheduled_at, slot_end_at) values
  ((select v from t where k = 'lead'), '31000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1',
   now() + interval '5 days', now() + interval '5 days 2 hours');
select is((select count(*)::int from public.capi_events where event_name = 'survey_booked' and lead_id = (select v from t where k = 'lead')), 1,
  'D3-06: … once per lead, however many surveys');

-- ── TN13 stock, TN12 service request ───────────────────────────────────────
insert into public.stock_items (id, sku, name, min_level) values ('80000000-0000-0000-0000-000000000001', 'T-INT-1', 'Cartridge', 2);
select ok((select notified_at is not null from public.stock_alerts where item_id = '80000000-0000-0000-0000-000000000001'),
  'TN13: the stock alert is delivered to super_admin and marked notified');
select public.raise_service_request('{"customer_id":"30000000-0000-0000-0000-000000000001","subject":"Tap loose"}');
select is((select count(distinct user_id)::int from public.team_notifications where rule_code = 'TN12'
           and user_id in ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000c2')), 2,
  'TN12: every active executive sees the new service request');

-- ── Sweeps ─────────────────────────────────────────────────────────────────
update public.leads set sla_due_at = now() - interval '5 minutes' where id = (select v from t where k = 'lead');
select public.sweep_sla();
select public.sweep_sla();
select is((select count(*)::int from public.team_notifications where rule_code = 'TN3' and entity_id = (select v from t where k = 'lead')), 2,
  'TN3: a breach alerts the executive and super_admin — once, however often the sweep runs');
select ok(public.check_integration_health() >= 1, 'TN5: a source silent for 7 h (limit 6) raises an alert');

-- ── Who sees what ──────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000a1","user_role":"super_admin"}';
select is((select count(*)::int from public.webhook_events) + (select count(*)::int from public.messages), 0,
  'raw webhooks and outbound messages are service-role only — not even super_admin reads them');
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000b1","user_role":"surveyor"}';
select ok((select count(*) > 0 and bool_and(user_id = '00000000-0000-0000-0000-0000000000b1') from public.team_notifications),
  'everyone sees only their own alerts');

select * from finish();
rollback;
