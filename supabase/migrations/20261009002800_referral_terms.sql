-- CR-001 phase 6 — the referral programme's public terms for the portal (settings stay staff-only)
create or replace function public.referral_programme_terms()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce((select value from public.settings where key = 'referral_programme'), '{}'::jsonb);
$$;
revoke execute on function public.referral_programme_terms() from public, anon;
grant execute on function public.referral_programme_terms() to authenticated;
