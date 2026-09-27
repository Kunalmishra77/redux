-- E1-S01, E1-S03, E1-S04, E1-S11 · schema.sql §2, §16 (audit_log), §17, §19 (shared triggers)
--
-- Identity, roles and org, plus the auth helpers every later policy depends on and the
-- audit trail every privileged table attaches to. RLS is enabled per table in this file —
-- never by a trailing loop, because a loop only covers tables that exist when it runs.
--
-- Deviations from schema.sql (recorded in blueprint/07-build/05-task-tracker.md):
--   * custom_access_token_hook gets the grants + policy Supabase requires. Without them the hook
--     runs as supabase_auth_admin, sees no user_roles rows through RLS, and silently stamps
--     every staff member 'customer'.
--   * The hook picks a user's role deterministically (enum order: super_admin first) instead of
--     an unordered `limit 1`.
--   * my_customer_id() is created with customer_contacts (§7), since its body references it.
--   * write_audit() reads the row id through jsonb, so it also works on tables without a uuid id.

-- ---------------------------------------------------------------------------
-- Shared trigger: updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.cities (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  state_code text not null,                        -- GST state code, e.g. '07' Delhi (BR-I4)
  is_active  boolean not null default true
);

create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null,
  email         text,
  phone         text,                              -- E.164
  avatar_url    text,
  city_id       uuid references public.cities(id),
  is_active     boolean not null default true,
  -- agent consent for call recording (their voice is personal data too)
  recording_consent_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index profiles_city_id_idx on public.profiles (city_id);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- ADR-004: the role lives here AND is projected into the JWT by the access token hook
create table public.user_roles (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references auth.users(id) on delete cascade,
  role     public.app_role not null,
  unique (user_id, role)
);
create index user_roles_user_id_idx on public.user_roles (user_id);

create table public.role_permissions (
  id         uuid primary key default gen_random_uuid(),
  role       public.app_role not null,
  permission text not null,                        -- e.g. 'rate_card.write'
  unique (role, permission)
);

-- Round-robin pointer for lead auto-assignment (BR-L4)
create table public.assignment_state (
  city_id       uuid primary key references public.cities(id),
  last_user_id  uuid references public.profiles(id),
  updated_at    timestamptz not null default now()
);

-- BR-X4: every privileged action is recorded with actor, before, after
create table public.audit_log (
  id          bigserial primary key,
  actor_id    uuid references public.profiles(id),
  actor_role  public.app_role,
  action      text not null,                       -- 'insert','update','delete'
  entity_type text not null,
  entity_id   uuid,
  before      jsonb,
  after       jsonb,
  ip_address  inet,
  occurred_at timestamptz not null default now()
);
create index audit_log_entity_idx   on public.audit_log (entity_type, entity_id);
create index audit_log_actor_idx    on public.audit_log (actor_id, occurred_at desc);
create index audit_log_occurred_idx on public.audit_log (occurred_at desc);

alter table public.cities           enable row level security;
alter table public.profiles         enable row level security;
alter table public.user_roles       enable row level security;
alter table public.role_permissions enable row level security;
alter table public.assignment_state enable row level security;
alter table public.audit_log        enable row level security;

-- ---------------------------------------------------------------------------
-- Auth helpers (ADR-004)
-- ---------------------------------------------------------------------------

-- Projects the user's role into the JWT. Registered in supabase/config.toml locally and in
-- Supabase → Authentication → Hooks → Custom Access Token on hosted projects.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  claims jsonb;
  v_role public.app_role;
begin
  -- A user may hold several roles; the most privileged wins (enum order), deterministically.
  select role into v_role
  from public.user_roles
  where user_id = (event->>'user_id')::uuid
  order by role
  limit 1;

  claims := coalesce(event->'claims', '{}'::jsonb);
  -- Portal customers have no user_roles row; they are identified through customer_contacts.
  claims := jsonb_set(claims, '{user_role}', to_jsonb(coalesce(v_role::text, 'customer')));
  return jsonb_set(event, '{claims}', claims);
end $$;

-- The hook is executed by supabase_auth_admin — and by nobody else.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
grant select on table public.user_roles to supabase_auth_admin;
create policy user_roles_read_auth_admin on public.user_roles
  as permissive for select to supabase_auth_admin using (true);

