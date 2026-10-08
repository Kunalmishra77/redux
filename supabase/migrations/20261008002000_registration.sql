-- CR-001 phase 2 (E19, D25) — business registration, colleagues, repeat requests.
--   * register_business(): one transaction from the website: lead + consent (ingest_lead_with_consent),
--     prospect account (unverified, BR-B2), admin contact, lead linked to the account, team told (TN16)
--   * invite_contact() / deactivate_contact(): an account admin manages colleagues (CN19 invite)
--   * 'portal' lead source for "Request again" from the customer portal

insert into public.lead_sources (code, name) values ('portal', 'Customer portal') on conflict (code) do nothing;

insert into public.notification_rules (code, trigger_event, template_code, channel, category, audience, is_active, quiet_hours) values
  ('TN16', 'account_registered', null, 'in_app', null, 'admin', true, false),
  ('CN19', 'contact_invited', 'portal_invite', 'whatsapp', 'utility', 'customer', true, true)
on conflict (code) do nothing;

insert into public.message_templates (code, channel, category, language, body, variables, is_active)
values ('portal_invite', 'whatsapp', 'utility', 'en',
  E'Hello {{1}},\n\n{{2}} has added you to the {{3}} account on the REDUX portal.\n\nSign in with this mobile number at my.reduxbath.com to see assessments, proposals, work progress, invoices and warranty cards.',
  '["name","invited_by","account"]'::jsonb, true)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- register_business: the website's "Create business account" (BR-B1, BR-B2)
