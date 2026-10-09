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
