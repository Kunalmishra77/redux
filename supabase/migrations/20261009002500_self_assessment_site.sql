-- CR-001 phase 4 fix — a remote assessment needs a site record but not a visitable address (BR-S8 is
-- the on-site rule: the surveyor navigates there). Reuse the account's first site when it has one;
-- otherwise record the site with the address marked to be confirmed.

create or replace function public.start_self_assessment(p_lead uuid, p_mode text default 'self')
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  l          public.leads%rowtype;
  v_role     text := coalesce((select auth.jwt()) ->> 'user_role', '');
  v_caller   uuid := (select auth.uid());
  v_property uuid;
  v_id       uuid;
  v_days     int := coalesce((select (value #>> '{}')::int from public.settings where key = 'self_assessment_window_days'), 14);
begin
  if p_mode not in ('self', 'video') then raise exception 'Mode must be self or video' using errcode = '22023'; end if;
  select * into l from public.leads where id = p_lead;
  if not found then raise exception 'Lead not found' using errcode = 'P0002'; end if;

  if v_role = 'customer' then
    if l.customer_id is null or not (l.customer_id = any (public.my_customer_ids())) then
      raise exception 'This enquiry is not on your account' using errcode = '42501';
    end if;
  elsif not (v_role = 'super_admin' or (v_role = 'cc_exec' and l.assigned_to = v_caller)) then
    raise exception 'Only the lead''s executive or the Super Admin can start this' using errcode = '42501';
  end if;

  select s.id into v_id from public.surveys s where s.lead_id = p_lead and s.mode <> 'onsite' and s.status in ('scheduled', 'in_progress', 'submitted') limit 1;
  if v_id is not null then return v_id; end if;

  if l.customer_id is not null then
    select id into v_property from public.properties where customer_id = l.customer_id order by created_at limit 1;
  end if;

  if v_role = 'customer' then
    if v_property is null then
      insert into public.properties (customer_id, name, address, city_id)
      select c.id, c.name, coalesce(nullif(c.billing_address, ''), 'Address to be confirmed'), l.city_id
      from public.customers c where c.id = l.customer_id
      returning id into v_property;
    end if;
  else
    -- staff: makes the prospect account if there is none yet (BR-S8 path), then reuses or adds the site
    v_property := (public.ensure_prospect(p_lead,
      case when v_property is not null then jsonb_build_object('id', v_property)
           else jsonb_build_object('address', 'Address to be confirmed (remote assessment)',
                                   'name', coalesce(l.property_name, l.business_name)) end) ->> 'property_id')::uuid;
  end if;

  insert into public.surveys (lead_id, property_id, booked_by, scheduled_at, slot_end_at, mode)
  values (p_lead, v_property, case when v_role = 'customer' then null else v_caller end, now(), now() + make_interval(days => v_days), p_mode)
  returning id into v_id;
  if l.status in ('new', 'contacted') then
    update public.leads set status = 'survey_booked' where id = p_lead;   -- BR-L6: a live survey exists
  end if;
  return v_id;
end $$;
revoke execute on function public.start_self_assessment(uuid, text) from public, anon;
grant execute on function public.start_self_assessment(uuid, text) to authenticated;