create or replace function public.current_role_is(target public.app_role)
returns boolean language sql stable set search_path = '' as $$
  select ((select auth.jwt()) ->> 'user_role') = target::text;
$$;

-- SECURITY DEFINER: avoids a join-table lookup per row (ADR-004: 178,000 ms → 12 ms)
create or replace function public.authorize(requested text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare bound int;
begin
  select count(*) into bound
  from public.role_permissions
  where role::text = ((select auth.jwt()) ->> 'user_role')
    and permission = requested;
  return bound > 0;
end $$;

create or replace function public.is_staff()
returns boolean language sql stable set search_path = '' as $$
  select ((select auth.jwt()) ->> 'user_role') in ('super_admin','cc_exec','surveyor');
$$;

-- ---------------------------------------------------------------------------
-- Audit trigger (BR-X4) — attach to every privileged table
-- ---------------------------------------------------------------------------
create or replace function public.write_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, before, after)
  values (
    (select auth.uid()),
    nullif((select auth.jwt()) ->> 'user_role', '')::public.app_role,
    lower(tg_op),
    tg_table_name,
    case when v_row ? 'id' and jsonb_typeof(v_row->'id') = 'string'
              and (v_row->>'id') ~* '^[0-9a-f-]{36}$'
         then (v_row->>'id')::uuid end,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return null;   -- AFTER trigger: return value ignored
end $$;

create trigger trg_audit_user_roles after insert or update or delete on public.user_roles
  for each row execute function public.write_audit();
create trigger trg_audit_role_permissions after insert or update or delete on public.role_permissions
  for each row execute function public.write_audit();
create trigger trg_audit_profiles after insert or update or delete on public.profiles
  for each row execute function public.write_audit();
create trigger trg_audit_cities after insert or update or delete on public.cities
  for each row execute function public.write_audit();

-- ---------------------------------------------------------------------------
-- Policies — ADR-004: (select auth.jwt()), TO authenticated, policy columns indexed
-- ---------------------------------------------------------------------------

-- cities: staff read (booking, assignment); super_admin writes
create policy cities_read_staff on public.cities for select to authenticated
  using ((select public.is_staff()));
create policy cities_write_admin on public.cities for all to authenticated
  using ((select public.current_role_is('super_admin')))
  with check ((select public.current_role_is('super_admin')));

-- profiles: staff read the team directory; everyone reads their own; super_admin writes.
create policy profiles_read on public.profiles for select to authenticated
  using ((select public.is_staff()) or id = (select auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
create policy profiles_write_admin on public.profiles for all to authenticated
  using ((select public.current_role_is('super_admin')))
  with check ((select public.current_role_is('super_admin')));

-- Self-service edits are limited to contact fields, so nobody can reactivate themselves or move
-- their own city (which would change lead assignment, BR-L4). A trigger rather than a column
-- grant, because super_admin also connects as `authenticated` and must keep full access.
create or replace function public.guard_profile_self_edit() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated'
     and not public.current_role_is('super_admin')
     and (new.is_active is distinct from old.is_active
          or new.city_id is distinct from old.city_id
          or new.email   is distinct from old.email) then
    raise exception 'Only a super_admin can change is_active, city_id or email'
      using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_self_edit();

-- user_roles: a user may read their own; super_admin manages (P4)
create policy user_roles_read_own on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_roles_write_admin on public.user_roles for all to authenticated
  using ((select public.current_role_is('super_admin')))
  with check ((select public.current_role_is('super_admin')));

-- role_permissions: read through authorize() (SECURITY DEFINER); super_admin manages
create policy role_permissions_admin on public.role_permissions for all to authenticated
  using ((select public.current_role_is('super_admin')))
  with check ((select public.current_role_is('super_admin')));

-- assignment_state: written by the assignment service (E3-S05); super_admin may inspect
create policy assignment_state_admin on public.assignment_state for all to authenticated
  using ((select public.current_role_is('super_admin')))
  with check ((select public.current_role_is('super_admin')));

-- audit_log: super_admin reads; nobody writes directly — only write_audit() (SECURITY DEFINER)
create policy audit_log_read_admin on public.audit_log for select to authenticated
  using ((select public.current_role_is('super_admin')));
revoke insert, update, delete on public.audit_log from authenticated, anon;
