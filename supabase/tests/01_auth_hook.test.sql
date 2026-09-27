-- E1-S03 · ADR-004 — the Custom Access Token Hook puts the right role in the JWT.
-- The first test is the regression for task-tracker deviation #1: without the grants and the
-- supabase_auth_admin policy, the hook sees no user_roles and stamps staff as 'customer'.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'exec@test.local'),
  ('00000000-0000-0000-0000-0000000000d1', 'dual@test.local'),
  ('00000000-0000-0000-0000-0000000000f1', 'portal@test.local');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'super_admin'),
  ('00000000-0000-0000-0000-0000000000c1', 'cc_exec'),
  ('00000000-0000-0000-0000-0000000000d1', 'surveyor'),
  ('00000000-0000-0000-0000-0000000000d1', 'super_admin');

-- GoTrue runs the hook as supabase_auth_admin. Hosted projects don't let a test switch to that
-- role, so assert every privilege it depends on instead.
select ok(has_function_privilege('supabase_auth_admin', 'public.custom_access_token_hook(jsonb)', 'execute'),
  'supabase_auth_admin can execute the hook');
select ok(has_table_privilege('supabase_auth_admin', 'public.user_roles', 'select'),
  'supabase_auth_admin can select user_roles');
select ok(exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'user_roles' and cmd = 'SELECT'
                    and 'supabase_auth_admin' = any(roles) and qual = 'true'),
  'RLS lets supabase_auth_admin read every user_roles row');

select is(
  public.custom_access_token_hook(
    '{"user_id":"00000000-0000-0000-0000-0000000000c1","claims":{"sub":"00000000-0000-0000-0000-0000000000c1"}}'
  ) #>> '{claims,user_role}',
  'cc_exec', 'cc_exec role projected into the JWT');

select is(
  public.custom_access_token_hook(
    '{"user_id":"00000000-0000-0000-0000-0000000000a1","claims":{}}') #>> '{claims,user_role}',
  'super_admin', 'super_admin role projected');

select is(
  public.custom_access_token_hook(
    '{"user_id":"00000000-0000-0000-0000-0000000000d1","claims":{}}') #>> '{claims,user_role}',
  'super_admin', 'a user with two roles gets the most privileged, deterministically');

select is(
  public.custom_access_token_hook(
    '{"user_id":"00000000-0000-0000-0000-0000000000f1","claims":{}}') #>> '{claims,user_role}',
  'customer', 'a user with no staff role is a customer');

select is(
  public.custom_access_token_hook(
    '{"user_id":"00000000-0000-0000-0000-0000000000c1","claims":{"sub":"x","aud":"authenticated"}}'
  ) #>> '{claims,aud}',
  'authenticated', 'existing claims are preserved');

set local role authenticated;
select throws_ok(
  $$ select public.custom_access_token_hook('{"user_id":"00000000-0000-0000-0000-0000000000c1","claims":{}}') $$,
  '42501', null, 'authenticated users cannot call the hook');

select * from finish();
rollback;
