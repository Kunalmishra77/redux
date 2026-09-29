-- The customer-facing WhatsApp rules that had no trigger (05-content/02-whatsapp-templates.md,
-- notification matrix): CN9 dates confirmed, CN10 job update, CN11 handover, CN12 invoice,
-- CN13 payment, CN16 service request received. Same pattern as CN1/CN2/CN7: enqueue in the same
-- transaction as the change, dedup key per event, quiet hours from the rule.

-- The contact a customer message goes to: the primary active contact, else any active one
create or replace function public.customer_contact(p_customer uuid, out phone text, out name text)
language sql stable security definer set search_path = '' as $$
  select cc.phone, cc.name from public.customer_contacts cc
  where cc.customer_id = p_customer and cc.is_active
  order by cc.is_primary desc, cc.name limit 1;
$$;
revoke execute on function public.customer_contact(uuid) from public, anon, authenticated;

-- Stage in plain words, as the customer reads it (job_update {{4}})
create or replace function public.stage_words(p public.job_stage) returns text
language sql immutable set search_path = '' as $$
  select case p
    when 'dates_confirmed' then 'dates confirmed'
    when 'removal_pickup'  then 'fittings removed and on the way to the Eurobrass factory'
    when 'at_eurobrass'    then 'at the Eurobrass factory for restoration'
    when 'quality_check'   then 'restored and in quality check'
    when 'refit_test'      then 'refitted and being tested'
    when 'handover'        then 'handed over and back in service'
    else 'warranty active' end;
$$;

-- ₹ with Indian digit grouping, as every template shows money (CLAUDE.md rule 5)
create or replace function public.inr(p numeric) returns text
language sql immutable set search_path = '' as $$
  select '₹' || trim(to_char(p, 'FM99,99,99,99,990.00'));
$$;

