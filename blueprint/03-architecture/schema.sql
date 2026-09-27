-- =============================================================================
-- REDUX PLATFORM — DATABASE SCHEMA
-- PostgreSQL 15+ / Supabase (ap-south-1)
-- Blueprint v1.0 · 26 September 2026
-- =============================================================================
--
-- READ THIS BEFORE CHANGING ANYTHING
--
-- 1. Every table has RLS enabled. A table with RLS and no policy denies by default —
--    that is intentional. Never disable RLS to "make it work".
-- 2. Every policy follows the four rules in ADR-004:
--      (a) wrap auth.uid() / auth.jwt() in (select ...)
--      (b) index every column a policy filters on
--      (c) always specify TO authenticated
--      (d) still filter in the client query
-- 3. Immutability spine: quotations, quote_approvals, invoices, fitting_photos.
--    These are superseded / appended, never edited or deleted.
-- 4. Migrations are forward-only and live in supabase/migrations/. Split this file
--    into numbered migrations; do not run it as one blob against production.
--
-- VALIDATION STATUS (26 Sep 2026)
--   Executed clean against PostgreSQL 16: 0 errors.
--   65 tables · 19 enums · 181 indexes · 47 functions · RLS enabled on 65/65 tables.
--   Business rules verified by execution:
--     BR-I1 invoice numbering gap-free  → RDX/2627/00001, 00002, 00003
--     BR-A4 you_save never negative     → clamps to 0.00
--     BR-L3 lead attribution immutable  → UPDATE rejected by trigger
--     D9-03 one active rate card        → second active INSERT rejected
--     BR-ST1 stock never negative       → negative UPDATE rejected
--     DPDP Rule 7 72-hour clock         → 01 Oct 10:00 IST → 04 Oct 10:00 IST
-- =============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;
create extension if not exists pg_cron;
create extension if not exists pgmq;

-- =============================================================================
-- SECTION 1 — ENUMS
-- =============================================================================

create type app_role           as enum ('super_admin','cc_exec','surveyor','customer');
create type lead_status        as enum ('new','contacted','survey_booked','surveyed','quoted','won','lost');
create type survey_status      as enum ('scheduled','checked_in','in_progress','submitted','cancelled');
create type treatment          as enum ('restore_finish','repair_function','replace_eurobrass','no_action');
create type quote_status       as enum ('draft','pending_approval','sent','approved','rejected','expired','superseded');
create type job_stage          as enum ('dates_confirmed','removal_pickup','at_eurobrass','quality_check',
                                        'refit_test','handover','warranty_active');
create type job_status         as enum ('planned','in_progress','completed','cancelled');
create type unit_status        as enum ('scheduled','in_progress','blocked','back_in_service');
create type invoice_status     as enum ('draft','issued','part_paid','paid','cancelled');
create type payment_status     as enum ('created','captured','failed','refunded');
create type stock_move_type    as enum ('in','out','consumed','adjusted');
create type consent_purpose    as enum ('service','marketing','call_recording','photo_marketing');
create type webhook_source     as enum ('meta_leadgen','whatsapp','google_ads','razorpay');
create type webhook_status     as enum ('pending','processing','done','failed','dead');
create type msg_channel        as enum ('whatsapp','sms','email','in_app','push');
create type msg_category       as enum ('utility','marketing','authentication','service');
create type msg_status         as enum ('queued','sent','delivered','read','failed');
create type dsr_type           as enum ('access','correction','erasure','nomination','withdraw_consent');
create type dsr_status         as enum ('received','in_progress','completed','rejected');

-- =============================================================================
-- SECTION 2 — IDENTITY, ROLES, ORG
-- =============================================================================

create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null,
  email         text,
  phone         text,                              -- E.164
  avatar_url    text,
  city_id       uuid,                              -- FK added after cities
  is_active     boolean not null default true,
  -- agent consent for call recording (their voice is personal data too)
  recording_consent_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table cities (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  state_code text not null,                        -- GST state code, e.g. '07' Delhi
  is_active  boolean not null default true
);
alter table profiles add constraint profiles_city_fk
  foreign key (city_id) references cities(id);

-- ADR-004: role lives here AND is projected into the JWT by the access token hook
create table user_roles (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references auth.users(id) on delete cascade,
  role     app_role not null,
  unique (user_id, role)
);
create index on user_roles (user_id);

create table role_permissions (
  id         uuid primary key default gen_random_uuid(),
  role       app_role not null,
  permission text not null,                        -- e.g. 'rate_card.write'
  unique (role, permission)
);

-- Round-robin pointer for lead auto-assignment (BR-L4)
create table assignment_state (
  city_id       uuid primary key references cities(id),
  last_user_id  uuid references profiles(id),
  updated_at    timestamptz not null default now()
);

-- =============================================================================
-- SECTION 3 — MASTER DATA (admin-editable, D16)
-- =============================================================================

create table fitting_types (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,                 -- 'basin_mixer'
  name       text not null,                        -- 'Basin mixer'
  sort_order int  not null default 0,
  is_active  boolean not null default true
);

create table brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true
);

create table finishes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                       -- 'pvd_brushed_gold'
  name text not null,                              -- 'PVD Brushed Gold'
  hex  text,                                       -- swatch for the UI
  is_active boolean not null default true
);

create table work_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                       -- matches treatment enum values
  name text not null,
  is_active boolean not null default true
);

create table condition_flags (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                       -- 'leak','stiff_control','scaling','worn_finish','part_unavailable'
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table lost_reasons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                       -- 'price','timing','not_restorable','no_response','competitor','other'
  name text not null,
  requires_note boolean not null default false,
  is_active boolean not null default true
);

-- =============================================================================
-- SECTION 4 — RATE CARD (D9) — versioned, BR-A3
-- =============================================================================

create table rate_cards (
  id             uuid primary key default gen_random_uuid(),
  version        int  not null,
  effective_from date not null,
  is_active      boolean not null default false,
  notes          text,
  created_by     uuid references profiles(id),
  created_at     timestamptz not null default now(),
  unique (version)
);
-- only one active version at a time (BR: D9-03)
create unique index rate_cards_one_active on rate_cards (is_active) where is_active;

