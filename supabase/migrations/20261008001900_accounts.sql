-- CR-001 phase 1 (E18, D24) — B2B account foundation.
--   * segments (master) and customer_groups (chains; internal only, BR-B4)
--   * customers become business accounts: kind, group, segment, legal name, size, owner, tier,
--     verification (BR-B1, BR-B2); contacts get a role and an admin flag
--   * leads link to their account (repeat business, BR-B1) and carry the B2B fields phase 4 scores
--   * B2C switch (BR-B3): public forms cannot create home leads while b2c_enabled is false
--   * portal access by account membership, prospects included (ADR-016)
--   * one account timeline as a view over existing event tables (ADR-017) + manual activities

-- ---------------------------------------------------------------------------
-- Masters
-- ---------------------------------------------------------------------------
create table public.segments (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  is_b2c     boolean not null default false,   -- hidden while settings.b2c_enabled is false
  sort_order int not null default 0,
  is_active  boolean not null default true
);
insert into public.segments (code, name, is_b2c, sort_order) values
  ('hotel', 'Hotel', false, 10), ('serviced_apartment', 'Serviced apartments', false, 20),
  ('hospital', 'Hospital', false, 30), ('office', 'Office / commercial building', false, 40),
  ('residential_society', 'Residential society', false, 50), ('restaurant', 'Restaurant / café', false, 60),
  ('club', 'Club / gym / spa', false, 70), ('institution', 'School / institution', false, 80),
  ('dealer', 'Dealer / architect', false, 90), ('other', 'Other business', false, 100),
  ('home', 'Home', true, 200);
alter table public.segments enable row level security;
create policy segments_read on public.segments for select to authenticated using (true);
create policy segments_admin on public.segments for all to authenticated
  using ((select public.current_role_is('super_admin'))) with check ((select public.current_role_is('super_admin')));
create trigger trg_audit_segments after insert or update or delete on public.segments
  for each row execute function public.write_audit();

create table public.customer_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  segment_id  uuid references public.segments(id),
  notes       text,
  created_at  timestamptz not null default now()
);
create index customer_groups_segment_id_idx on public.customer_groups (segment_id);
alter table public.customer_groups enable row level security;
-- BR-B4: groups are internal — staff only
create policy customer_groups_staff_read on public.customer_groups for select to authenticated
  using ((select public.is_staff()));
create policy customer_groups_admin on public.customer_groups for all to authenticated
  using ((select public.current_role_is('super_admin'))) with check ((select public.current_role_is('super_admin')));
create trigger trg_audit_customer_groups after insert or update or delete on public.customer_groups
  for each row execute function public.write_audit();

insert into public.settings (key, value, description) values
  ('b2c_enabled', 'false', 'BR-B3: homeowner (B2C) offers on public forms and pages'),
  ('account_verification_required', 'true', 'BR-B2: full history and reports need a verified account')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Accounts (customers) and contacts
-- ---------------------------------------------------------------------------
alter table public.customers
  add column kind             text not null default 'business' check (kind in ('business', 'individual')),
  add column group_id         uuid references public.customer_groups(id),
  add column segment_id       uuid references public.segments(id),
  add column legal_name       text,
  add column size_units       int check (size_units is null or size_units >= 0),
  add column account_owner_id uuid references public.profiles(id),
  add column tier             text check (tier in ('A', 'B', 'C')),
  add column verified_at      timestamptz,
  add column verified_by      uuid references auth.users(id);
create index customers_group_id_idx         on public.customers (group_id);
create index customers_segment_id_idx       on public.customers (segment_id);
create index customers_account_owner_id_idx on public.customers (account_owner_id);
create index customers_tier_idx             on public.customers (tier);

-- existing rows: homes are individuals; everything gets the segment its type names
update public.customers c set
  kind = case when c.type = 'home' then 'individual' else 'business' end,
  segment_id = (select s.id from public.segments s where s.code = case c.type when 'dealer' then 'dealer' else c.type end)
where c.segment_id is null;
-- converted accounts were vetted by approving a quotation
update public.customers set verified_at = coalesce(converted_at, now()) where not is_prospect and verified_at is null;