-- "Room" for hotels, "Bathroom" for homes (glossary)
create or replace function public.unit_noun(p_customer uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case (select type from public.customers where id = p_customer) when 'home' then 'Bathroom' else 'Room' end;
$$;

-- CN9: a batch gets its dates
create or replace function public.on_batch_dated() returns trigger
language plpgsql security definer set search_path = '' as $$
declare j public.jobs%rowtype; c record;
begin
  select * into j from public.jobs where id = new.job_id;
  select * into c from public.customer_contact(j.customer_id);
  perform public.notify_customer('CN9', c.phone, null, j.customer_id, 'jobs', j.id,
    jsonb_build_object('name', split_part(c.name, ' ', 1), 'job_no', j.job_no, 'batch', new.name,
                       'from', to_char(new.planned_from, 'DD Mon YYYY'), 'to', to_char(new.planned_to, 'DD Mon YYYY')),
    'CN9:' || new.id || ':' || new.planned_from);
  return null;
end $$;
create trigger trg_batch_dated_notify after insert or update of planned_from, planned_to on public.job_batches
  for each row when (new.planned_from is not null and new.planned_to is not null)
  execute function public.on_batch_dated();

-- CN10: the JOB moves a stage (the least advanced room sets it) — one message per step, not one per
-- room: a 120-room hotel must not get 480 WhatsApps. Handover and warranty have their own message.
create or replace function public.on_job_stage_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c record; v_units text;
begin
  if new.current_stage in ('dates_confirmed', 'handover', 'warranty_active') then return null; end if;
  select * into c from public.customer_contact(new.customer_id);
  select case when count(*) <= 5
              then public.unit_noun(new.customer_id) || case when count(*) > 1 then 's ' else ' ' end
                   || string_agg(pu.label, ', ' order by pu.label)
              else count(*) || ' ' || lower(public.unit_noun(new.customer_id)) || 's' end
  into v_units
  from public.job_units u join public.property_units pu on pu.id = u.property_unit_id
  where u.job_id = new.id;
  perform public.notify_customer('CN10', c.phone, null, new.customer_id, 'jobs', new.id,
    jsonb_build_object('name', split_part(c.name, ' ', 1), 'job_no', new.job_no, 'unit', coalesce(v_units, 'Your rooms'),
                       'stage', public.stage_words(new.current_stage)),
    'CN10:' || new.id || ':' || new.current_stage);
  return null;
end $$;
create trigger trg_job_stage_notify after update of current_stage on public.jobs
  for each row when (new.current_stage is distinct from old.current_stage and new.current_stage > old.current_stage)
  execute function public.on_job_stage_changed();

-- CN11: a room is signed off and back in service
create or replace function public.on_handover() returns trigger
language plpgsql security definer set search_path = '' as $$
declare u record; c record; v_fittings int; q public.quotations%rowtype;
begin
  select ju.job_id, j.customer_id, j.quotation_id, pu.label into u
  from public.job_units ju join public.jobs j on j.id = ju.job_id join public.property_units pu on pu.id = ju.property_unit_id
  where ju.id = new.job_unit_id;
  select * into q from public.quotations where id = u.quotation_id;
  select count(*) into v_fittings from public.quotation_lines where quotation_id = u.quotation_id and unit_label = u.label;
  select * into c from public.customer_contact(u.customer_id);
  perform public.notify_customer('CN11', c.phone, null, u.customer_id, 'jobs', u.job_id,
    jsonb_build_object('name', split_part(c.name, ' ', 1), 'unit', public.unit_noun(u.customer_id) || ' ' || u.label,
                       'fittings', v_fittings,
                       'warranty', concat_ws(' · ',
                         case when q.warranty_mechanical_days is not null then round(q.warranty_mechanical_days / 30.4) || ' months mechanical' end,
                         case when q.warranty_finish_days is not null then round(q.warranty_finish_days / 30.4) || ' months finish' end)),
    'CN11:' || new.id);
  return null;
end $$;
create trigger trg_handover_notify after insert on public.handovers
  for each row execute function public.on_handover();

-- CN12: an invoice is issued
create or replace function public.on_invoice_issued() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c record; v_job text;
begin
  select * into c from public.customer_contact(new.customer_id);
  select job_no into v_job from public.jobs where id = new.job_id;
  perform public.notify_customer('CN12', c.phone, null, new.customer_id, 'invoices', new.id,
    jsonb_build_object('name', split_part(c.name, ' ', 1), 'invoice_no', new.invoice_no, 'job_no', coalesce(v_job, '—'),
                       'amount', public.inr(new.total), 'due', to_char(coalesce(new.due_date, new.issue_date), 'DD Mon YYYY')),
    'CN12:' || new.id);
  return null;
end $$;
create trigger trg_invoice_issued_notify after update of status on public.invoices
  for each row when (new.status = 'issued' and old.status = 'draft')
  execute function public.on_invoice_issued();

-- CN13: a payment is captured (the webhook, or the demo's simulated capture — same function)
create or replace function public.on_payment_captured() returns trigger
language plpgsql security definer set search_path = '' as $$
declare i public.invoices%rowtype; c record;
begin
  select * into i from public.invoices where id = new.invoice_id;
  select * into c from public.customer_contact(i.customer_id);
  perform public.notify_customer('CN13', c.phone, null, i.customer_id, 'invoices', i.id,
    jsonb_build_object('name', split_part(c.name, ' ', 1), 'amount', public.inr(new.amount), 'invoice_no', i.invoice_no),
    'CN13:' || new.id);
  return null;
end $$;
create trigger trg_payment_captured_notify after insert or update of status on public.payments
  for each row when (new.status = 'captured')
  execute function public.on_payment_captured();

-- CN16: a service request is received
-- (TN12 already tells the care queue; this is the customer's side)
create or replace function public.on_service_request() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c record;
begin
  select * into c from public.customer_contact(new.customer_id);
  perform public.notify_customer('CN16', c.phone, null, new.customer_id, 'service_requests', new.id,
    jsonb_build_object('name', split_part(c.name, ' ', 1), 'request_no', new.request_no, 'subject', new.subject),
    'CN16:' || new.id);
  return null;
end $$;
create trigger trg_service_request_customer_notify after insert on public.service_requests
  for each row execute function public.on_service_request();