-- ---------------------------------------------------------------------------
create or replace function public.register_business(p jsonb, p_consent jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_phone    text := p ->> 'phone';
  v_segment  public.segments%rowtype;
  v_existing uuid;
  v_result   jsonb;
  v_lead     uuid;
  v_customer uuid;
  v_created  boolean := false;
begin
  if not public.is_system_caller() then
    raise exception 'Registration is server-side only' using errcode = '42501';
  end if;
  if coalesce(trim(p ->> 'business_name'), '') = '' or coalesce(trim(p ->> 'contact_name'), '') = '' or v_phone is null then
    raise exception 'Business name, your name and mobile number are required' using errcode = '23514';
  end if;
  select * into v_segment from public.segments where code = coalesce(p ->> 'segment', 'other') and is_active;
  if not found then
    raise exception 'Unknown business type' using errcode = '22023';
  end if;
  -- BR-B3: no homeowner registrations while B2C is off
  if v_segment.is_b2c and not coalesce((select (value #>> '{}')::boolean from public.settings where key = 'b2c_enabled'), true) then
    raise exception 'We currently work with businesses only (BR-B3)' using errcode = '23514';
  end if;

  -- a number that is already a contact of a business account signs in to that account instead
  select cc.customer_id into v_existing
  from public.customer_contacts cc join public.customers c on c.id = cc.customer_id
  where cc.phone = v_phone and cc.is_active and c.kind = 'business'
  order by c.is_prospect, c.created_at desc limit 1;
  if v_existing is not null then
    perform public.record_consent(p_consent || jsonb_build_object('customer_id', v_existing, 'subject_phone', v_phone));
    return jsonb_build_object('customer_id', v_existing, 'lead_id', null, 'created', false);
  end if;

  -- the enquiry itself: dedup, assignment, SLA, consent in one call (BR-L1, D2-11)
  v_result := public.ingest_lead_with_consent(
    jsonb_build_object(
      'source', 'website', 'phone', v_phone, 'name', trim(p ->> 'contact_name'), 'email', nullif(trim(p ->> 'email'), ''),
      'city_id', nullif(p ->> 'city_id', ''), 'customer_type', case v_segment.code when 'hotel' then 'hotel' when 'dealer' then 'dealer' else 'other' end,
      'property_name', trim(p ->> 'business_name'), 'unit_count', nullif(p ->> 'size_units', ''),
      'enquirer_role', nullif(trim(p ->> 'role_title'), ''), 'utm', p -> 'utm',
      'raw_payload', jsonb_build_object('form', 'registration', 'referred_by', nullif(trim(p ->> 'referred_by'), ''),
                                        'segment', v_segment.code, 'gstin', nullif(p ->> 'gstin', ''))),
    p_consent);
  v_lead := (v_result ->> 'lead_id')::uuid;

  -- the account: the lead's, if booking already made one, else a new unverified prospect
  select customer_id into v_customer from public.leads where id = v_lead;
  if v_customer is null then
    insert into public.customers (lead_id, name, legal_name, type, kind, segment_id, gstin, billing_city_id, size_units)
    values (v_lead, trim(p ->> 'business_name'), nullif(trim(p ->> 'legal_name'), ''),
            case v_segment.code when 'hotel' then 'hotel' when 'dealer' then 'dealer' else 'other' end,
            'business', v_segment.id, nullif(upper(trim(p ->> 'gstin')), ''), nullif(p ->> 'city_id', '')::uuid,
            nullif(p ->> 'size_units', '')::int)
    returning id into v_customer;
    v_created := true;
  end if;

  insert into public.customer_contacts (customer_id, name, phone, email, role_title, role_code, is_primary, is_admin)
  values (v_customer, trim(p ->> 'contact_name'), v_phone, nullif(trim(p ->> 'email'), ''), nullif(trim(p ->> 'role_title'), ''),
          coalesce(nullif(p ->> 'role_code', ''), 'owner'), v_created, true)
  on conflict (customer_id, phone) do update set is_active = true, is_admin = true;

  update public.leads set customer_id = v_customer, business_name = trim(p ->> 'business_name'), segment_id = v_segment.id,
    estimated_units = coalesce(estimated_units, nullif(p ->> 'size_units', '')::int),
    pincode = coalesce(pincode, nullif(p ->> 'pincode', ''))
  where id = v_lead;
  perform public.record_consent(p_consent || jsonb_build_object('customer_id', v_customer, 'subject_phone', v_phone));

  perform public.notify_team('TN16', 'New business registered', trim(p ->> 'business_name') || ' — awaiting verification',
                             'customers', v_customer, 'TN16:' || v_customer);
  return jsonb_build_object('customer_id', v_customer, 'lead_id', v_lead, 'created', v_created);
end $$;
revoke execute on function public.register_business(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.register_business(jsonb, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Colleagues: an account admin (or staff who can see the account) adds and removes contacts
-- ---------------------------------------------------------------------------
create or replace function public.is_account_admin(p_customer uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.customer_contacts
                 where customer_id = p_customer and user_id = (select auth.uid()) and is_active and is_admin);
$$;

create or replace function public.invite_contact(p_customer uuid, p_name text, p_phone text, p_role text default null, p_admin boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id      uuid;
  v_by      text;
  v_account text;
begin
  if not (public.is_account_admin(p_customer) or (public.is_staff() and public.staff_can_see_customer(p_customer))) then
    raise exception 'Only an account admin can add colleagues' using errcode = '42501';
  end if;
  if coalesce(trim(p_name), '') = '' or p_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'A name and a valid mobile number are required' using errcode = '23514';
  end if;
  insert into public.customer_contacts (customer_id, name, phone, role_code, is_admin, invited_by)
  values (p_customer, trim(p_name), p_phone, nullif(p_role, ''), coalesce(p_admin, false), (select auth.uid()))
  on conflict (customer_id, phone) do update set is_active = true, name = excluded.name, role_code = excluded.role_code
  returning id into v_id;
  -- an existing login with this number gets access at once (same rule as trg_link_portal_user)
  update public.customer_contacts cc set user_id = u.id
  from auth.users u where cc.id = v_id and cc.user_id is null and u.phone = ltrim(p_phone, '+');

  select coalesce((select name from public.customer_contacts where customer_id = p_customer and user_id = (select auth.uid()) limit 1),
                  (select full_name from public.profiles where id = (select auth.uid())), 'REDUX')
    into v_by;
  select name into v_account from public.customers where id = p_customer;
  perform public.notify_customer('CN19', p_phone, null, p_customer, 'customers', p_customer,
    jsonb_build_object('name', split_part(trim(p_name), ' ', 1), 'invited_by', v_by, 'account', v_account),
    'CN19:' || v_id);
  return v_id;
end $$;
revoke execute on function public.invite_contact(uuid, text, text, text, boolean) from public, anon;
grant execute on function public.invite_contact(uuid, text, text, text, boolean) to authenticated;

create or replace function public.deactivate_contact(p_contact uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.customer_contacts%rowtype;
begin
  select * into c from public.customer_contacts where id = p_contact for update;
  if not found then raise exception 'Contact not found' using errcode = 'P0002'; end if;
  if not (public.is_account_admin(c.customer_id) or (select public.current_role_is('super_admin'))) then
    raise exception 'Only an account admin can remove colleagues' using errcode = '42501';
  end if;
  if c.user_id = (select auth.uid()) then
    raise exception 'You cannot remove yourself' using errcode = '22023';
  end if;
  if c.is_admin and not exists (select 1 from public.customer_contacts
                                where customer_id = c.customer_id and is_active and is_admin and id <> c.id) then
    raise exception 'An account needs at least one admin' using errcode = '22023';
  end if;
  update public.customer_contacts set is_active = false where id = p_contact;
end $$;
revoke execute on function public.deactivate_contact(uuid) from public, anon;
grant execute on function public.deactivate_contact(uuid) to authenticated;