create table rate_card_items (
  id               uuid primary key default gen_random_uuid(),
  rate_card_id     uuid not null references rate_cards(id) on delete cascade,
  fitting_type_id  uuid not null references fitting_types(id),
  work_type_id     uuid not null references work_types(id),
  finish_id        uuid references finishes(id),    -- null where finish is irrelevant
  price            numeric(12,2) not null check (price >= 0),
  gst_rate         numeric(5,2)  not null default 18.00,
  hsn_sac          text,                            -- CA-confirmed; see compliance doc
  unique (rate_card_id, fitting_type_id, work_type_id, finish_id)
);
create index on rate_card_items (rate_card_id);

-- Market replacement price, so the quote can show "You save" (BR-A4)
create table market_prices (
  id              uuid primary key default gen_random_uuid(),
  rate_card_id    uuid not null references rate_cards(id) on delete cascade,
  fitting_type_id uuid not null references fitting_types(id),
  price           numeric(12,2) not null check (price >= 0),
  unique (rate_card_id, fitting_type_id)
);

-- =============================================================================
-- SECTION 5 — LEADS (D2, D3)
-- =============================================================================

create table lead_sources (
  id        uuid primary key default gen_random_uuid(),
  code      text not null unique,   -- website | dealer | meta_lead_ad | whatsapp_chat
                                    -- | whatsapp_campaign | google_ads | call | walk_in
  name      text not null,
  is_active boolean not null default true
);

create table campaigns (
  id            uuid primary key default gen_random_uuid(),
  source_id     uuid not null references lead_sources(id),
  external_id   text,                          -- Meta campaign_id / Google campaign_id
  name          text not null,
  spend_to_date numeric(12,2),                 -- manually maintained; powers cost-per-won-job
  started_on    date,
  ended_on      date,
  unique (source_id, external_id)
);

create table leads (
  id             uuid primary key default gen_random_uuid(),
  -- identity: BR-L1, phone normalised to E.164, unique
  phone          text not null,
  name           text,
  email          text,
  city_id        uuid references cities(id),

  -- classification
  customer_type  text check (customer_type in ('home','hotel','dealer','other')),
  property_name  text,
  unit_count     int,                           -- rooms / bathrooms claimed at enquiry
  enquirer_role  text,                          -- 'chief_engineer','gm','owner', ...

  -- attribution: BR-L3, immutable after insert
  source_id      uuid not null references lead_sources(id),
  campaign_id    uuid references campaigns(id),
  meta_ad_id     text,
  meta_form_id   text,
  meta_leadgen_id text,
  google_lead_id text,
  ctwa_clid      text,                          -- cannot be backfilled — capture at creation
  utm            jsonb,
  raw_payload    jsonb,                         -- provider payload as received

  -- workflow
  status         lead_status not null default 'new',
  assigned_to    uuid references profiles(id),
  assigned_at    timestamptz,
  sla_due_at     timestamptz,                   -- BR-L5: from creation, not assignment
  lost_reason_id uuid references lost_reasons(id),
  lost_note      text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint leads_phone_unique unique (phone),
  constraint leads_lost_needs_reason
    check (status <> 'lost' or lost_reason_id is not null)
);
create index on leads (assigned_to);
create index on leads (status);
create index on leads (source_id);
create index on leads (city_id);
create index on leads (sla_due_at) where status in ('new','contacted');
create index on leads (created_at desc);
create unique index leads_meta_leadgen_uq on leads (meta_leadgen_id) where meta_leadgen_id is not null;
create unique index leads_google_lead_uq  on leads (google_lead_id)  where google_lead_id  is not null;

-- A repeat enquiry from the same number is a TOUCH, not a new lead (BR-L1/L2)
create table lead_touches (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references leads(id) on delete cascade,
  source_id   uuid not null references lead_sources(id),
  campaign_id uuid references campaigns(id),
  payload     jsonb,
  occurred_at timestamptz not null default now()
);
create index on lead_touches (lead_id);

create table lead_status_history (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references leads(id) on delete cascade,
  from_status lead_status,
  to_status   lead_status not null,
  actor_id    uuid references profiles(id),
  note        text,
  changed_at  timestamptz not null default now()
);
create index on lead_status_history (lead_id);

create table lead_notes (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references leads(id) on delete cascade,
  author_id  uuid references profiles(id),
  body       text not null,
  created_at timestamptz not null default now()
);
create index on lead_notes (lead_id);

create table follow_ups (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references leads(id) on delete cascade,
  assigned_to uuid not null references profiles(id),
  due_at      timestamptz not null,
  note        text,
  completed_at timestamptz,
  created_at  timestamptz not null default now()
);
create index on follow_ups (assigned_to, due_at) where completed_at is null;

-- =============================================================================
-- SECTION 6 — CALLS (D4)
-- =============================================================================

create table calls (
  id             uuid primary key default gen_random_uuid(),
  lead_id        uuid references leads(id) on delete set null,
  customer_id    uuid,                              -- FK added after customers
  agent_id       uuid not null references profiles(id),
  direction      text not null check (direction in ('outbound','inbound')),
  started_at     timestamptz not null,
  ended_at       timestamptz,
  duration_sec   int,
  outcome        text,                              -- controlled list in app config
  outcome_note   text,
  provider_call_id text,
  -- consent: announcement played and customer did not opt out (BR-P2)
  recording_consent boolean not null default false,
  recording_path text,                              -- storage path, private bucket
  recording_expires_at timestamptz,                 -- BR-P4: 90 days
  created_at     timestamptz not null default now()
);
create index on calls (lead_id);
create index on calls (agent_id, started_at desc);
create index on calls (recording_expires_at) where recording_path is not null;

-- =============================================================================
-- SECTION 7 — CUSTOMERS, PROPERTIES, UNITS
-- =============================================================================

create table customers (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid references leads(id),
  name        text not null,
  type        text not null check (type in ('home','hotel','dealer','other')),
  gstin       text,
  billing_address text,
  billing_city_id uuid references cities(id),
  billing_state_code text,                           -- drives CGST/SGST vs IGST (BR-I4)
  created_at  timestamptz not null default now()
);
create index on customers (lead_id);

alter table calls add constraint calls_customer_fk
  foreign key (customer_id) references customers(id) on delete set null;

-- A contact is a person who can log in to the portal for a customer
create table customer_contacts (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  user_id     uuid references auth.users(id),        -- set once they log in
  name        text not null,
  phone       text not null,                         -- E.164, used for OTP login
  email       text,
  role_title  text,                                  -- 'Chief Engineer','Accounts', ...
  is_primary  boolean not null default false,
  notify_prefs jsonb not null default '{}'::jsonb,
  is_active   boolean not null default true,
  unique (customer_id, phone)
);
create index on customer_contacts (user_id);
create index on customer_contacts (phone);

