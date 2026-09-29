-- Customer WhatsApp for the job and money events · CN9–CN13, CN16 · migration 001700.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into public.customers (id, name, type, is_prospect, converted_at) values ('30000000-0000-0000-0000-0000000000e1', 'Notify Hotel', 'hotel', false, now());
insert into public.customer_contacts (customer_id, name, phone, is_primary) values ('30000000-0000-0000-0000-0000000000e1', 'Meena Kohli', '+919800000171', true);
insert into public.properties (id, customer_id, name, address) values ('31000000-0000-0000-0000-0000000000e1', '30000000-0000-0000-0000-0000000000e1', 'Notify Hotel', 'Ring Road');
insert into public.property_units (id, property_id, label) values
  ('35000000-0000-0000-0000-0000000000e1', '31000000-0000-0000-0000-0000000000e1', '301'),
  ('35000000-0000-0000-0000-0000000000e2', '31000000-0000-0000-0000-0000000000e1', '302');
insert into public.rate_cards (id, version, effective_from) values ('42000000-0000-0000-0000-0000000000e1', 9701, current_date);
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e9', 'surveyor.notify@test.local');
insert into public.profiles (id, full_name) values ('00000000-0000-0000-0000-0000000000e9', 'Surveyor');
insert into public.surveys (id, property_id, surveyor_id, scheduled_at, slot_end_at, status) values
  ('32000000-0000-0000-0000-0000000000e1', '31000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e9',
   now() - interval '9 days', now() - interval '9 days' + interval '2 hours', 'submitted');
insert into public.quotations (id, quote_no, survey_id, customer_id, property_id, rate_card_id, status, issued_at, valid_until, terms_text, pdf_sha256,
                               warranty_mechanical_days, warranty_finish_days)
values ('60000000-0000-0000-0000-0000000000e1', 'Q-NOTIFY', '32000000-0000-0000-0000-0000000000e1', '30000000-0000-0000-0000-0000000000e1',
        '31000000-0000-0000-0000-0000000000e1', '42000000-0000-0000-0000-0000000000e1', 'approved', now(), current_date, 'T', repeat('a', 64), 365, 730);
insert into public.jobs (id, job_no, quotation_id, customer_id, property_id) values
  ('70000000-0000-0000-0000-0000000000e1', 'J-NOTIFY', '60000000-0000-0000-0000-0000000000e1', '30000000-0000-0000-0000-0000000000e1', '31000000-0000-0000-0000-0000000000e1');
insert into public.job_units (id, job_id, property_unit_id) values
  ('71000000-0000-0000-0000-0000000000e1', '70000000-0000-0000-0000-0000000000e1', '35000000-0000-0000-0000-0000000000e1'),
  ('71000000-0000-0000-0000-0000000000e2', '70000000-0000-0000-0000-0000000000e1', '35000000-0000-0000-0000-0000000000e2');

create or replace function pg_temp.sent(p_rule text) returns int language sql as
  $$ select count(*)::int from public.messages where to_address = '+919800000171' and rule_code = p_rule $$;

insert into public.job_batches (job_id, name, planned_from, planned_to) values ('70000000-0000-0000-0000-0000000000e1', 'Batch 1 · Rooms 301–302', current_date + 2, current_date + 9);
select is(pg_temp.sent('CN9'), 1, 'CN9: dates confirmed when a batch gets its dates');

update public.jobs set current_stage = 'removal_pickup' where id = '70000000-0000-0000-0000-0000000000e1';
select is(pg_temp.sent('CN10'), 1, 'CN10: the job moving a stage tells the customer');
select is((select variables ->> 'unit' from public.messages where to_address = '+919800000171' and rule_code = 'CN10'), 'Rooms 301, 302',
  'CN10: one message for the job, naming its rooms — not one per room');
update public.jobs set current_stage = 'removal_pickup', updated_at = now() where id = '70000000-0000-0000-0000-0000000000e1';
select is(pg_temp.sent('CN10'), 1, 'CN10: no repeat without a stage change');

insert into public.handovers (id, job_unit_id, leak_check, operation_check, finish_check, customer_name)
values ('72000000-0000-0000-0000-0000000000e1', '71000000-0000-0000-0000-0000000000e1', true, true, true, 'Meena Kohli');
select is(pg_temp.sent('CN11'), 1, 'CN11: a room signed off is announced');
select is((select variables ->> 'warranty' from public.messages where to_address = '+919800000171' and rule_code = 'CN11'),
  '12 months mechanical · 24 months finish', 'CN11: warranty in months, from the quote''s frozen terms');

insert into public.invoice_series (id, code, fy_start, fy_end, next_number)
values ('73000000-0000-0000-0000-0000000000e1', 'NTFY', public.fy_start_of(current_date), (public.fy_start_of(current_date) + interval '1 year - 1 day')::date, 2)
on conflict do nothing;
insert into public.invoices (id, job_id, quotation_id, customer_id, recipient_name, recipient_address, place_of_supply_state_code, total)
values ('74000000-0000-0000-0000-0000000000e1', '70000000-0000-0000-0000-0000000000e1', '60000000-0000-0000-0000-0000000000e1',
        '30000000-0000-0000-0000-0000000000e1', 'Notify Hotel', 'Ring Road', '07', 245524.00);
update public.invoices set status = 'issued', invoice_no = 'NTFY/0001', series_id = (select id from public.invoice_series where code = 'NTFY' limit 1),
  issue_date = current_date, due_date = current_date, supplier_gstin = '07AAACE1234F1Z5', supplier_name = 'REDUX', supplier_address = 'Delhi',
  payment_route = 'virtual_account'
where id = '74000000-0000-0000-0000-0000000000e1';
select is(pg_temp.sent('CN12'), 1, 'CN12: an issued invoice is sent');
select is((select variables ->> 'amount' from public.messages where to_address = '+919800000171' and rule_code = 'CN12'), '₹2,45,524.00',
  'money in the message uses Indian grouping (rule 5)');

insert into public.payments (invoice_id, provider_payment_id, method, amount, status, captured_at)
values ('74000000-0000-0000-0000-0000000000e1', 'pay_notify_1', 'neft', 245524.00, 'captured', now());
select is(pg_temp.sent('CN13'), 1, 'CN13: a captured payment is acknowledged');

insert into public.service_requests (request_no, customer_id, subject, ack_due_at, resolve_due_at)
values ('SR-NOTIFY-1', '30000000-0000-0000-0000-0000000000e1', 'Drip from basin mixer in 301', now() + interval '1 day', now() + interval '3 days');
select is(pg_temp.sent('CN16'), 1, 'CN16: a service request is acknowledged on arrival');

select * from finish();
rollback;
