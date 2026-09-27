-- E1-S12 (partial) · permission test P4 (roles-permissions §"8 tests"), plus the §1–3 read rules.
-- P4: nobody except super_admin writes user_roles or master lists. P1–P3, P6–P8 arrive with
-- their tables.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'exec@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'surveyor@test.local'),
  ('00000000-0000-0000-0000-0000000000f1', 'portal@test.local');
insert into public.profiles (id, full_name) values
  ('00000000-0000-0000-0000-0000000000a1', 'Admin'),
  ('00000000-0000-0000-0000-0000000000c1', 'Exec'),
  ('00000000-0000-0000-0000-0000000000b1', 'Surveyor');

-- ── as cc_exec ─────────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","user_role":"cc_exec"}';

select throws_ok(
  $$ insert into public.user_roles (user_id, role)
     values ('00000000-0000-0000-0000-0000000000c1', 'super_admin') $$,
  '42501', null, 'P4: cc_exec cannot grant itself super_admin');

select throws_ok(
  $$ insert into public.fitting_types (code, name) values ('x', 'X') $$,
  '42501', null, 'P4: cc_exec cannot write fitting_types');

update public.settings set value = '99' where key = 'discount_threshold_pct';  -- RLS: 0 rows, silently
reset role;
select is((select value from public.settings where key = 'discount_threshold_pct'), '5'::jsonb,
  'P4: cc_exec cannot change settings');
set local role authenticated;

select is((select count(*)::int from public.lost_reasons), 6, 'staff read the lost-reason list');

select throws_ok(
  $$ update public.profiles set is_active = false where id = '00000000-0000-0000-0000-0000000000c1' $$,
  '42501', null, 'a user cannot change their own is_active');

select lives_ok(
  $$ update public.profiles set phone = '+919999999999' where id = '00000000-0000-0000-0000-0000000000c1' $$,
  'a user can edit their own contact fields');

-- ── as surveyor ────────────────────────────────────────────────────────────
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","user_role":"surveyor"}';

select throws_ok(
  $$ insert into public.condition_flags (code, name) values ('x', 'X') $$,
  '42501', null, 'P4: surveyor cannot write condition_flags');

select is((select count(*)::int from public.condition_flags), 5, 'surveyor reads condition flags');

-- ── as customer ────────────────────────────────────────────────────────────
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","user_role":"customer"}';

select is((select count(*)::int from public.profiles), 0, 'customer cannot read the staff directory');
select is((select count(*)::int from public.settings), 0, 'customer cannot read settings');

-- ── as super_admin ─────────────────────────────────────────────────────────
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","user_role":"super_admin"}';

select lives_ok(
  $$ insert into public.fitting_types (code, name) values ('basin_mixer_test', 'Basin mixer') $$,
  'super_admin writes fitting_types');

reset role;
select is(
  (select actor_id from public.audit_log
   where entity_type = 'fitting_types' and after ->> 'code' = 'basin_mixer_test'),
  '00000000-0000-0000-0000-0000000000a1'::uuid,
  'BR-X4: the master edit is in audit_log with its actor');

select * from finish();
rollback;
