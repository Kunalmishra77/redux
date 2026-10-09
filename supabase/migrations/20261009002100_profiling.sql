-- CR-001 phase 3 (E20, D26) — account 360° profiling.
--   * requirements and next action on the account, editable by the people who work it
--   * v_account_summary: the numbers on top of every account page, from existing records
--   * the account timeline also shows the customer's WhatsApp replies and follow-ups

alter table public.customers
  add column current_requirements text,
  add column future_requirements  text,
  add column next_action          text,
  add column next_action_at       timestamptz,
  add column website              text;
create index customers_next_action_at_idx on public.customers (next_action_at) where next_action_at is not null;

-- Who may edit an account's requirements and next action: the Super Admin, the account owner, or the
-- care executive working one of its leads. Customers never (their requests go through enquiries).
create or replace function public.can_work_account(p_customer uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select public.current_role_is('super_admin'))
      or exists (select 1 from public.customers c where c.id = p_customer and c.account_owner_id = (select auth.uid()))
      or ((select public.current_role_is('cc_exec'))
          and exists (select 1 from public.leads l where l.customer_id = p_customer and l.assigned_to = (select auth.uid())));
$$;

create or replace function public.update_account_requirements(p_customer uuid, p jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_work_account(p_customer) then
    raise exception 'Only the account owner, its executive or the Super Admin can edit this' using errcode = '42501';
  end if;
  update public.customers set
    current_requirements = case when p ? 'current_requirements' then nullif(trim(p ->> 'current_requirements'), '') else current_requirements end,
    future_requirements  = case when p ? 'future_requirements'  then nullif(trim(p ->> 'future_requirements'), '')  else future_requirements end,
    next_action          = case when p ? 'next_action'          then nullif(trim(p ->> 'next_action'), '')          else next_action end,
    next_action_at       = case when p ? 'next_action_at'       then nullif(p ->> 'next_action_at', '')::timestamptz else next_action_at end,
    website              = case when p ? 'website'              then nullif(trim(p ->> 'website'), '')              else website end
  where id = p_customer;
end $$;
revoke execute on function public.update_account_requirements(uuid, jsonb) from public, anon;
grant execute on function public.update_account_requirements(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- The numbers that make an account readable at a glance. Security invoker: each figure is computed
-- from rows the caller may see (RLS), so a customer's own summary never includes anything hidden.
-- ---------------------------------------------------------------------------
create view public.v_account_summary with (security_invoker = true) as
select c.id as customer_id,
  coalesce((select sum(i.total) from public.invoices i where i.customer_id = c.id and i.status not in ('draft', 'cancelled')), 0) as lifetime_billed,
  coalesce((select sum(i.amount_paid) from public.invoices i where i.customer_id = c.id and i.status <> 'cancelled'), 0) as lifetime_paid,
  coalesce((select sum(q.total) from public.quotations q where q.customer_id = c.id and q.status = 'sent'), 0) as open_proposal_value,
  coalesce((select sum(q.total) from public.quotations q where q.customer_id = c.id and q.status = 'approved'), 0) as approved_value,
  coalesce((select sum(q.discount_amount) from public.quotations q where q.customer_id = c.id and q.status = 'approved'), 0) as discount_total,
  (select count(*) from public.jobs j where j.customer_id = c.id)::int as jobs_total,
  (select count(*) from public.jobs j where j.customer_id = c.id and j.status = 'completed')::int as jobs_done,
  (select max(j.actual_end) from public.jobs j where j.customer_id = c.id) as last_work_on,
  (select count(*) from public.job_units u join public.jobs j on j.id = u.job_id
    where j.customer_id = c.id and u.status = 'back_in_service')::int as rooms_restored,
  (select count(*) from public.quotation_lines l join public.quotations q on q.id = l.quotation_id
    where q.customer_id = c.id and q.status = 'approved')::int as fittings_ordered,
  (select count(*) from public.surveys s join public.properties p on p.id = s.property_id
    where p.customer_id = c.id and s.status = 'submitted')::int as assessments_done,
  (select count(*) from public.service_requests r where r.customer_id = c.id and r.status not in ('resolved', 'closed'))::int as open_service_requests,
  (select min(l.created_at) from public.leads l where l.customer_id = c.id) as first_enquiry_at,
  (select s.name from public.leads l join public.lead_sources s on s.id = l.source_id
    where l.customer_id = c.id order by l.created_at limit 1) as first_source
from public.customers c;

-- ---------------------------------------------------------------------------
-- Timeline: + the customer's WhatsApp messages (both directions) and follow-ups. Column list and
-- order unchanged (create or replace view).
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
  -- new in phase 3: the conversation itself
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
  where l.customer_id is not null;
