-- CR-001 phase 5 (E22, D28) — free demos, separate from the paid pilot (C3).
--   BR-D1 every demo needs Super Admin approval before it is scheduled
--   BR-D2 eligibility by tier (A → room demo, B → single-fitting demo, C → none); one demo per
--         account per type unless the Super Admin allows another (proposal carries the reason)
--   BR-D3 internal cost recorded; demo work carries the same warranty as paid work
--   BR-D4 converted when a quotation for the same account is approved after the demo
--
-- Execution reuses jobs (CR §3.5): jobs.kind = project | pilot | demo; a demo job has no quotation
-- (allowed only for kind = demo). Units, stages, blocks, handover, photos and portal tracking are the
-- same. The fittings worked on come from the account's own assessment (demo_items). Demo jobs are
-- never invoiced.

-- ---------------------------------------------------------------------------
-- jobs gain a kind
-- ---------------------------------------------------------------------------
alter table public.jobs
  add column kind text not null default 'project' check (kind in ('project', 'pilot', 'demo')),
  alter column quotation_id drop not null,
  add constraint jobs_quote_unless_demo check (quotation_id is not null or kind = 'demo');
update public.jobs set kind = 'pilot' where is_pilot and kind = 'project';
create index jobs_kind_idx on public.jobs (kind) where kind <> 'project';

-- a demo job is never invoiced (BR-D3: it is REDUX's investment)
create or replace function public.guard_invoice_not_demo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.jobs where id = new.job_id and kind = 'demo') then
    raise exception 'A demo is free — it is never invoiced' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger trg_invoice_not_demo before insert on public.invoices
  for each row execute function public.guard_invoice_not_demo();