alter table public.customer_contacts
  add column role_code  text check (role_code in ('owner', 'engineering', 'accounts', 'purchase', 'operations', 'other')),
  add column is_admin   boolean not null default false,
  add column invited_by uuid references auth.users(id);
update public.customer_contacts set is_admin = true where is_primary;

-- ---------------------------------------------------------------------------
-- Leads: account link + B2B fields
-- ---------------------------------------------------------------------------
alter table public.leads
  add column customer_id      uuid references public.customers(id),
  add column business_name    text,
  add column segment_id       uuid references public.segments(id),
  add column estimated_units  int check (estimated_units is null or estimated_units >= 0),
  add column estimated_value  numeric(12,2) check (estimated_value is null or estimated_value >= 0),
  add column pincode          text check (pincode is null or pincode ~ '^[1-9][0-9]{5}$'),
  add column score            int,
  add column tier             text check (tier in ('A', 'B', 'C')),
  add column assessment_mode  text check (assessment_mode in ('onsite', 'self', 'video')),
  add column demo_offer       text;
create index leads_customer_id_idx on public.leads (customer_id);
create index leads_segment_id_idx  on public.leads (segment_id);
create index leads_tier_idx        on public.leads (tier);

-- backfill: a lead belongs to the account created from it
update public.leads l set customer_id = c.id from public.customers c where c.lead_id = l.id and l.customer_id is null;
update public.leads l set segment_id = s.id
from public.segments s where s.code = l.customer_type and l.segment_id is null;
update public.leads set business_name = property_name where business_name is null and customer_type <> 'home';

