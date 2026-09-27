-- E1-S02 · schema.sql §3 (masters) + §16 (settings) — admin-editable (D16)
--
-- Reference data the application logic depends on (codes, not labels) is seeded HERE, in the
-- migration, so staging and production get it from `supabase db push`. supabase/seed.sql is
-- for local/CI fixtures only and never runs against a hosted project.
--
-- Not seeded on purpose — REDUX supplies them (blueprint 00-brief/04 §A):
--   fitting_types, brands, finishes (A8, Week 9) · cities (A13, Week 6)

create table public.fitting_types (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,                 -- 'basin_mixer'
  name       text not null,                        -- 'Basin mixer'
  sort_order int  not null default 0,
  is_active  boolean not null default true
);

create table public.brands (
  id        uuid primary key default gen_random_uuid(),
  name      text not null unique,
  is_active boolean not null default true
);

create table public.finishes (
  id        uuid primary key default gen_random_uuid(),
  code      text not null unique,                  -- 'pvd_brushed_gold'
  name      text not null,                         -- 'PVD Brushed Gold'
  hex       text,                                  -- swatch for the UI
  is_active boolean not null default true
);

create table public.work_types (
  id        uuid primary key default gen_random_uuid(),
  code      text not null unique,                  -- matches treatment enum values
  name      text not null,
  is_active boolean not null default true
);

create table public.condition_flags (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  sort_order int not null default 0,
  is_active  boolean not null default true
);

create table public.lost_reasons (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  name          text not null,
  requires_note boolean not null default false,
  sort_order    int not null default 0,
  is_active     boolean not null default true
);

-- Thresholds, periods and limits live here — never hardcoded (CLAUDE.md "What not to do")
create table public.settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_by  uuid references public.profiles(id),
  updated_at  timestamptz not null default now()
);
create trigger trg_settings_updated before update on public.settings
  for each row execute function public.set_updated_at();

alter table public.fitting_types   enable row level security;
alter table public.brands          enable row level security;
alter table public.finishes        enable row level security;
alter table public.work_types      enable row level security;
alter table public.condition_flags enable row level security;
alter table public.lost_reasons    enable row level security;
alter table public.settings        enable row level security;

-- ---------------------------------------------------------------------------
-- Policies: staff read, super_admin writes (P4). Customer read is added in Phase 3 (D13)
-- when the portal first shows fitting names.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['fitting_types','brands','finishes','work_types',
                           'condition_flags','lost_reasons','settings']
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select public.is_staff()))',
      t || '_read_staff', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using ((select public.current_role_is(''super_admin'')))
         with check ((select public.current_role_is(''super_admin'')))',
      t || '_write_admin', t);
    -- BR-X4: master and settings edits are privileged
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function public.write_audit()',
      'trg_audit_' || t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Seed: only lists the blueprint defines (glossary, PRD D2-08, D7-06, schema.sql §16)
-- ---------------------------------------------------------------------------
insert into public.work_types (code, name) values
  ('restore_finish',    'Restore finish'),
  ('repair_function',   'Repair function'),
  ('replace_eurobrass', 'Replace with Eurobrass')
on conflict (code) do nothing;

insert into public.condition_flags (code, name, sort_order) values
  ('leak',             'Leak',             10),
  ('stiff_control',    'Stiff control',    20),
  ('scaling',          'Scaling',          30),
  ('worn_finish',      'Worn finish',      40),
  ('part_unavailable', 'Part unavailable', 50)
on conflict (code) do nothing;

-- BR-L7: lost requires a reason from this list; 'other' requires a note (D2-08)
insert into public.lost_reasons (code, name, requires_note, sort_order) values
  ('price',          'Price',          false, 10),
  ('timing',         'Timing',         false, 20),
  ('not_restorable', 'Not restorable', false, 30),
  ('no_response',    'No response',    false, 40),
  ('competitor',     'Competitor',     false, 50),
  ('other',          'Other',          true,  60)
on conflict (code) do nothing;

insert into public.settings (key, value, description) values
  ('quote_validity_days',      '15',    'BR-Q1: days a sent quotation stays approvable'),
  ('discount_threshold_pct',   '5',     'BR-A6: discounts above this need super_admin approval'),
  ('sla_callback_minutes',     '60',    'BR-L5: call-back SLA, measured from lead creation'),
  ('recording_retention_days', '90',    'BR-P4: call recordings auto-delete after this'),
  ('geofence_radius_m',        '500',   'BR-S4: check-in further than this from the property is flagged'),
  ('gps_accuracy_flag_m',      '50',    'BR-S3: check-in accuracy worse than this is flagged, not blocked'),
  ('payment_link_max',         '50000', 'BR-I6: invoices above this (INR) route to a virtual account')
on conflict (key) do nothing;