-- the invoice-from-job step says so in words (and its quote check no longer passes on a missing quote)
create or replace function public.create_invoice_from_job(p_job uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  j     public.jobs%rowtype;
  q     public.quotations%rowtype;
  c     public.customers%rowtype;
  v_inv uuid;
begin
  if not public.is_system_caller() and not public.current_role_is('super_admin') then
    raise exception 'Only a super_admin raises invoices' using errcode = '42501';
  end if;
  select * into j from public.jobs where id = p_job;
  if not found then raise exception 'Job not found' using errcode = 'P0002'; end if;
  if j.kind = 'demo' then
    raise exception 'A demo is free — it is never invoiced' using errcode = '23514';
  end if;
  select * into q from public.quotations where id = j.quotation_id;
  select * into c from public.customers where id = j.customer_id;
  if q.status is distinct from 'approved' then
    raise exception 'Only an approved quote is invoiced' using errcode = '22023';
  end if;

  insert into public.invoices (job_id, quotation_id, customer_id, supply_date,
    recipient_gstin, recipient_name, recipient_address, place_of_supply_state_code,
    subtotal, discount_amount, taxable_value, cgst, sgst, igst, total, created_by)
  select j.id, q.id, c.id, coalesce(j.actual_end, (now() at time zone 'Asia/Kolkata')::date),
         c.gstin, c.name, coalesce(c.billing_address, p.address),
         coalesce(q.place_of_supply_state_code, c.billing_state_code),
         q.subtotal, q.discount_amount, q.taxable_value, q.cgst, q.sgst, q.igst, q.total, (select auth.uid())
  from public.properties p where p.id = q.property_id
  returning id into v_inv;

  insert into public.invoice_lines (invoice_id, description, hsn_sac, qty, unit_price, taxable_value, gst_rate,
                                    cgst, sgst, igst, line_total, sort_order)
  select v_inv, coalesce(l.unit_label || ' · ', '') || l.description, l.hsn_sac, l.qty, l.unit_price,
         l.taxable_value, l.gst_rate, l.cgst, l.sgst, l.igst,
         l.taxable_value + l.cgst + l.sgst + l.igst, l.sort_order
  from public.quotation_lines l where l.quotation_id = q.id;

  return v_inv;
end $$;
revoke execute on function public.create_invoice_from_job(uuid) from public, anon;
grant execute on function public.create_invoice_from_job(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Masters and records
-- ---------------------------------------------------------------------------
create table public.demo_types (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  name           text not null,
  description    text,
  max_units      int not null default 1 check (max_units > 0),
  max_fittings   int not null default 1 check (max_fittings > 0),
  cost_cap       numeric(12,2) check (cost_cap is null or cost_cap >= 0),   -- internal guide; above it is flagged
  eligible_tiers text[] not null default '{A}',
  is_active      boolean not null default true,
  sort_order     int not null default 0
);
create trigger trg_audit_demo_types after insert or update or delete on public.demo_types
  for each row execute function public.write_audit();
insert into public.demo_types (code, name, description, max_units, max_fittings, cost_cap, eligible_tiers, sort_order) values
  ('room_demo',    'Room demo',           'Every fitting in one room or bathroom restored, free', 1, 8, 15000, '{A}',     10),
  ('fitting_demo', 'Single-fitting demo', 'One fitting restored, free — on site or shipped in',   1, 1, 3000,  '{A,B}',   20)
on conflict (code) do nothing;

create sequence public.demo_no_seq;

create table public.demos (
  id                 uuid primary key default gen_random_uuid(),
  demo_no            text not null unique,
  demo_type_id       uuid not null references public.demo_types(id),
  customer_id        uuid not null references public.customers(id),
  property_id        uuid not null references public.properties(id),
  lead_id            uuid references public.leads(id),
  status             text not null default 'proposed' check (status in
                       ('proposed', 'approved', 'rejected', 'scheduled', 'in_progress', 'completed', 'converted', 'not_converted', 'cancelled')),
  note               text,
  exception_reason   text,                                   -- BR-D2: why a second / out-of-tier demo
  requested_by       uuid references public.profiles(id),
  decided_by         uuid references public.profiles(id),
  decided_at         timestamptz,
  decision_note      text,
  scheduled_for      date,
  job_id             uuid unique references public.jobs(id),
  internal_cost      numeric(12,2) check (internal_cost is null or internal_cost >= 0),   -- BR-D3
  result             text check (result in ('pass', 'needs_work')),
  customer_rating    int check (customer_rating between 1 and 5),
  feedback           text,
  feedback_at        timestamptz,
  converted_quote_id uuid references public.quotations(id),
  converted_at       timestamptz,
  closed_note        text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint demos_rejected_has_note check (status <> 'rejected' or length(trim(decision_note)) > 0)
);
create index demos_customer_idx on public.demos (customer_id);
create index demos_lead_idx on public.demos (lead_id);
create index demos_status_idx on public.demos (status);
create index demos_type_idx on public.demos (demo_type_id);
create index demos_property_idx on public.demos (property_id);
create trigger trg_demos_updated before update on public.demos
  for each row execute function public.set_updated_at();
create trigger trg_audit_demos after insert or update on public.demos
  for each row execute function public.write_audit();

create table public.demo_items (
  id           uuid primary key default gen_random_uuid(),
  demo_id      uuid not null references public.demos(id),
  fitting_id   uuid not null references public.fittings(id),
  work_type_id uuid not null references public.work_types(id),
  finish_id    uuid references public.finishes(id),
  unique (demo_id, fitting_id)
);
create index demo_items_demo_idx on public.demo_items (demo_id);
create index demo_items_fitting_idx on public.demo_items (fitting_id);

-- ---------------------------------------------------------------------------
-- Workflow (one function per step; CR §4)
-- ---------------------------------------------------------------------------
-- p: {customer_id, lead_id?, type: code, note?, exception_reason?,
--     items: [{fitting_id, work_type?: code, finish_id?}]}
create or replace function public.propose_demo(p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_customer uuid := (p ->> 'customer_id')::uuid;
  v_lead     uuid := nullif(p ->> 'lead_id', '')::uuid;
  t          public.demo_types%rowtype;
  v_tier     text;
  v_reason   text := nullif(trim(p ->> 'exception_reason'), '');
  v_props    int;
  v_property uuid;
  v_units    int;
  v_count    int;
  v_id       uuid;
begin
  if not ((select public.current_role_is('super_admin')) or public.can_work_account(v_customer)
          or ((select public.current_role_is('cc_exec')) and exists (select 1 from public.leads where id = v_lead and assigned_to = (select auth.uid())))) then
    raise exception 'Only the account''s executive or the Super Admin can propose a demo' using errcode = '42501';
  end if;
  select * into t from public.demo_types where code = p ->> 'type' and is_active;
  if not found then raise exception 'Unknown demo type' using errcode = '22023'; end if;

  -- BR-D2: tier eligibility, and one per account per type — unless a reason is given for the approver
  v_tier := coalesce((select tier from public.leads where id = v_lead), (select tier from public.customers where id = v_customer));
  if v_reason is null and (v_tier is null or not (v_tier = any (t.eligible_tiers))) then
    raise exception 'A % is for tier % accounts; this one is tier % — give a reason to ask for an exception',
      lower(t.name), array_to_string(t.eligible_tiers, '/'), coalesce(v_tier, 'unscored') using errcode = '23514';
  end if;
  if v_reason is null and exists (select 1 from public.demos d where d.customer_id = v_customer and d.demo_type_id = t.id
                                  and d.status not in ('rejected', 'cancelled')) then
    raise exception 'This account already has a % — give a reason to ask for another', lower(t.name) using errcode = '23514';
  end if;

  -- the items: fittings from this account's own submitted assessments, on one site, within the type's scope
  select count(*), count(distinct s.property_id), min(s.property_id::text)::uuid,
         count(distinct coalesce(pu.label, f.unit_label))
  into v_count, v_props, v_property, v_units
  from jsonb_array_elements(coalesce(p -> 'items', '[]'::jsonb)) i
  join public.fittings f on f.id = (i ->> 'fitting_id')::uuid
  join public.surveys s on s.id = f.survey_id and s.status = 'submitted'
  join public.properties pr on pr.id = s.property_id and pr.customer_id = v_customer
  left join public.property_units pu on pu.id = f.property_unit_id;
  if v_count = 0 or v_count <> jsonb_array_length(coalesce(p -> 'items', '[]'::jsonb)) then
    raise exception 'Choose fittings from this account''s submitted assessments' using errcode = '23514';
  end if;
  if v_props > 1 then raise exception 'A demo is at one site' using errcode = '23514'; end if;
  if v_count > t.max_fittings or v_units > t.max_units then
    raise exception 'A % covers up to % fitting(s) in % room(s)', lower(t.name), t.max_fittings, t.max_units using errcode = '23514';
  end if;

  insert into public.demos (demo_no, demo_type_id, customer_id, property_id, lead_id, note, exception_reason, requested_by)
  values ('D-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY') || '-' || lpad(nextval('public.demo_no_seq')::text, 4, '0'),
          t.id, v_customer, v_property, v_lead, nullif(trim(p ->> 'note'), ''), v_reason, (select auth.uid()))
  returning id into v_id;

  insert into public.demo_items (demo_id, fitting_id, work_type_id, finish_id)
  select v_id, f.id,
         coalesce((select w.id from public.work_types w where w.code = i ->> 'work_type'),
                  (select w.id from public.assessments a join public.work_types w on w.code = a.recommended::text where a.fitting_id = f.id),
                  (select w.id from public.work_types w where w.code = 'restore_finish')),
         coalesce(nullif(i ->> 'finish_id', '')::uuid, (select a.finish_id from public.assessments a where a.fitting_id = f.id))
  from jsonb_array_elements(p -> 'items') i join public.fittings f on f.id = (i ->> 'fitting_id')::uuid;

  perform public.notify_team('TN19', 'Demo to approve',
    (select name from public.customers where id = v_customer) || ' · ' || t.name || coalesce(' · exception: ' || v_reason, ''),
    'demos', v_id, 'TN19:' || v_id);
  return v_id;
end $$;
revoke execute on function public.propose_demo(jsonb) from public, anon;
grant execute on function public.propose_demo(jsonb) to authenticated;

-- BR-D1: the Super Admin approves or rejects every demo
create or replace function public.decide_demo(p_demo uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare d public.demos%rowtype;
begin
  if not (select public.current_role_is('super_admin')) then
    raise exception 'Every demo is approved by the Super Admin' using errcode = '42501';
  end if;
  select * into d from public.demos where id = p_demo for update;
  if not found then raise exception 'Demo not found' using errcode = 'P0002'; end if;
  if d.status <> 'proposed' then raise exception 'This demo has already been decided' using errcode = '22023'; end if;
  if not p_approve and length(trim(coalesce(p_note, ''))) < 3 then
    raise exception 'Say why it is rejected' using errcode = '23514';
  end if;
  update public.demos set status = case when p_approve then 'approved' else 'rejected' end,
    decided_by = (select auth.uid()), decided_at = now(), decision_note = nullif(trim(p_note), '')
  where id = p_demo;
  if d.requested_by is not null then
    perform public.notify_team('TN20', case when p_approve then 'Demo approved' else 'Demo rejected' end,
      d.demo_no || coalesce(' — ' || nullif(trim(p_note), ''), ''), 'demos', p_demo, 'TN20:' || p_demo, d.requested_by);
  end if;
end $$;
revoke execute on function public.decide_demo(uuid, boolean, text) from public, anon;
grant execute on function public.decide_demo(uuid, boolean, text) to authenticated;

-- schedule an approved demo: opens its job (kind demo) with the rooms and fittings of the demo
create or replace function public.schedule_demo(p_demo uuid, p_date date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare d public.demos%rowtype; v_job uuid; c record; v_type text; v_prop text;
begin
  select * into d from public.demos where id = p_demo for update;
  if not found then raise exception 'Demo not found' using errcode = 'P0002'; end if;
  if not ((select public.current_role_is('super_admin')) or public.can_work_account(d.customer_id)
          or ((select public.current_role_is('cc_exec')) and exists (select 1 from public.leads where id = d.lead_id and assigned_to = (select auth.uid())))) then
    raise exception 'Only the account''s executive or the Super Admin can schedule this' using errcode = '42501';
  end if;
  if d.status <> 'approved' then
    raise exception 'A demo is scheduled only after the Super Admin approves it (BR-D1)' using errcode = '22023';
  end if;
  if p_date is null or p_date < (now() at time zone 'Asia/Kolkata')::date then
    raise exception 'Pick a date from today on' using errcode = '22023';
  end if;

  -- the rooms named by the demo's fittings exist as property units, and the fittings point at them
  insert into public.property_units (property_id, label)
  select distinct d.property_id, f.unit_label from public.demo_items i join public.fittings f on f.id = i.fitting_id
  where i.demo_id = d.id and f.property_unit_id is null and f.unit_label is not null
  on conflict (property_id, label) do nothing;
  update public.fittings f set property_unit_id = pu.id
  from public.demo_items i, public.property_units pu
  where i.demo_id = d.id and f.id = i.fitting_id and f.property_unit_id is null
    and pu.property_id = d.property_id and pu.label = f.unit_label;

  insert into public.jobs (job_no, kind, customer_id, property_id, planned_start, planned_end)
  values ('J-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY') || '-' || lpad(nextval('public.job_no_seq')::text, 4, '0'),
          'demo', d.customer_id, d.property_id, p_date, p_date)
  returning id into v_job;
  insert into public.job_units (job_id, property_unit_id)
  select distinct v_job, f.property_unit_id from public.demo_items i join public.fittings f on f.id = i.fitting_id
  where i.demo_id = d.id and f.property_unit_id is not null;
  if not exists (select 1 from public.job_units where job_id = v_job) then
    raise exception 'The demo''s fittings name no room' using errcode = '23514';
  end if;
  insert into public.job_stage_events (job_id, to_stage, note) values (v_job, 'dates_confirmed', 'Demo ' || d.demo_no || ' scheduled');

  update public.demos set status = 'scheduled', scheduled_for = p_date, job_id = v_job where id = d.id;

  select name into v_type from public.demo_types where id = d.demo_type_id;
  select name into v_prop from public.properties where id = d.property_id;
  select * into c from public.customer_contact(d.customer_id);
  perform public.notify_customer('CN23', c.phone, d.lead_id, d.customer_id, 'demos', d.id,
    jsonb_build_object('name', split_part(c.name, ' ', 1), 'demo', lower(v_type), 'property', v_prop,
                       'date', to_char(p_date, 'DD Mon YYYY'), 'job_no', (select job_no from public.jobs where id = v_job)),
    'CN23:' || d.id);
  return v_job;
end $$;
revoke execute on function public.schedule_demo(uuid, date) from public, anon;
grant execute on function public.schedule_demo(uuid, date) to authenticated;

-- the demo follows its job: started → in progress, completed → completed
create or replace function public.on_demo_job_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.demos set status = case new.status when 'completed' then 'completed' else 'in_progress' end
  where job_id = new.id and status in ('scheduled', 'in_progress')
    and new.status in ('in_progress', 'completed');
  return null;
end $$;
create trigger trg_demo_job_status after update of status on public.jobs
  for each row when (new.kind = 'demo' and new.status is distinct from old.status)
  execute function public.on_demo_job_status();

-- BR-D3: result, internal cost and the team's notes (staff); the customer's rating comes separately
create or replace function public.record_demo_outcome(p_demo uuid, p jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare d public.demos%rowtype;
begin
  select * into d from public.demos where id = p_demo for update;
  if not found then raise exception 'Demo not found' using errcode = 'P0002'; end if;
  if not ((select public.current_role_is('super_admin')) or public.can_work_account(d.customer_id)
          or ((select public.current_role_is('cc_exec')) and exists (select 1 from public.leads where id = d.lead_id and assigned_to = (select auth.uid())))) then
    raise exception 'Not allowed to update this demo' using errcode = '42501';
  end if;
  if p ? 'internal_cost' and not (select public.current_role_is('super_admin')) then
    raise exception 'Only the Super Admin records the demo cost' using errcode = '42501';
  end if;
  update public.demos set
    result        = case when p ? 'result' then nullif(p ->> 'result', '') else result end,
    internal_cost = case when p ? 'internal_cost' then nullif(p ->> 'internal_cost', '')::numeric else internal_cost end,
    feedback      = case when p ? 'feedback' then nullif(trim(p ->> 'feedback'), '') else feedback end,
    feedback_at   = case when p ? 'feedback' then now() else feedback_at end
  where id = p_demo;
end $$;
revoke execute on function public.record_demo_outcome(uuid, jsonb) from public, anon;
grant execute on function public.record_demo_outcome(uuid, jsonb) to authenticated;

-- close a demo that did not convert, or cancel one that will not happen
create or replace function public.close_demo(p_demo uuid, p_outcome text, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare d public.demos%rowtype;
begin
  select * into d from public.demos where id = p_demo for update;
  if not found then raise exception 'Demo not found' using errcode = 'P0002'; end if;
  if not ((select public.current_role_is('super_admin')) or public.can_work_account(d.customer_id)) then
    raise exception 'Not allowed to close this demo' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_note, ''))) < 3 then raise exception 'Add a short note' using errcode = '23514'; end if;
  if p_outcome = 'not_converted' and d.status <> 'completed' then
    raise exception 'Only a completed demo is closed as not converted' using errcode = '22023';
  elsif p_outcome = 'cancelled' and d.status not in ('proposed', 'approved', 'scheduled') then
    raise exception 'Only a demo that has not started can be cancelled' using errcode = '22023';
  elsif p_outcome not in ('not_converted', 'cancelled') then
    raise exception 'Unknown outcome' using errcode = '22023';
  end if;
  if p_outcome = 'cancelled' and d.job_id is not null then
    update public.jobs set status = 'cancelled' where id = d.job_id and status = 'planned';
  end if;
  update public.demos set status = p_outcome, closed_note = trim(p_note) where id = p_demo;
end $$;
revoke execute on function public.close_demo(uuid, text, text) from public, anon;
grant execute on function public.close_demo(uuid, text, text) to authenticated;

-- BR-D4: a quotation approved for the same account after a completed demo converts it
create or replace function public.on_quote_approved_convert_demo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.demos set status = 'converted', converted_quote_id = new.id, converted_at = now()
  where customer_id = new.customer_id and status = 'completed';
  return null;
end $$;
create trigger trg_quote_approved_convert_demo after update of status on public.quotations
  for each row when (new.status = 'approved' and old.status is distinct from 'approved')
  execute function public.on_quote_approved_convert_demo();

-- the customer rates their demo from the portal
create or replace function public.rate_my_demo(p_demo uuid, p_rating int, p_comment text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_rating not between 1 and 5 then raise exception 'Rate from 1 to 5' using errcode = '22023'; end if;
  update public.demos set customer_rating = p_rating,
    feedback = concat_ws(E'\n', feedback, 'Customer: ' || nullif(trim(p_comment), '')), feedback_at = now()
  where id = p_demo and customer_id = any (public.my_customer_ids()) and status in ('completed', 'converted', 'not_converted');
  if not found then raise exception 'This demo is not on your account, or is not finished yet' using errcode = '42501'; end if;
end $$;
revoke execute on function public.rate_my_demo(uuid, int, text) from public, anon;
grant execute on function public.rate_my_demo(uuid, int, text) to authenticated;

-- What a customer sees of their demos: never the internal cost, the exception reason or the approver.
create or replace function public.my_demos()
returns table (id uuid, demo_no text, type_name text, status text, property_name text, scheduled_for date,
               job_id uuid, fittings int, customer_rating int)
language sql stable security definer set search_path = '' as $$
  select d.id, d.demo_no, t.name, d.status, p.name, d.scheduled_for, d.job_id,
         (select count(*)::int from public.demo_items i where i.demo_id = d.id), d.customer_rating
  from public.demos d join public.demo_types t on t.id = d.demo_type_id join public.properties p on p.id = d.property_id
  where d.customer_id = any (public.my_customer_ids()) and d.status not in ('proposed', 'rejected', 'cancelled')
  order by d.created_at desc;
$$;
revoke execute on function public.my_demos() from public, anon;
grant execute on function public.my_demos() to authenticated;

-- ---------------------------------------------------------------------------
-- Handover on a demo job: same checks; warranty from the current terms (BR-D3: same as paid work)
-- ---------------------------------------------------------------------------
create or replace function public.record_handover(p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  u          public.job_units%rowtype;
  q          public.quotations%rowtype;
  v_terms    jsonb;
  v_handover uuid;
  v_today    date := (now() at time zone 'Asia/Kolkata')::date;
begin
  select * into u from public.job_units where id = (p ->> 'job_unit_id')::uuid for update;
  if not found then raise exception 'Unit not found' using errcode = 'P0002'; end if;
  if not public.can_run_job(u.job_id) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if u.status = 'blocked' then raise exception 'The unit is blocked' using errcode = '22023'; end if;
  if u.current_stage <> 'refit_test' then
    raise exception 'Handover follows refit & test (BR-J1); the unit is at %', u.current_stage using errcode = '23514';
  end if;
  if not (coalesce((p ->> 'leak_check')::boolean, false) and coalesce((p ->> 'operation_check')::boolean, false)
          and coalesce((p ->> 'finish_check')::boolean, false)) then
    raise exception 'Leak, operation and finish must all pass before the room returns to service (D11-07)'
      using errcode = '23514';
  end if;

  insert into public.handovers (job_unit_id, surveyor_id, leak_check, operation_check, finish_check,
                                customer_name, signature_path, notes)
  values (u.id, (select auth.uid()), true, true, true,
          coalesce(nullif(trim(p ->> 'customer_name'), ''), 'Not recorded'),
          p ->> 'signature_path', nullif(trim(p ->> 'notes'), ''))
  returning id into v_handover;

  update public.job_units set current_stage = 'handover', status = 'back_in_service',
    back_in_service_at = now(), downtime_to = now()
  where id = u.id;
  insert into public.job_stage_events (job_id, job_unit_id, from_stage, to_stage, actor_id, note)
  values (u.job_id, u.id, 'refit_test', 'handover', (select auth.uid()), 'Handover signed off');

  select qt.* into q from public.quotations qt join public.jobs j on j.quotation_id = qt.id where j.id = u.job_id;
  if q.id is not null then
    -- BR-J4: the warranty starts when the fitting is back in service, from the QUOTE's terms (BR-Q3)
    insert into public.warranties (job_id, job_unit_id, fitting_id, kind, valid_from, valid_until, terms_text, card_no)
    select u.job_id, u.id, l.fitting_id, k.kind, v_today, v_today + k.days, q.terms_text,
           'W-' || to_char(v_today, 'YYYY') || '-' || lpad(nextval('public.warranty_card_seq')::text, 5, '0')
    from public.quotation_lines l
    join public.fittings f on f.id = l.fitting_id
    join public.work_types w on w.id = l.work_type_id
    cross join lateral (values
        ('mechanical', q.warranty_mechanical_days, w.code in ('repair_function','replace_eurobrass')),
        ('finish',     q.warranty_finish_days,     w.code in ('restore_finish','replace_eurobrass'))
      ) k(kind, days, applies)
    where l.quotation_id = q.id and f.property_unit_id = u.property_unit_id
      and k.applies and k.days is not null
    on conflict (fitting_id, job_id, kind) do nothing;
  else
    -- BR-D3: a demo carries the same warranty as paid work, from the warranty terms in force today
    v_terms := (select value from public.settings where key = 'warranty_terms');
    insert into public.warranties (job_id, job_unit_id, fitting_id, kind, valid_from, valid_until, terms_text, card_no)
    select u.job_id, u.id, i.fitting_id, k.kind, v_today, v_today + k.days,
           coalesce(v_terms ->> 'text', 'REDUX warranty'),
           'W-' || to_char(v_today, 'YYYY') || '-' || lpad(nextval('public.warranty_card_seq')::text, 5, '0')
    from public.demos d
    join public.demo_items i on i.demo_id = d.id
    join public.fittings f on f.id = i.fitting_id
    join public.work_types w on w.id = i.work_type_id
    cross join lateral (values
        ('mechanical', (v_terms ->> 'mechanical_days')::int, w.code in ('repair_function','replace_eurobrass')),
        ('finish',     (v_terms ->> 'finish_days')::int,     w.code in ('restore_finish','replace_eurobrass'))
      ) k(kind, days, applies)
    where d.job_id = u.job_id and f.property_unit_id = u.property_unit_id
      and k.applies and k.days is not null
    on conflict (fitting_id, job_id, kind) do nothing;
  end if;

  update public.job_units set current_stage = 'warranty_active' where id = u.id;
  insert into public.job_stage_events (job_id, job_unit_id, from_stage, to_stage, actor_id, note)
  values (u.job_id, u.id, 'handover', 'warranty_active', (select auth.uid()), 'Warranty cards generated');

  perform public.rollup_job(u.job_id);
  return v_handover;
end $$;
revoke execute on function public.record_handover(jsonb) from public, anon;
grant execute on function public.record_handover(jsonb) to authenticated;

-- CN11 on a demo room: fittings counted from the demo, warranty from the terms in force
create or replace function public.on_handover() returns trigger
language plpgsql security definer set search_path = '' as $$
declare u record; c record; v_fittings int; v_mech int; v_fin int; v_terms jsonb;
begin
  select ju.job_id, ju.property_unit_id, j.customer_id, j.quotation_id, pu.label into u
  from public.job_units ju join public.jobs j on j.id = ju.job_id join public.property_units pu on pu.id = ju.property_unit_id
  where ju.id = new.job_unit_id;
  if u.quotation_id is not null then
    select warranty_mechanical_days, warranty_finish_days into v_mech, v_fin from public.quotations where id = u.quotation_id;
    select count(*) into v_fittings from public.quotation_lines where quotation_id = u.quotation_id and unit_label = u.label;
  else
    v_terms := (select value from public.settings where key = 'warranty_terms');
    v_mech := (v_terms ->> 'mechanical_days')::int; v_fin := (v_terms ->> 'finish_days')::int;
    select count(*) into v_fittings from public.demos d join public.demo_items i on i.demo_id = d.id
      join public.fittings f on f.id = i.fitting_id where d.job_id = u.job_id and f.property_unit_id = u.property_unit_id;
  end if;
  select * into c from public.customer_contact(u.customer_id);
  perform public.notify_customer('CN11', c.phone, null, u.customer_id, 'jobs', u.job_id,
    jsonb_build_object('name', split_part(c.name, ' ', 1), 'unit', public.unit_noun(u.customer_id) || ' ' || u.label,
                       'fittings', v_fittings,
                       'warranty', concat_ws(' · ',
                         case when v_mech is not null then round(v_mech / 30.4) || ' months mechanical' end,
                         case when v_fin is not null then round(v_fin / 30.4) || ' months finish' end)),
    'CN11:' || new.id);
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- Messages
-- ---------------------------------------------------------------------------
insert into public.notification_rules (code, trigger_event, template_code, channel, category, audience, is_active, quiet_hours) values
  ('TN19', 'demo_proposed', null,             'in_app',   null,      'admin',       true, false),
  ('TN20', 'demo_decided',  null,             'in_app',   null,      'assigned_cc', true, false),
  ('CN23', 'demo_scheduled','demo_scheduled', 'whatsapp', 'utility', 'customer',    true, true)
on conflict (code) do nothing;
-- utility wording only (no offer language — Meta would reclassify it as marketing)
insert into public.message_templates (code, channel, category, language, body, variables, is_active) values
  ('demo_scheduled', 'whatsapp', 'utility', 'en',
   E'Hello {{1}},\n\nYour REDUX {{2}} at {{3}} is confirmed for {{4}} (job {{5}}). You can follow each step in your REDUX portal.',
   '["name","demo","property","date","job_no"]'::jsonb, true)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Timeline: + demos (staff only — customers cannot read demos, so the view hides them)
-- ---------------------------------------------------------------------------
create or replace view public.v_account_timeline with (security_invoker = true) as
  select l.customer_id, h.lead_id, h.changed_at as occurred_at, 'lead_status' as kind,
         case when h.from_status is null then 'Enquiry received' else 'Status: ' || replace(h.to_status::text, '_', ' ') end as title,
         h.note as detail, h.actor_id, 'leads' as entity_type, h.lead_id as entity_id
  from public.lead_status_history h join public.leads l on l.id = h.lead_id
  where l.customer_id is not null
  union all
  select l.customer_id, c.lead_id, c.started_at, 'call',
         'Call' || coalesce(' — ' || o.name, ''), c.outcome_note, c.agent_id, 'calls', c.id
  from public.calls c join public.leads l on l.id = c.lead_id
  left join public.call_outcomes o on o.id = c.outcome_id
  where l.customer_id is not null
  union all
  select l.customer_id, n.lead_id, n.created_at, 'note', 'Note', n.body, n.author_id, 'lead_notes', n.id
  from public.lead_notes n join public.leads l on l.id = n.lead_id
  where l.customer_id is not null
  union all
  select p.customer_id, s.lead_id, coalesce(s.submitted_at, s.scheduled_at), 'survey',
         case s.status when 'submitted' then 'Assessment completed' when 'cancelled' then 'Assessment cancelled'
              else 'Assessment booked' end,
         p.name, s.surveyor_id, 'surveys', s.id
  from public.surveys s join public.properties p on p.id = s.property_id
  union all
  select q.customer_id, q.lead_id, coalesce(q.issued_at, q.created_at), 'quotation',
         'Quotation ' || q.quote_no || ' v' || q.version || ' — ' || replace(q.status::text, '_', ' '),
         null, q.created_by, 'quotations', q.id
  from public.quotations q
  union all
  select q.customer_id, q.lead_id, a.otp_verified_at, 'approval',
         'Quotation ' || q.quote_no || ' approved by ' || a.approver_name, null, null, 'quotations', q.id
  from public.quote_approvals a join public.quotations q on q.id = a.quotation_id
  union all
  select j.customer_id, null::uuid, e.occurred_at, 'job_stage',
         'Job ' || j.job_no || ': ' || replace(e.to_stage::text, '_', ' '), e.note, e.actor_id, 'jobs', j.id
  from public.job_stage_events e join public.jobs j on j.id = e.job_id
  where e.job_unit_id is null or e.to_stage in ('handover')
  union all
  select i.customer_id, null::uuid, coalesce(i.issue_date::timestamptz, i.created_at), 'invoice',
         'Invoice ' || coalesce(i.invoice_no, 'draft') || ' — ' || replace(i.status::text, '_', ' '), null, i.created_by, 'invoices', i.id
  from public.invoices i
  union all
  select i.customer_id, null::uuid, coalesce(py.captured_at, py.created_at), 'payment',
         'Payment received', null, null, 'payments', py.id
  from public.payments py join public.invoices i on i.id = py.invoice_id
  where py.status = 'captured'
  union all
  select r.customer_id, null::uuid, r.created_at, 'service_request',
         'Service request ' || r.request_no || ': ' || r.subject, null, r.raised_by, 'service_requests', r.id
  from public.service_requests r
  union all
  select coalesce(m.customer_id, l.customer_id), m.lead_id, m.queued_at, 'message',
         'WhatsApp: ' || replace(coalesce(m.template_code, m.channel::text), '_', ' '), null, null, 'messages', m.id
  from public.messages m left join public.leads l on l.id = m.lead_id
  where coalesce(m.customer_id, l.customer_id) is not null and m.category is distinct from 'authentication'
  union all
  select a.customer_id, a.lead_id, a.occurred_at, 'activity', a.title, a.body, a.actor_id, 'account_activities', a.id
  from public.account_activities a
  union all
  select coalesce(wc.customer_id, l.customer_id), wc.lead_id, wm.occurred_at, 'whatsapp',
         case wm.direction when 'inbound' then 'WhatsApp from the customer' else 'WhatsApp reply' end,
         left(wm.body, 300), wm.sent_by, 'whatsapp_messages', wm.id
  from public.whatsapp_messages wm join public.whatsapp_conversations wc on wc.id = wm.conversation_id
  left join public.leads l on l.id = wc.lead_id
  where coalesce(wc.customer_id, l.customer_id) is not null
  union all
  select l.customer_id, f.lead_id, coalesce(f.completed_at, f.due_at), 'follow_up',
         case when f.completed_at is null then 'Follow-up due' else 'Follow-up done' end,
         f.note, f.assigned_to, 'follow_ups', f.id
  from public.follow_ups f join public.leads l on l.id = f.lead_id
  where l.customer_id is not null
  -- new in phase 5
  union all
  select d.customer_id, d.lead_id, d.updated_at, 'demo',
         'Demo ' || d.demo_no || ' (' || t.name || ') — ' || replace(d.status, '_', ' '),
         coalesce(d.decision_note, d.note), coalesce(d.decided_by, d.requested_by), 'demos', d.id
  from public.demos d join public.demo_types t on t.id = d.demo_type_id;

-- ---------------------------------------------------------------------------
-- Policies (ADR-004). Demos are staff-only (internal cost, exception reasons); customers read their
-- own through my_demos(). All writes go through the functions above.
-- ---------------------------------------------------------------------------
alter table public.demo_types enable row level security;
alter table public.demos      enable row level security;
alter table public.demo_items enable row level security;

create policy demo_types_read on public.demo_types for select to authenticated using ((select public.is_staff()));
create policy demo_types_write on public.demo_types for all to authenticated
  using ((select public.current_role_is('super_admin'))) with check ((select public.current_role_is('super_admin')));
create policy demos_select on public.demos for select to authenticated
  using ((select public.current_role_is('super_admin'))
         or ((select public.current_role_is('cc_exec'))
             and (public.staff_can_see_customer(customer_id) or public.can_work_account(customer_id))));
create policy demo_items_select on public.demo_items for select to authenticated
  using (exists (select 1 from public.demos d where d.id = demo_items.demo_id));
