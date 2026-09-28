-- E6-S03 (prep) · schema.sql §7 — customers, contacts, properties, units · BR-S8
--
-- Deviations from schema.sql (task tracker → Deviations):
--   * BR-S8 (decision 27 Sep 2026): a customer can be a PROSPECT — created when a survey is booked,
--     so the survey has a real property (address, lat/lng) before any quote exists. OTP approval
--     converts it (is_prospect → false); it is never recreated.
--   * my_customer_ids() returns every customer the portal user is an active contact of (one phone
--     can be the Chief Engineer for several hotels) — replaces my_customer_id() with `limit 1`.
--     Prospects are excluded: a prospect has no portal access until approval.
--   * Children do not cascade-delete: customers are never deleted (DPDP erasure is its own flow).

create table public.customers (
  id                 uuid primary key default gen_random_uuid(),
  lead_id            uuid references public.leads(id),
  name               text not null,
  type               text not null check (type in ('home','hotel','dealer','other')),
  is_prospect        boolean not null default true,     -- BR-S8
  converted_at       timestamptz,
  gstin              text,
  billing_address    text,
  billing_city_id    uuid references public.cities(id),
  billing_state_code text,                               -- drives CGST/SGST vs IGST (BR-I4)
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint customers_converted_consistent check (is_prospect = (converted_at is null))
);
create index customers_lead_id_idx     on public.customers (lead_id);
create index customers_is_prospect_idx on public.customers (is_prospect);
create trigger trg_customers_updated before update on public.customers
  for each row execute function public.set_updated_at();

-- A contact is a person who can log in to the portal for a customer
create table public.customer_contacts (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers(id),
  user_id      uuid references auth.users(id),           -- set once they log in (Phase 3)
  name         text not null,
  phone        text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  email        text,
  role_title   text,                                     -- 'Chief Engineer', 'Accounts', …
  is_primary   boolean not null default false,
  notify_prefs jsonb not null default '{}'::jsonb,
  is_active    boolean not null default true,
  unique (customer_id, phone)
);
create index customer_contacts_customer_id_idx on public.customer_contacts (customer_id);
create index customer_contacts_user_id_idx     on public.customer_contacts (user_id);
create index customer_contacts_phone_idx       on public.customer_contacts (phone);
create unique index customer_contacts_one_primary on public.customer_contacts (customer_id) where is_primary;

create table public.properties (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  name        text not null,
  address     text not null,                              -- BR-S8: surveyor navigates here (D7-01)
  city_id     uuid references public.cities(id),
  lat         numeric(9,6) check (lat between -90 and 90),
  lng         numeric(9,6) check (lng between -180 and 180), -- check-in geofence (BR-S4)
  unit_label  text not null default 'Room' check (unit_label in ('Room','Bathroom')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint properties_latlng_pair check ((lat is null) = (lng is null))
);
create index properties_customer_id_idx on public.properties (customer_id);
create index properties_city_id_idx     on public.properties (city_id);
create trigger trg_properties_updated before update on public.properties
  for each row execute function public.set_updated_at();

create table public.property_units (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id),
  label       text not null,                               -- '204', 'Master bath'
  floor       text,
  wing        text,
  notes       text,
  created_at  timestamptz not null default now(),
  unique (property_id, label)
);
create index property_units_property_id_idx on public.property_units (property_id);

alter table public.customers         enable row level security;
alter table public.customer_contacts enable row level security;
alter table public.properties        enable row level security;
alter table public.property_units    enable row level security;

create trigger trg_audit_customers after insert or update or delete on public.customers
  for each row execute function public.write_audit();

-- ---------------------------------------------------------------------------
-- Which customers does the logged-in portal user belong to? (replaces my_customer_id)
-- ---------------------------------------------------------------------------
create or replace function public.my_customer_ids()
returns uuid[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(cc.customer_id), '{}')
  from public.customer_contacts cc
  join public.customers c on c.id = cc.customer_id
  where cc.user_id = (select auth.uid()) and cc.is_active and not c.is_prospect;
$$;

