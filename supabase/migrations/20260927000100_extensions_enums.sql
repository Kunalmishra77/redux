-- E1-S01 · schema.sql §1 — extensions and enums
-- Forward-only. Never edit an applied migration; add a new one.
--
-- Deviation from schema.sql: "uuid-ossp" is not created (gen_random_uuid() is core since PG 13),
-- and pg_cron / pgmq are enabled in the migration that first uses them (E4), not here.

create extension if not exists pgcrypto with schema extensions;

create type public.app_role        as enum ('super_admin','cc_exec','surveyor','customer');
create type public.lead_status     as enum ('new','contacted','survey_booked','surveyed','quoted','won','lost');
create type public.survey_status   as enum ('scheduled','checked_in','in_progress','submitted','cancelled');
create type public.treatment       as enum ('restore_finish','repair_function','replace_eurobrass','no_action');
create type public.quote_status    as enum ('draft','pending_approval','sent','approved','rejected','expired','superseded');
create type public.job_stage       as enum ('dates_confirmed','removal_pickup','at_eurobrass','quality_check',
                                            'refit_test','handover','warranty_active');
create type public.job_status      as enum ('planned','in_progress','completed','cancelled');
create type public.unit_status     as enum ('scheduled','in_progress','blocked','back_in_service');
create type public.invoice_status  as enum ('draft','issued','part_paid','paid','cancelled');
create type public.payment_status  as enum ('created','captured','failed','refunded');
create type public.stock_move_type as enum ('in','out','consumed','adjusted');
create type public.consent_purpose as enum ('service','marketing','call_recording','photo_marketing');
create type public.webhook_source  as enum ('meta_leadgen','whatsapp','google_ads','razorpay');
create type public.webhook_status  as enum ('pending','processing','done','failed','dead');
create type public.msg_channel     as enum ('whatsapp','sms','email','in_app','push');
create type public.msg_category    as enum ('utility','marketing','authentication','service');
create type public.msg_status      as enum ('queued','sent','delivered','read','failed');
create type public.dsr_type        as enum ('access','correction','erasure','nomination','withdraw_consent');
create type public.dsr_status      as enum ('received','in_progress','completed','rejected');