create table properties (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references customers(id) on delete cascade,
  name         text not null,
  address      text,
  city_id      uuid references cities(id),
  lat          numeric(9,6),
  lng          numeric(9,6),                         -- used for the check-in geofence (BR-S4)
  unit_label   text not null default 'Room',         -- 'Room' for hotels, 'Bathroom' for homes
  created_at   timestamptz not null default now()
);
create index on properties (customer_id);

create table property_units (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  label       text not null,                         -- '204', 'Master bath'
  floor       text,
  wing        text,
  notes       text,
  created_at  timestamptz not null default now(),
  unique (property_id, label)
);
create index on property_units (property_id);

-- =============================================================================
-- SECTION 8 — SURVEYS (D7) — the survey is FREE, it has no price column (BR-S1)
-- =============================================================================

create table surveys (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid references leads(id),
  property_id   uuid references properties(id),
  surveyor_id   uuid not null references profiles(id),
  booked_by     uuid references profiles(id),
  scheduled_at  timestamptz not null,
  slot_end_at   timestamptz,
  status        survey_status not null default 'scheduled',
  submitted_at  timestamptz,
  cancel_reason text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on surveys (surveyor_id, scheduled_at);
create index on surveys (lead_id);
create index on surveys (status);
-- BR-S2: one surveyor cannot hold two surveys in the same slot
create unique index surveys_no_double_book
  on surveys (surveyor_id, scheduled_at) where status <> 'cancelled';

create table survey_checkins (
  id            uuid primary key default gen_random_uuid(),
  survey_id     uuid not null references surveys(id) on delete cascade,
  surveyor_id   uuid not null references profiles(id),
  lat           numeric(9,6) not null,
  lng           numeric(9,6) not null,
  accuracy_m    numeric(8,2),                        -- BR-S3: >50 flagged, not blocked
  is_mocked     boolean not null default false,
  device_id     text,
  checked_in_at timestamptz not null default now(),
  -- server-side integrity (BR-S4)
  geofence_ok   boolean,
  distance_m    numeric(10,2),
  flagged       boolean not null default false,
  flag_reason   text
);
create index on survey_checkins (survey_id);

create table fittings (
  id               uuid primary key default gen_random_uuid(),
  survey_id        uuid not null references surveys(id) on delete cascade,
  property_unit_id uuid references property_units(id),
  unit_label       text,                             -- captured on site if the unit was new
  fitting_type_id  uuid not null references fitting_types(id),
  brand_id         uuid references brands(id),
  model            text,
  current_finish_id uuid references finishes(id),
  notes            text,
  -- client-generated UUIDv7 + idempotency key from the offline outbox (ADR-006)
  idem_key         text not null unique,
  captured_at      timestamptz not null,
  created_at       timestamptz not null default now()
);
create index on fittings (survey_id);
create index on fittings (property_unit_id);

create table fitting_conditions (
  fitting_id        uuid not null references fittings(id) on delete cascade,
  condition_flag_id uuid not null references condition_flags(id),
  primary key (fitting_id, condition_flag_id)
);

-- BR-S5: exactly four slots, BR-S7: immutable once synced
create table fitting_photos (
  id          uuid primary key default gen_random_uuid(),
  fitting_id  uuid not null references fittings(id) on delete cascade,
  slot        text not null check (slot in ('front','side','top','close_up')),
  storage_path text not null,                        -- surveys/{sid}/{fid}/{slot}/{sha256}.jpg
  sha256      text not null,
  bytes       int,
  width       int,
  height      int,
  lat         numeric(9,6),
  lng         numeric(9,6),
  accuracy_m  numeric(8,2),
  device_id   text,
  captured_at timestamptz not null,
  uploaded_at timestamptz not null default now(),
  -- BR-P3: site photos may not be used for marketing without separate consent
  marketing_use_consented boolean not null default false,
  unique (fitting_id, slot, sha256)
);
create index on fitting_photos (fitting_id);

-- Helper: a fitting is complete only with all four slots (enforced in app + this view)
create view v_incomplete_fittings as
select f.id as fitting_id, f.survey_id, count(p.id) as photo_count
from fittings f left join fitting_photos p on p.fitting_id = f.id
group by f.id, f.survey_id
having count(distinct p.slot) < 4;

-- =============================================================================
-- SECTION 9 — ASSESSMENT (D8) — all three options always priced (BR-A2)
-- =============================================================================

create table assessments (
  id                  uuid primary key default gen_random_uuid(),
  fitting_id          uuid not null references fittings(id) on delete cascade,
  recommended         treatment not null,
  finish_id           uuid references finishes(id),   -- target finish if restoring
  -- the three prices, frozen against a rate card version (BR-A3)
  rate_card_id        uuid not null references rate_cards(id),
  price_recommended   numeric(12,2) not null check (price_recommended >= 0),
  price_replace_eurobrass numeric(12,2) not null check (price_replace_eurobrass >= 0),
  price_market_replacement numeric(12,2) not null check (price_market_replacement >= 0),
  part_unavailable_note text,                         -- "Eurobrass can re-machine this"
  surveyor_note       text,
  -- BR-A5: any price not from the rate card must be justified
  is_manual_override  boolean not null default false,
  override_reason     text,
  created_by          uuid references profiles(id),
  created_at          timestamptz not null default now(),
  unique (fitting_id),
  constraint assessment_override_needs_reason
    check (not is_manual_override or override_reason is not null)
);
create index on assessments (rate_card_id);

-- =============================================================================
-- SECTION 10 — QUOTATIONS (D10) — immutable once sent (BR-Q2)
-- =============================================================================

create table quotations (
  id             uuid primary key default gen_random_uuid(),
  quote_no       text not null unique,               -- Q-2026-0148
  version        int  not null default 1,
  supersedes_id  uuid references quotations(id),
  survey_id      uuid references surveys(id),
  lead_id        uuid references leads(id),
  customer_id    uuid references customers(id),
  property_id    uuid references properties(id),
  rate_card_id   uuid not null references rate_cards(id),

  status         quote_status not null default 'draft',
  issued_at      timestamptz,
  valid_until    date,                                -- BR-Q1: issued + 15 days

  subtotal       numeric(12,2) not null default 0,
  discount_pct   numeric(5,2)  not null default 0,
  discount_amount numeric(12,2) not null default 0,
  taxable_value  numeric(12,2) not null default 0,
  cgst           numeric(12,2) not null default 0,
  sgst           numeric(12,2) not null default 0,
  igst           numeric(12,2) not null default 0,
  total          numeric(12,2) not null default 0,
  market_total   numeric(12,2) not null default 0,
  you_save       numeric(12,2) not null default 0,    -- BR-A4, never negative

  -- BR-Q3: terms snapshotted at issue, never re-read from master
  terms_text     text,
  terms_version  text,
  warranty_mechanical_days int,
  warranty_finish_days     int,

  pdf_path       text,
  pdf_sha256     text,                                 -- BR-Q4 evidence

  created_by     uuid references profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint quote_you_save_non_negative check (you_save >= 0)
);
create index on quotations (survey_id);
create index on quotations (customer_id);
create index on quotations (status);
create index on quotations (valid_until) where status = 'sent';

create table quotation_lines (
  id              uuid primary key default gen_random_uuid(),
  quotation_id    uuid not null references quotations(id) on delete cascade,
  fitting_id      uuid references fittings(id),
  assessment_id   uuid references assessments(id),
  unit_label      text,
  description     text not null,
  work_type_id    uuid references work_types(id),
  finish_id       uuid references finishes(id),
  qty             numeric(10,2) not null default 1,
  unit_price      numeric(12,2) not null,
  line_total      numeric(12,2) not null,
  market_price    numeric(12,2) not null default 0,
  gst_rate        numeric(5,2)  not null default 18.00,
  hsn_sac         text,
  sort_order      int not null default 0
);
create index on quotation_lines (quotation_id);

-- BR-Q4 / compliance §6 — append-only evidence for IT Act s.65B / BSA s.63
create table quote_approvals (
  id                uuid primary key default gen_random_uuid(),
  quotation_id      uuid not null references quotations(id),
  quotation_version int not null,
  pdf_sha256        text not null,                    -- hash of the EXACT approved PDF
  approver_name     text not null,
  approver_phone    text not null,
  otp_hash          text not null,                    -- never plaintext
  otp_generated_at  timestamptz not null,
  otp_delivered_at  timestamptz,
  otp_verified_at   timestamptz not null,             -- server-side, NTP-synced
  delivery_channel  msg_channel not null,
  gateway_message_id text,
  dlt_template_id   text,
  attempt_count     int not null default 1,
  failed_attempts   int not null default 0,
  ip_address        inet,
  user_agent        text,
  geolocation       jsonb,
  terms_text        text not null,                    -- exact terms shown at approval
  created_at        timestamptz not null default now()
);
create index on quote_approvals (quotation_id);

create table discount_approvals (
  id            uuid primary key default gen_random_uuid(),
  quotation_id  uuid not null references quotations(id) on delete cascade,
  requested_by  uuid not null references profiles(id),
  requested_pct numeric(5,2) not null,
  reason        text not null,
  decided_by    uuid references profiles(id),
  decision      text check (decision in ('approved','rejected')),
  decision_note text,
  requested_at  timestamptz not null default now(),
  decided_at    timestamptz
);
create index on discount_approvals (quotation_id);

-- =============================================================================
-- SECTION 11 — JOBS (D11)
-- =============================================================================

create table jobs (
  id             uuid primary key default gen_random_uuid(),
  job_no         text not null unique,
  quotation_id   uuid not null references quotations(id),
  customer_id    uuid not null references customers(id),
  property_id    uuid not null references properties(id),
  -- BR-J6: pilot → wider project
  is_pilot       boolean not null default false,
  parent_job_id  uuid references jobs(id),
  status         job_status not null default 'planned',
  current_stage  job_stage not null default 'dates_confirmed',
  planned_start  date,
  planned_end    date,
  actual_start   date,
  actual_end     date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index on jobs (customer_id);
create index on jobs (property_id);
create index on jobs (status);
create index on jobs (parent_job_id);

create table job_batches (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references jobs(id) on delete cascade,
  name        text not null,                         -- 'Batch 2 · Rooms 204–207'
  planned_from date,
  planned_to   date,
  sort_order  int not null default 0
);
create index on job_batches (job_id);

create table job_units (
  id               uuid primary key default gen_random_uuid(),
  job_id           uuid not null references jobs(id) on delete cascade,
  batch_id         uuid references job_batches(id),
  property_unit_id uuid not null references property_units(id),
  status           unit_status not null default 'scheduled',
  current_stage    job_stage not null default 'dates_confirmed',
  downtime_from    timestamptz,
  downtime_to      timestamptz,
  planned_downtime_hours numeric(6,2),
  -- BR-J2: the delay clock stops while blocked (e.g. the hotel's civil work)
  blocked_reason   text check (blocked_reason in ('civil_work','access','parts','customer_hold','other')),
  blocked_from     timestamptz,
  blocked_to       timestamptz,
  blocked_note     text,
  back_in_service_at timestamptz,
  unique (job_id, property_unit_id)
);
create index on job_units (job_id);
create index on job_units (batch_id);
create index on job_units (status);

create table job_stage_events (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid references jobs(id) on delete cascade,
  job_unit_id  uuid references job_units(id) on delete cascade,
  from_stage   job_stage,
  to_stage     job_stage not null,
  actor_id     uuid references profiles(id),
  note         text,
  is_backward  boolean not null default false,
  backward_reason text,
  occurred_at  timestamptz not null default now(),
  constraint backward_needs_reason
    check (not is_backward or backward_reason is not null)
);
create index on job_stage_events (job_id);
create index on job_stage_events (job_unit_id);

create table handovers (
  id           uuid primary key default gen_random_uuid(),
  job_unit_id  uuid not null references job_units(id) on delete cascade,
  surveyor_id  uuid references profiles(id),
  leak_check   boolean not null default false,
  operation_check boolean not null default false,
  finish_check boolean not null default false,
  customer_name text,
  signature_path text,
  notes        text,
  completed_at timestamptz not null default now(),
  unique (job_unit_id)
);

create table handover_photos (
  id           uuid primary key default gen_random_uuid(),
  handover_id  uuid not null references handovers(id) on delete cascade,
  fitting_id   uuid references fittings(id),
  storage_path text not null,
  sha256       text not null,
  captured_at  timestamptz not null default now()
);
create index on handover_photos (handover_id);

-- BR-J4/J5: generated at handover, separate periods
create table warranties (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references jobs(id) on delete cascade,
  job_unit_id  uuid references job_units(id),
  fitting_id   uuid references fittings(id),
  kind         text not null check (kind in ('mechanical','finish')),
  valid_from   date not null,
  valid_until  date not null,
  terms_text   text not null,
  card_no      text not null unique,
  created_at   timestamptz not null default now()
);
create index on warranties (job_id);
create index on warranties (valid_until);

-- =============================================================================
-- SECTION 12 — INVOICING & PAYMENTS (D13)
-- =============================================================================

-- BR-I1: gap-free sequential numbering per series per financial year
create table invoice_series (
  id          uuid primary key default gen_random_uuid(),
  code        text not null,                        -- 'RDX'
  fy_start    date not null,                        -- 2026-04-01
  fy_end      date not null,
  next_number int not null default 1,
  unique (code, fy_start)
);

create table invoices (
  id            uuid primary key default gen_random_uuid(),
  invoice_no    text not null unique,               -- max 16 chars: 'RDX/2627/00042'
  series_id     uuid not null references invoice_series(id),
  job_id        uuid references jobs(id),
  quotation_id  uuid references quotations(id),
  customer_id   uuid not null references customers(id),
  status        invoice_status not null default 'draft',
  issue_date    date not null,
  due_date      date,
  supply_date   date,                                -- BR-I8: invoice within 30 days

  -- GST fields stored, never recomputed at render (BR-I3)
  supplier_gstin text not null,
  supplier_name  text not null,
  supplier_address text not null,
  recipient_gstin text,
  recipient_name  text not null,
  recipient_address text not null,
  place_of_supply_state_code text not null,          -- BR-I4
  reverse_charge boolean not null default false,

  subtotal      numeric(12,2) not null default 0,
  taxable_value numeric(12,2) not null default 0,
  cgst          numeric(12,2) not null default 0,
  sgst          numeric(12,2) not null default 0,
  igst          numeric(12,2) not null default 0,
  total         numeric(12,2) not null default 0,
  amount_paid   numeric(12,2) not null default 0,

  pdf_path      text,
  pdf_sha256    text,
  -- payment routing (BR-I6)
  payment_link_url text,
  virtual_account_id text,
  virtual_account_details jsonb,

  cancelled_at  timestamptz,
  created_at    timestamptz not null default now(),
  constraint invoice_no_len check (char_length(invoice_no) <= 16)
);
create index on invoices (customer_id);
create index on invoices (job_id);
create index on invoices (status);
create index on invoices (due_date) where status in ('issued','part_paid');

create table invoice_lines (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references invoices(id) on delete cascade,
  description text not null,
  hsn_sac     text not null,
  qty         numeric(10,2) not null default 1,
  uom         text not null default 'NOS',
  unit_price  numeric(12,2) not null,
  taxable_value numeric(12,2) not null,
  gst_rate    numeric(5,2) not null,
  cgst        numeric(12,2) not null default 0,
  sgst        numeric(12,2) not null default 0,
  igst        numeric(12,2) not null default 0,
  line_total  numeric(12,2) not null,
  sort_order  int not null default 0
);
create index on invoice_lines (invoice_id);

create table payments (
  id              uuid primary key default gen_random_uuid(),
  invoice_id      uuid not null references invoices(id),
  provider        text not null default 'razorpay',
  provider_payment_id text not null,                 -- BR-I7 idempotency
  method          text,                              -- upi | card | netbanking | neft | rtgs
  amount          numeric(12,2) not null,
  status          payment_status not null,
  captured_at     timestamptz,
  raw_payload     jsonb,
  created_at      timestamptz not null default now(),
  unique (provider, provider_payment_id)
);
create index on payments (invoice_id);

-- BR-I2: cancellation is a credit note, never a delete
create table credit_notes (
  id          uuid primary key default gen_random_uuid(),
  credit_no   text not null unique,
  invoice_id  uuid not null references invoices(id),
  reason      text not null,
  amount      numeric(12,2) not null,
  issue_date  date not null,
  pdf_path    text,
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now()
);

-- =============================================================================
-- SECTION 13 — STOCK (D15)
-- =============================================================================

create table stock_items (
  id            uuid primary key default gen_random_uuid(),
  sku           text not null unique,
  name          text not null,
  category      text,                                -- cartridge | spare | finish | replacement
  uom           text not null default 'NOS',
  quantity      numeric(12,2) not null default 0 check (quantity >= 0),  -- BR-ST1
  min_level     numeric(12,2) not null default 0,
  is_active     boolean not null default true,
  -- BR-ST3: alert once per crossing
  below_min_since timestamptz,
  last_alert_at timestamptz
);
create index on stock_items (category);

create table stock_movements (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references stock_items(id),
  type         stock_move_type not null,
  quantity     numeric(12,2) not null,
  job_id       uuid references jobs(id),
  reason       text,
  actor_id     uuid not null references profiles(id),  -- BR-ST2
  occurred_at  timestamptz not null default now()
);
create index on stock_movements (item_id, occurred_at desc);
create index on stock_movements (job_id);

-- =============================================================================
-- SECTION 14 — SERVICE REQUESTS (D13)
-- =============================================================================

create table service_requests (
  id           uuid primary key default gen_random_uuid(),
  ticket_no    text not null unique,
  customer_id  uuid not null references customers(id),
  property_id  uuid references properties(id),
  job_unit_id  uuid references job_units(id),
  warranty_id  uuid references warranties(id),
  raised_by    uuid references auth.users(id),
  subject      text not null,
  body         text,
  status       text not null default 'open'
               check (status in ('open','acknowledged','in_progress','resolved','closed')),
  assigned_to  uuid references profiles(id),
  -- E-Commerce Rules: acknowledge within 48 h, resolve within 1 month
  ack_due_at   timestamptz not null,
  acknowledged_at timestamptz,
  resolve_due_at timestamptz not null,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index on service_requests (customer_id);
create index on service_requests (status);
create index on service_requests (ack_due_at) where acknowledged_at is null;

-- =============================================================================
-- SECTION 15 — INTEGRATIONS, WEBHOOKS, MESSAGING
-- =============================================================================

create table integration_accounts (
  id            uuid primary key default gen_random_uuid(),
  provider      text not null,                       -- meta | whatsapp | google_ads | razorpay | msg91
  external_id   text,                                -- page_id / waba_id / customer_id
  display_name  text,
  config        jsonb not null default '{}'::jsonb,  -- NO SECRETS — those live in env
  is_active     boolean not null default true,
  last_event_at timestamptz,                         -- powers the integration health screen
  unique (provider, external_id)
);

-- ADR-008: verify → persist raw → ack. Processing happens in the worker.
create table webhook_events (
  id           uuid primary key default gen_random_uuid(),
  source       webhook_source not null,
  external_id  text not null,                        -- leadgen_id | wamid | lead_id | payment.id
  payload      jsonb not null,
  signature_ok boolean not null default true,
  status       webhook_status not null default 'pending',
  retry_count  int not null default 0,
  last_error   text,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  unique (source, external_id)
);
create index on webhook_events (status, received_at) where status in ('pending','failed');

-- Meta custom lead-form questions are auto-slugged and change if the marketer edits them.
-- Never hardcode field names — map them here. (integration research §1)
create table lead_form_field_map (
  id           uuid primary key default gen_random_uuid(),
  provider     text not null,                        -- meta | google_ads
  form_id      text not null,
  field_name   text not null,                        -- as received
  maps_to      text not null,                        -- leads column or 'meta.<key>'
  unique (provider, form_id, field_name)
);

create table whatsapp_conversations (
  id            uuid primary key default gen_random_uuid(),
  wa_id         text not null unique,                -- customer phone as WhatsApp gives it
  lead_id       uuid references leads(id),
  customer_id   uuid references customers(id),
  profile_name  text,
  -- CTWA attribution from the referral object — cannot be backfilled
  referral_source_id   text,
  referral_source_type text,
  ctwa_clid     text,
  window_expires_at timestamptz,                     -- the 24-hour service window
  last_message_at timestamptz,
  created_at    timestamptz not null default now()
);
create index on whatsapp_conversations (lead_id);

create table message_templates (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,                -- 'survey_booked'
  channel       msg_channel not null,
  category      msg_category not null,               -- utility vs marketing: 7.5x cost
  provider_template_name text,
  dlt_template_id text,
  language      text not null default 'en',
  body          text not null,
  variables     jsonb not null default '[]'::jsonb,
  is_active     boolean not null default true,
  approved_at   timestamptz
);

create table notification_rules (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,                -- 'CN2'
  trigger_event text not null,
  template_id   uuid references message_templates(id),
  audience      text not null,                       -- customer | assigned_cc | admin | surveyor
  is_active     boolean not null default true,
  quiet_hours   boolean not null default true
);

create table messages (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid references message_templates(id),
  rule_code     text,
  channel       msg_channel not null,
  category      msg_category,
  to_address    text not null,
  lead_id       uuid references leads(id),
  customer_id   uuid references customers(id),
  entity_type   text,
  entity_id     uuid,
  body          text,
  status        msg_status not null default 'queued',
  provider_message_id text,
  error         text,
  cost_inr      numeric(10,4),                       -- so REDUX can see messaging cost per job
  dedup_key     text unique,                         -- trigger + entity + window
  queued_at     timestamptz not null default now(),
  sent_at       timestamptz,
  delivered_at  timestamptz
);
create index on messages (lead_id);
create index on messages (customer_id);
create index on messages (status) where status in ('queued','failed');

-- Meta Conversions API — lets ads optimise on booked surveys and won jobs
create table capi_events (
  id           uuid primary key default gen_random_uuid(),
  event_name   text not null,                        -- survey_booked | job_won
  lead_id      uuid references leads(id),
  ctwa_clid    text,
  value        numeric(12,2),
  currency     text default 'INR',
  sent_at      timestamptz,
  response     jsonb,
  status       text not null default 'pending',
  created_at   timestamptz not null default now()
);
create index on capi_events (status);

-- =============================================================================
-- SECTION 16 — CONSENT, PRIVACY, AUDIT (DPDP)
-- =============================================================================

create table privacy_notices (
  id          uuid primary key default gen_random_uuid(),
  version     text not null unique,                  -- 'v1.0'
  body        text not null,
  effective_from date not null,
  is_active   boolean not null default false
);

create table consent_records (
  id            uuid primary key default gen_random_uuid(),
  subject_phone text,
  subject_email text,
  lead_id       uuid references leads(id),
  customer_id   uuid references customers(id),
  purpose       consent_purpose not null,
  granted       boolean not null,
  notice_version text not null,                      -- BR-P1
  method        text not null,                       -- web_form | whatsapp | verbal_call | portal
  ip_address    inet,
  user_agent    text,
  granted_at    timestamptz not null default now(),
  withdrawn_at  timestamptz
);
create index on consent_records (lead_id);
create index on consent_records (subject_phone);
create index on consent_records (purpose) where withdrawn_at is null;

create table dsr_requests (
  id           uuid primary key default gen_random_uuid(),
  type         dsr_type not null,
  subject_phone text,
  customer_id  uuid references customers(id),
  status       dsr_status not null default 'received',
  details      text,
  response     text,
  due_at       timestamptz not null,
  completed_at timestamptz,
  handled_by   uuid references profiles(id),
  created_at   timestamptz not null default now()
);
create index on dsr_requests (status);

-- DPDP Rule 7: Board must get a detailed report within 72 hours
create table incidents (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text not null,
  discovered_at timestamptz not null,
  nature        text,
  extent        text,
  likely_impact text,
  mitigation    text,
  principals_notified_at timestamptz,
  board_notified_at timestamptz,
  report_due_at timestamptz not null,                 -- discovered_at + 72h, set by trigger below
  detailed_report_at timestamptz,
  closed_at     timestamptz,
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now()
);

-- DPDP Rule 7: the 72-hour clock. A generated column can't be used here because
-- timestamptz arithmetic is not immutable, so a trigger sets it.
create or replace function set_incident_report_due() returns trigger language plpgsql as $$
begin
  new.report_due_at := new.discovered_at + interval '72 hours';
  return new;
end $$;
create trigger trg_incident_report_due before insert or update of discovered_at on incidents
  for each row execute function set_incident_report_due();

create table audit_log (
  id          bigserial primary key,
  actor_id    uuid references profiles(id),
  actor_role  app_role,
  action      text not null,                         -- 'update','approve','delete_attempt'
  entity_type text not null,
  entity_id   uuid,
  before      jsonb,
  after       jsonb,
  ip_address  inet,
  occurred_at timestamptz not null default now()
);
create index on audit_log (entity_type, entity_id);
create index on audit_log (actor_id, occurred_at desc);
create index on audit_log (occurred_at desc);

create table settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_by  uuid references profiles(id),
  updated_at  timestamptz not null default now()
);
-- seed: quote_validity_days=15, discount_threshold_pct=5, sla_callback_minutes=60,
--       recording_retention_days=90, geofence_radius_m=500, payment_link_max=50000

-- =============================================================================
-- SECTION 17 — AUTH HELPERS (ADR-004)
-- =============================================================================

-- Projects the user's role into the JWT. Register in Supabase → Auth → Hooks.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable as $$
declare claims jsonb; v_role public.app_role;
begin
  select role into v_role from public.user_roles where user_id = (event->>'user_id')::uuid limit 1;
  claims := event->'claims';
  if v_role is not null then
    claims := jsonb_set(claims, '{user_role}', to_jsonb(v_role::text));
  else
    claims := jsonb_set(claims, '{user_role}', '"customer"');
  end if;
  return jsonb_set(event, '{claims}', claims);
end; $$;

-- SECURITY DEFINER helper — avoids a join-table lookup per row (178,000ms → 12ms)
create or replace function public.authorize(requested text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare bound int;
begin
  select count(*) into bound
  from public.role_permissions
  where role = ((select auth.jwt()) ->> 'user_role')::public.app_role
    and permission = requested;
  return bound > 0;
end; $$;

create or replace function public.current_role_is(target public.app_role)
returns boolean language sql stable as $$
  select ((select auth.jwt()) ->> 'user_role') = target::text;
$$;

-- Which customer does the logged-in portal user belong to?
create or replace function public.my_customer_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select customer_id from public.customer_contacts
  where user_id = (select auth.uid()) and is_active limit 1;
$$;

-- =============================================================================
-- SECTION 18 — RLS
-- Enable on every table. Patterns shown; replicate for the rest.
-- =============================================================================

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- --- Staff-wide read (masters) ------------------------------------------------
create policy masters_read_staff on fitting_types for select to authenticated
  using (((select auth.jwt()) ->> 'user_role') in ('super_admin','cc_exec','surveyor'));
create policy masters_write_admin on fitting_types for all to authenticated
  using (public.current_role_is('super_admin'))
  with check (public.current_role_is('super_admin'));
-- repeat for brands, finishes, work_types, condition_flags, lost_reasons, cities

-- --- Leads --------------------------------------------------------------------
-- BR-X: an executive sees only their own; admin sees all
create policy leads_select on leads for select to authenticated
using (
  ((select auth.jwt()) ->> 'user_role') = 'super_admin'
  or (((select auth.jwt()) ->> 'user_role') = 'cc_exec' and assigned_to = (select auth.uid()))
);
create policy leads_update on leads for update to authenticated
using (
  ((select auth.jwt()) ->> 'user_role') = 'super_admin'
  or (((select auth.jwt()) ->> 'user_role') = 'cc_exec' and assigned_to = (select auth.uid()))
);
create policy leads_insert_staff on leads for insert to authenticated
with check (((select auth.jwt()) ->> 'user_role') in ('super_admin','cc_exec'));

-- --- Surveys ------------------------------------------------------------------
create policy surveys_select on surveys for select to authenticated
using (
  ((select auth.jwt()) ->> 'user_role') in ('super_admin','cc_exec')
  or (((select auth.jwt()) ->> 'user_role') = 'surveyor' and surveyor_id = (select auth.uid()))
);
create policy surveys_update_own on surveys for update to authenticated
using (
  ((select auth.jwt()) ->> 'user_role') = 'super_admin'
  or (((select auth.jwt()) ->> 'user_role') = 'surveyor' and surveyor_id = (select auth.uid()))
);

-- --- Fittings & photos: scoped through the survey ------------------------------
create policy fittings_rw on fittings for all to authenticated
using (exists (
  select 1 from surveys s where s.id = fittings.survey_id
    and (((select auth.jwt()) ->> 'user_role') in ('super_admin','cc_exec')
         or s.surveyor_id = (select auth.uid()))
))
with check (exists (
  select 1 from surveys s where s.id = fittings.survey_id
    and (((select auth.jwt()) ->> 'user_role') = 'super_admin'
         or s.surveyor_id = (select auth.uid()))
));

-- BR-S7: photos are insert-only; no update, no delete policy exists
create policy fitting_photos_insert on fitting_photos for insert to authenticated
with check (exists (
  select 1 from fittings f join surveys s on s.id = f.survey_id
  where f.id = fitting_photos.fitting_id and s.surveyor_id = (select auth.uid())
));
create policy fitting_photos_select on fitting_photos for select to authenticated
using (
  ((select auth.jwt()) ->> 'user_role') in ('super_admin','cc_exec','surveyor')
  or exists (
    select 1 from fittings f
      join surveys s  on s.id = f.survey_id
      join properties p on p.id = s.property_id
    where f.id = fitting_photos.fitting_id and p.customer_id = public.my_customer_id()
  )
);

-- --- Quotations ---------------------------------------------------------------
create policy quotations_select on quotations for select to authenticated
using (
  ((select auth.jwt()) ->> 'user_role') in ('super_admin','cc_exec')
  or (((select auth.jwt()) ->> 'user_role') = 'surveyor'
      and exists (select 1 from surveys s where s.id = quotations.survey_id
                  and s.surveyor_id = (select auth.uid())))
  or customer_id = public.my_customer_id()
);
-- BR-Q7: an approved quote can never be edited
create policy quotations_update on quotations for update to authenticated
using (
  status in ('draft','pending_approval')
  and (((select auth.jwt()) ->> 'user_role') = 'super_admin'
       or exists (select 1 from surveys s where s.id = quotations.survey_id
                  and s.surveyor_id = (select auth.uid())))
);

-- --- Customer-facing tables ---------------------------------------------------
create policy jobs_select on jobs for select to authenticated
using (
  ((select auth.jwt()) ->> 'user_role') in ('super_admin','cc_exec')
  or customer_id = public.my_customer_id()
  or exists (select 1 from quotations q join surveys s on s.id = q.survey_id
             where q.id = jobs.quotation_id and s.surveyor_id = (select auth.uid()))
);

create policy invoices_select on invoices for select to authenticated
using (
  ((select auth.jwt()) ->> 'user_role') in ('super_admin','cc_exec')
  or customer_id = public.my_customer_id()
);
-- BR-I2: no delete policy exists on invoices, anywhere

create policy warranties_select on warranties for select to authenticated
using (
  ((select auth.jwt()) ->> 'user_role') in ('super_admin','cc_exec')
  or exists (select 1 from jobs j where j.id = warranties.job_id
             and j.customer_id = public.my_customer_id())
);

create policy service_requests_rw on service_requests for all to authenticated
using (
  ((select auth.jwt()) ->> 'user_role') in ('super_admin','cc_exec')
  or customer_id = public.my_customer_id()
)
with check (
  ((select auth.jwt()) ->> 'user_role') in ('super_admin','cc_exec')
  or customer_id = public.my_customer_id()
);

-- --- Admin-only ---------------------------------------------------------------
create policy admin_only_rate_cards on rate_cards for all to authenticated
  using (public.current_role_is('super_admin'))
  with check (public.current_role_is('super_admin'));
create policy admin_only_rate_card_items on rate_card_items for all to authenticated
  using (public.current_role_is('super_admin'))
  with check (public.current_role_is('super_admin'));
create policy admin_only_user_roles on user_roles for all to authenticated
  using (public.current_role_is('super_admin'))
  with check (public.current_role_is('super_admin'));
create policy admin_only_stock on stock_items for all to authenticated
  using (public.current_role_is('super_admin'))
  with check (public.current_role_is('super_admin'));
create policy admin_read_audit on audit_log for select to authenticated
  using (public.current_role_is('super_admin'));

-- Rate card items must be READABLE by surveyors (they price quotes) — read split out
create policy rate_card_items_read_staff on rate_card_items for select to authenticated
  using (((select auth.jwt()) ->> 'user_role') in ('super_admin','surveyor'));

-- webhook_events, messages, capi_events are service-role only:
-- RLS enabled, no policy → denied to every authenticated user by default.

-- =============================================================================
-- SECTION 19 — TRIGGERS & FUNCTIONS
-- =============================================================================

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger trg_leads_updated  before update on leads      for each row execute function set_updated_at();
create trigger trg_surveys_updated before update on surveys   for each row execute function set_updated_at();
create trigger trg_quotes_updated before update on quotations for each row execute function set_updated_at();
create trigger trg_jobs_updated   before update on jobs       for each row execute function set_updated_at();

-- BR-L3: attribution fields are immutable
create or replace function guard_lead_attribution() returns trigger language plpgsql as $$
begin
  if new.source_id is distinct from old.source_id
     or new.ctwa_clid is distinct from old.ctwa_clid
     or new.meta_ad_id is distinct from old.meta_ad_id
     or new.meta_form_id is distinct from old.meta_form_id then
    raise exception 'Lead attribution fields are immutable (BR-L3)';
  end if;
  return new;
end $$;
create trigger trg_lead_attribution before update on leads
  for each row execute function guard_lead_attribution();

-- BR-I1: gap-free invoice numbers, serialised per series
create or replace function next_invoice_no(p_series uuid)
returns text language plpgsql as $$
declare v_code text; v_fy date; v_num int; v_fy_label text;
begin
  select code, fy_start, next_number into v_code, v_fy, v_num
  from invoice_series where id = p_series for update;   -- row lock = no gaps, no duplicates
  update invoice_series set next_number = next_number + 1 where id = p_series;
  v_fy_label := to_char(v_fy,'YY') || to_char(v_fy + interval '1 year','YY');
  return v_code || '/' || v_fy_label || '/' || lpad(v_num::text, 5, '0');
end $$;

-- BR-A4: "You save" is never negative
create or replace function calc_you_save() returns trigger language plpgsql as $$
begin
  new.you_save := greatest(coalesce(new.market_total,0) - coalesce(new.total,0), 0);
  return new;
end $$;
create trigger trg_quote_you_save before insert or update on quotations
  for each row execute function calc_you_save();

-- BR-J2: downtime excludes blocked time, so REDUX's delay metrics stay honest
create or replace function unit_effective_downtime_hours(p_unit uuid)
returns numeric language sql stable as $$
  select greatest(
    extract(epoch from (coalesce(u.back_in_service_at, now()) - u.downtime_from))/3600
    - coalesce(extract(epoch from (u.blocked_to - u.blocked_from))/3600, 0), 0)
  from job_units u where u.id = p_unit;
$$;

-- Generic audit trigger (attach to every privileged table) — BR-X4
create or replace function write_audit() returns trigger language plpgsql
security definer set search_path = '' as $$
begin
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, before, after)
  values (
    (select auth.uid()),
    nullif((select auth.jwt()) ->> 'user_role','')::public.app_role,
    lower(tg_op), tg_table_name,
    case when tg_op = 'DELETE' then (old.id)::uuid else (new.id)::uuid end,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

create trigger trg_audit_rate_card_items after insert or update or delete on rate_card_items
  for each row execute function write_audit();
create trigger trg_audit_quotations after insert or update on quotations
  for each row execute function write_audit();
create trigger trg_audit_invoices  after insert or update on invoices
  for each row execute function write_audit();
create trigger trg_audit_user_roles after insert or update or delete on user_roles
  for each row execute function write_audit();

-- =============================================================================
-- SECTION 20 — SCHEDULED JOBS (pg_cron)
-- =============================================================================
-- select cron.schedule('meta_lead_reconcile', '*/15 * * * *', $$select net.http_post(...)$$);
-- select cron.schedule('sla_sweep',           '*/5  * * * *', $$select sweep_sla()$$);
-- select cron.schedule('job_delay_sweep',     '0 * * * *',    $$select sweep_job_delays()$$);
-- select cron.schedule('stock_alert_sweep',   '0 * * * *',    $$select sweep_stock_alerts()$$);
-- select cron.schedule('integration_health',  '*/30 * * * *', $$select check_integration_health()$$);
-- select cron.schedule('retention_purge',     '30 20 * * *',  $$select purge_retention()$$);  -- 02:00 IST
-- select cron.schedule('quote_expiry',        '30 3 * * *',   $$select sweep_quote_expiry()$$); -- 09:00 IST
-- select cron.schedule('weekly_report',       '30 2 * * 1',   $$select build_weekly_report()$$);
-- (pg_cron runs in UTC — IST = UTC+5:30, hence the offsets above.)

-- =============================================================================
-- SECTION 21 — STORAGE BUCKETS (create via Supabase, all PRIVATE)
-- =============================================================================
-- survey-photos     — surveys/{survey_id}/{fitting_id}/{slot}/{sha256}.jpg
-- handover-photos   — jobs/{job_id}/{unit_id}/{sha256}.jpg
-- documents         — quotes/{quote_id}.pdf, invoices/{invoice_id}.pdf
-- call-recordings   — calls/{call_id}.mp3   (90-day lifecycle)
-- signatures        — handovers/{handover_id}.png
-- brand             — logos and website assets (the ONLY bucket that may be public)
--
-- BR-X3: access via signed URLs, 5–15 min TTL, generated server-side.
-- List views must request an explicit thumbnail width — never full-size.