-- Can the caller see this customer as staff? super_admin: all. cc_exec: every converted customer
-- (they answer "where is my job?", roles matrix) but a prospect only through their own lead (P3).
-- Surveyor access through their surveys is added with §8.
create or replace function public.staff_can_see_customer(p_customer_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case ((select auth.jwt()) ->> 'user_role')
    when 'super_admin' then true
    when 'cc_exec' then exists (
      select 1 from public.customers c
      left join public.leads l on l.id = c.lead_id
      where c.id = p_customer_id
        and (not c.is_prospect or l.assigned_to = (select auth.uid())))
    else false
  end;
$$;

-- ---------------------------------------------------------------------------
-- BR-S8: ensure_prospect(lead, property) → the customer + property a survey is booked against.
--   * the lead already has a customer → reuse it
--   * the number was a customer before (previous_lead_id chain) → reuse that customer
--   * otherwise → create a prospect customer + primary contact from the lead
--   Property: p_property.id picks an existing property of that customer; otherwise one is created.
-- Called by survey booking (E6-S03). Returns {customer_id, property_id, created_customer}.
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

  -- Service role / direct DB, super_admin, or the executive who owns the lead (P3)
  if v_claims is not null
     and coalesce(v_claims ->> 'role', '') <> 'service_role'
     and not (v_role = 'super_admin' or (v_role = 'cc_exec' and v_lead.assigned_to = v_caller)) then
    raise exception 'Not allowed to book for this lead' using errcode = '42501';
  end if;

  -- 1. this lead's customer, else 2. a customer from an earlier lead for the same person
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

  -- 3. a new prospect
  if v_customer is null then
    v_type := coalesce(v_lead.customer_type, 'other');
    insert into public.customers (lead_id, name, type)
    values (
      v_lead.id,
      case when v_type = 'hotel'
           then coalesce(v_lead.property_name, v_lead.name, v_lead.phone)
           else coalesce(v_lead.name, v_lead.property_name, v_lead.phone) end,
      v_type
    ) returning id into v_customer;
    v_created := true;

    insert into public.customer_contacts (customer_id, name, phone, email, role_title, is_primary)
    values (v_customer, coalesce(v_lead.name, v_lead.phone), v_lead.phone, v_lead.email,
            v_lead.enquirer_role, true);
  end if;

  -- Property: an existing one of this customer, or a new one
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
               case when v_type = 'hotel' then 'Hotel' else 'Home' end),
      trim(p_property ->> 'address'),
      coalesce(nullif(p_property ->> 'city_id', '')::uuid, v_lead.city_id),
      nullif(p_property ->> 'lat', '')::numeric,
      nullif(p_property ->> 'lng', '')::numeric,
      case when v_type = 'hotel' then 'Room' else 'Bathroom' end   -- glossary: Unit
    ) returning id into v_property;
  end if;

  return jsonb_build_object('customer_id', v_customer, 'property_id', v_property,
                            'created_customer', v_created);
end $$;
revoke execute on function public.ensure_prospect(uuid, jsonb) from public, anon;
grant execute on function public.ensure_prospect(uuid, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Policies (ADR-004). Creation goes through ensure_prospect(); edits are staff-side.
-- ---------------------------------------------------------------------------
create policy customers_select on public.customers for select to authenticated
  using (public.staff_can_see_customer(id) or id = any ((select public.my_customer_ids())::uuid[]));
create policy customers_write_admin on public.customers for all to authenticated
  using ((select public.current_role_is('super_admin')))
  with check ((select public.current_role_is('super_admin')));

create policy customer_contacts_select on public.customer_contacts for select to authenticated
  using (public.staff_can_see_customer(customer_id)
         or customer_id = any ((select public.my_customer_ids())::uuid[]));
create policy customer_contacts_write_admin on public.customer_contacts for all to authenticated
  using ((select public.current_role_is('super_admin')))
  with check ((select public.current_role_is('super_admin')));

create policy properties_select on public.properties for select to authenticated
  using (public.staff_can_see_customer(customer_id)
         or customer_id = any ((select public.my_customer_ids())::uuid[]));
-- The executive booking the survey can correct the address / pin of their own prospect
create policy properties_update_staff on public.properties for update to authenticated
  using (public.staff_can_see_customer(customer_id)
         and exists (select 1 from public.customers c where c.id = properties.customer_id and c.is_prospect))
  with check (public.staff_can_see_customer(customer_id)
         and exists (select 1 from public.customers c where c.id = properties.customer_id and c.is_prospect));
create policy properties_write_admin on public.properties for all to authenticated
  using ((select public.current_role_is('super_admin')))
  with check ((select public.current_role_is('super_admin')));

create policy property_units_select on public.property_units for select to authenticated
  using (exists (select 1 from public.properties p where p.id = property_units.property_id));
create policy property_units_write_admin on public.property_units for all to authenticated
  using ((select public.current_role_is('super_admin')))
  with check ((select public.current_role_is('super_admin')));
