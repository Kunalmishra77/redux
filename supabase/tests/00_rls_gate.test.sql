-- CI gate 5 (QA plan §2) + CLAUDE.md rule 1 — structural RLS checks over the whole schema.
-- Runs on every PR. A new table, view or SECURITY DEFINER function that breaks one of these
-- fails the build before review.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

select is(
  array(select tablename::text from pg_tables
        where schemaname = 'public' and not rowsecurity order by 1),
  '{}'::text[],
  'every public table has RLS enabled');

-- Tables deliberately left with RLS and no policy: service-role only
-- (blueprint 03-architecture/04-auth-security-rls.md §4). Add here ONLY with a reason.
select is(
  array(select t.tablename::text from pg_tables t
        where t.schemaname = 'public'
          and not exists (select 1 from pg_policies p
                          where p.schemaname = 'public' and p.tablename = t.tablename)
          and t.tablename not in ('webhook_events','messages','capi_events')
        order by 1),
  '{}'::text[],
  'every public table has at least one written policy (or is an allow-listed service-role table)');

-- A view runs with its owner's rights unless security_invoker is set — which bypasses RLS.
select is(
  array(select c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('v','m')
          and not coalesce(c.reloptions @> array['security_invoker=true'], false)
        order by 1),
  '{}'::text[],
  'every public view is security_invoker');

-- A SECURITY DEFINER function without a pinned search_path can be hijacked.
select is(
  array(select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.prosecdef
          and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c
                          where c like 'search_path=%')
        order by 1),
  '{}'::text[],
  'every SECURITY DEFINER function pins search_path');

select * from finish();
rollback;