-- BR-B1 (repeat business) + BR-B3 (B2C switch), at insert time for every source
create or replace function public.leads_link_account() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_source text;
begin
  if new.segment_id is null and new.customer_type is not null then
    select id into new.segment_id from public.segments where code = new.customer_type;
  end if;
  if new.customer_id is null then
    -- a known contact's number links the enquiry to their account (prefer converted accounts)
    select cc.customer_id into new.customer_id
    from public.customer_contacts cc join public.customers c on c.id = cc.customer_id
    where cc.phone = new.phone and cc.is_active
    order by c.is_prospect, c.created_at desc
    limit 1;
  end if;
  -- BR-B3: public forms may not create home leads while B2C is off. Ads and chats are never
  -- refused here (Google Ads must not see an error — CLAUDE.md); staff may still enter one.
  select code into v_source from public.lead_sources where id = new.source_id;
  if new.customer_type = 'home' and v_source in ('website', 'dealer')
     and not coalesce((select (value #>> '{}')::boolean from public.settings where key = 'b2c_enabled'), true) then
    raise exception 'Home enquiries are not offered on the website at present (BR-B3)' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger trg_leads_link_account before insert on public.leads
  for each row execute function public.leads_link_account();

-- ---------------------------------------------------------------------------
-- BR-S8 + BR-B1: ensure_prospect reuses the lead's account first, and records the link
-- ---------------------------------------------------------------------------
create or replace function public.ensure_prospect(p_lead_id uuid, p_property jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_claims   jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  v_role     text  := v_claims ->> 'user_role';
  v_caller   uuid  := nullif(v_claims ->> 'sub', '')::uuid;
  v_lead     public.leads%rowtype;
  v_customer uuid;
  v_created  boolean := false;
  v_property uuid;
  v_type     text;
begin
  select * into v_lead from public.leads where id = p_lead_id for update;
  if not found then
    raise exception 'Lead not found' using errcode = 'P0002';
  end if;

  if v_claims is not null
     and coalesce(v_claims ->> 'role', '') <> 'service_role'
     and not (v_role = 'super_admin' or (v_role = 'cc_exec' and v_lead.assigned_to = v_caller)) then
    raise exception 'Not allowed to book for this lead' using errcode = '42501';
  end if;

  -- 0. the account the lead is already linked to (repeat business, BR-B1)
  v_customer := v_lead.customer_id;

  -- 1. this lead's customer, else 2. a customer from an earlier lead for the same person
  if v_customer is null then
    with recursive chain as (
      select id, previous_lead_id, 0 as depth from public.leads where id = p_lead_id
      union all
      select l.id, l.previous_lead_id, c.depth + 1
      from public.leads l join chain c on l.id = c.previous_lead_id
      where c.depth < 50
    )
    select cu.id into v_customer
    from chain ch join public.customers cu on cu.lead_id = ch.id
    order by ch.depth, cu.created_at desc
    limit 1;
  end if;

  -- 3. a new prospect account
  if v_customer is null then
    v_type := coalesce(v_lead.customer_type, 'other');
    insert into public.customers (lead_id, name, type, kind, segment_id, size_units)
    values (
      v_lead.id,
      case when v_type = 'home'
           then coalesce(v_lead.name, v_lead.property_name, v_lead.phone)
           else coalesce(v_lead.business_name, v_lead.property_name, v_lead.name, v_lead.phone) end,
      v_type,
      case when v_type = 'home' then 'individual' else 'business' end,
      coalesce(v_lead.segment_id, (select id from public.segments where code = v_type)),
      coalesce(v_lead.estimated_units, v_lead.unit_count)
    ) returning id into v_customer;
    v_created := true;

    insert into public.customer_contacts (customer_id, name, phone, email, role_title, is_primary, is_admin)
    values (v_customer, coalesce(v_lead.name, v_lead.phone), v_lead.phone, v_lead.email,
            v_lead.enquirer_role, true, true);
  end if;

  update public.leads set customer_id = v_customer where id = p_lead_id and customer_id is null;

  if p_property ? 'id' then
    select id into v_property from public.properties
    where id = (p_property ->> 'id')::uuid and customer_id = v_customer;
    if v_property is null then
      raise exception 'That property does not belong to this customer' using errcode = '22023';
    end if;
  else
    if coalesce(trim(p_property ->> 'address'), '') = '' then
      raise exception 'A survey needs the property address (BR-S8)' using errcode = '22023';
    end if;
    select type into v_type from public.customers where id = v_customer;
    insert into public.properties (customer_id, name, address, city_id, lat, lng, unit_label)
    values (
      v_customer,
      coalesce(nullif(trim(p_property ->> 'name'), ''), v_lead.property_name,
               case when v_type = 'home' then 'Home' else 'Site' end),
      trim(p_property ->> 'address'),
      coalesce(nullif(p_property ->> 'city_id', '')::uuid, v_lead.city_id),
      nullif(p_property ->> 'lat', '')::numeric,
      nullif(p_property ->> 'lng', '')::numeric,
      case when v_type = 'home' then 'Bathroom' else 'Room' end   -- glossary: Unit
    ) returning id into v_property;
  end if;

  return jsonb_build_object('customer_id', v_customer, 'property_id', v_property,
                            'created_customer', v_created);
end $$;
revoke execute on function public.ensure_prospect(uuid, jsonb) from public, anon;
grant execute on function public.ensure_prospect(uuid, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- ADR-016: portal access by account membership — prospects included. Each customer-facing policy
-- already limits what a customer sees (no draft or pending quotations, no draft invoices,
-- assessments staff-only), so a prospect sees its own enquiry-stage records and nothing more.
-- ---------------------------------------------------------------------------
create or replace function public.my_customer_ids()
returns uuid[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(cc.customer_id), '{}')
  from public.customer_contacts cc
  where cc.user_id = (select auth.uid()) and cc.is_active;
$$;

-- a login links to every active contact with its number, prospect accounts included
create or replace function public.link_portal_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.phone is not null and new.phone <> '' then
    update public.customer_contacts cc set user_id = new.id
    where cc.is_active and cc.user_id is null
      and cc.phone = '+' || ltrim(new.phone, '+');
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- ADR-017: account timeline — a view over the existing event tables (security invoker: each
-- underlying table's RLS decides what the caller sees) + manual activities
-- ---------------------------------------------------------------------------
create table public.account_activities (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  lead_id     uuid references public.leads(id),
  kind        text not null check (kind in ('meeting', 'visit', 'call_note', 'email', 'other')),
  title       text not null check (length(trim(title)) > 0),
  body        text,
  occurred_at timestamptz not null default now(),
  actor_id    uuid not null references auth.users(id) default auth.uid(),
  created_at  timestamptz not null default now()
);
create index account_activities_customer_id_idx on public.account_activities (customer_id, occurred_at desc);
create index account_activities_lead_id_idx     on public.account_activities (lead_id);
create index account_activities_actor_id_idx    on public.account_activities (actor_id);
alter table public.account_activities enable row level security;
-- internal notes: staff who can see the account; never customers
create policy account_activities_select on public.account_activities for select to authenticated
  using ((select public.is_staff()) and public.staff_can_see_customer(customer_id));
create policy account_activities_insert on public.account_activities for insert to authenticated
  with check ((select public.is_staff()) and public.staff_can_see_customer(customer_id) and actor_id = (select auth.uid()));
create trigger trg_account_activities_append_only before update or delete on public.account_activities
  for each row execute function public.forbid_change();

create view public.v_account_timeline with (security_invoker = true) as
  -- enquiries and their status changes
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
  -- assessments (surveys)
  union all
  select p.customer_id, s.lead_id, coalesce(s.submitted_at, s.scheduled_at), 'survey',
         case s.status when 'submitted' then 'Assessment completed' when 'cancelled' then 'Assessment cancelled'
              else 'Assessment booked' end,
         p.name, s.surveyor_id, 'surveys', s.id
  from public.surveys s join public.properties p on p.id = s.property_id
  -- proposals
  union all
  select q.customer_id, q.lead_id, coalesce(q.issued_at, q.created_at), 'quotation',
         'Quotation ' || q.quote_no || ' v' || q.version || ' — ' || replace(q.status::text, '_', ' '),
         null, q.created_by, 'quotations', q.id
  from public.quotations q
  union all
  select q.customer_id, q.lead_id, a.otp_verified_at, 'approval',
         'Quotation ' || q.quote_no || ' approved by ' || a.approver_name, null, null, 'quotations', q.id
  from public.quote_approvals a join public.quotations q on q.id = a.quotation_id
  -- work
  union all
  select j.customer_id, null::uuid, e.occurred_at, 'job_stage',
         'Job ' || j.job_no || ': ' || replace(e.to_stage::text, '_', ' '), e.note, e.actor_id, 'jobs', j.id
  from public.job_stage_events e join public.jobs j on j.id = e.job_id
  where e.job_unit_id is null or e.to_stage in ('handover')
  -- money
  union all
  select i.customer_id, null::uuid, coalesce(i.issue_date::timestamptz, i.created_at), 'invoice',
         'Invoice ' || coalesce(i.invoice_no, 'draft') || ' — ' || replace(i.status::text, '_', ' '), null, i.created_by, 'invoices', i.id
  from public.invoices i
  union all
  select i.customer_id, null::uuid, coalesce(py.captured_at, py.created_at), 'payment',
         'Payment received', null, null, 'payments', py.id
  from public.payments py join public.invoices i on i.id = py.invoice_id
  where py.status = 'captured'
  -- after-care
  union all
  select r.customer_id, null::uuid, r.created_at, 'service_request',
         'Service request ' || r.request_no || ': ' || r.subject, null, r.raised_by, 'service_requests', r.id
  from public.service_requests r
  -- messages the account was sent
  union all
  select coalesce(m.customer_id, l.customer_id), m.lead_id, m.queued_at, 'message',
         'WhatsApp: ' || replace(coalesce(m.template_code, m.channel::text), '_', ' '), null, null, 'messages', m.id
  from public.messages m left join public.leads l on l.id = m.lead_id
  where coalesce(m.customer_id, l.customer_id) is not null and m.category is distinct from 'authentication'
  -- manual
  union all
  select a.customer_id, a.lead_id, a.occurred_at, 'activity', a.title, a.body, a.actor_id, 'account_activities', a.id
  from public.account_activities a;
