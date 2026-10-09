-- CR-001 phase 4c (E21, D27) — what the self-assessment form needs to show a customer. The fitting
-- lists are REDUX's own product vocabulary (no customer data); settings stay staff-only, so the one
-- number the customer sees (the turnaround) comes through a function.

create policy fitting_types_read_customer on public.fitting_types for select to authenticated
  using ((select public.current_role_is('customer')) and is_active);
create policy finishes_read_customer on public.finishes for select to authenticated
  using ((select public.current_role_is('customer')) and is_active);
create policy condition_flags_read_customer on public.condition_flags for select to authenticated
  using ((select public.current_role_is('customer')) and is_active);
create policy brands_read_customer on public.brands for select to authenticated
  using ((select public.current_role_is('customer')) and is_active);

create or replace function public.self_assessment_turnaround_hours()
returns int language sql stable security definer set search_path = '' as $$
  select coalesce((select (value #>> '{}')::int from public.settings where key = 'self_assessment_sla_hours'), 24);
$$;
revoke execute on function public.self_assessment_turnaround_hours() from public, anon;
grant execute on function public.self_assessment_turnaround_hours() to authenticated;

-- The portal's "Start your self-assessment" offer: open enquiries of my accounts that the policy (or
-- the team) sent to a remote assessment and that have no assessment yet. Customers cannot read leads.
create or replace function public.my_self_assessment_offers()
returns table (lead_id uuid, mode text, customer_name text) language sql stable security definer set search_path = '' as $$
  select l.id, l.assessment_mode, c.name
  from public.leads l join public.customers c on c.id = l.customer_id
  where l.customer_id = any (public.my_customer_ids())
    and l.assessment_mode in ('self', 'video')
    and l.status not in ('won', 'lost')
    and not exists (select 1 from public.surveys s where s.lead_id = l.id and s.status <> 'cancelled')
  order by l.created_at desc;
$$;
revoke execute on function public.my_self_assessment_offers() from public, anon;
grant execute on function public.my_self_assessment_offers() to authenticated;
