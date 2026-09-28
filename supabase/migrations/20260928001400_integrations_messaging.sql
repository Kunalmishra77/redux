-- E4-S01, E4-S12 (DB), E5-S01, S04, S07 (DB), E4-S10 (DB) · schema.sql §15 — webhooks, queues,
-- WhatsApp, notifications, CAPI · ADR-008, ADR-009 · review item 7.
--
-- Deviations from schema.sql (task tracker → Deviations):
--   * Item 7: webhook_events.external_id is the provider's EVENT identity — Razorpay's event id,
--     Google's lead_id — else the SHA-256 of the raw body. The old "wamid / payment.id" keys dropped
--     real events (a message's sent/delivered/read share one wamid; authorized/captured share one
--     payment id). Lead-level dedup stays on leads.meta_leadgen_id / google_lead_id.
--   * Inserting a webhook event enqueues it on pgmq in the same transaction (ADR-009); the worker
--     reports back through webhook_processed() / webhook_failed(), which dead-letters after N.
--   * New whatsapp_messages (the D4-08 inbox needs both directions) and team_notifications (TN*
--     in-app alerts) — schema.sql had nowhere to keep either.
--   * Notifications are enqueued by triggers in the same transaction as the change that causes them
--     (architecture §5), deduplicated by key, and held to 09:00 IST during quiet hours.
--   * pg_cron jobs are defined in install_schedules() but NOT installed by this migration: with no
--     worker running yet, customer messages would pile up and go out days late. Call it when the
--     worker is deployed. Cron work that needs HTTP (Meta reconcile) is a queue message, not pg_net.

create extension if not exists pgmq;
create extension if not exists pg_cron;

do $$
declare q text;
begin
  foreach q in array array['q_webhooks','q_notifications','q_documents','q_capi','q_reports'] loop
    if not exists (select 1 from pgmq.list_queues() where queue_name = q) then
      perform pgmq.create(q);
    end if;
  end loop;
end $$;

insert into public.settings (key, value, description) values
  ('webhook_max_attempts',      '6',  'ADR-008: webhook processing attempts before dead-letter (then TN alert)'),
  ('notification_max_attempts', '3',  'Notifications matrix: 3 attempts with backoff, then failed and surfaced'),
  ('integration_silence_hours', '6',  'D3-07 / TN5: alert when a source has been silent this long'),
  ('quiet_hours_ist',           '{"from":"21:00","to":"09:00"}', 'Notifications matrix: no customer WhatsApp in this window except OTP')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Integrations and webhooks
-- ---------------------------------------------------------------------------
create table public.integration_accounts (
  id            uuid primary key default gen_random_uuid(),
  provider      text not null check (provider in ('meta','whatsapp','google_ads','razorpay','msg91')),
  external_id   text,                                   -- page_id / waba_id / customer_id
  display_name  text,
  config        jsonb not null default '{}'::jsonb,     -- NO SECRETS — those live in env
  is_active     boolean not null default true,
  last_event_at timestamptz,                            -- D3-07 health screen
  unique nulls not distinct (provider, external_id)
);

create table public.webhook_events (
  id              uuid primary key default gen_random_uuid(),
  source          public.webhook_source not null,
  external_id     text not null,                        -- provider event id, else sha256(raw body)
  event_type      text,                                 -- 'leadgen', 'messages', 'payment.captured', …
  payload         jsonb not null,
  signature_ok    boolean not null,
  status          public.webhook_status not null default 'pending',
  retry_count     int not null default 0,
  last_error      text,
  received_at     timestamptz not null default now(),
  processed_at    timestamptz,
  unique (source, external_id)
);
create index webhook_events_status_idx on public.webhook_events (status, received_at) where status in ('pending','failed','dead');
create index webhook_events_source_received_idx on public.webhook_events (source, received_at desc);

-- Meta custom lead-form questions are auto-slugged and change if the marketer edits them
create table public.lead_form_field_map (
  id         uuid primary key default gen_random_uuid(),
  provider   text not null check (provider in ('meta','google_ads')),
  form_id    text not null,
  field_name text not null,                             -- as received
  maps_to    text not null,                             -- leads column or 'meta.<key>'
  unique (provider, form_id, field_name)
);

create table public.whatsapp_conversations (
  id                   uuid primary key default gen_random_uuid(),
  wa_id                text not null unique,            -- customer phone as WhatsApp gives it
  lead_id              uuid references public.leads(id),
  customer_id          uuid references public.customers(id),
  profile_name         text,
  -- CTWA attribution from the referral object — cannot be backfilled
  referral_source_id   text,
  referral_source_type text,
  ctwa_clid            text,
  window_expires_at    timestamptz,                     -- the 24-hour service window (D4-08)
  last_message_at      timestamptz,
  created_at           timestamptz not null default now()
);
create index whatsapp_conversations_lead_id_idx on public.whatsapp_conversations (lead_id);
create index whatsapp_conversations_customer_id_idx on public.whatsapp_conversations (customer_id);

-- D4-08 inbox: both directions, keyed by wamid
create table public.whatsapp_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.whatsapp_conversations(id),
  wamid           text unique,
  direction       text not null check (direction in ('inbound','outbound')),
  kind            text not null default 'text',          -- text | template | image | document | …
  body            text,
  template_code   text,
  media           jsonb,
  status          text,                                  -- sent | delivered | read | failed (outbound)
  sent_by         uuid references auth.users(id),        -- the executive, for free-text replies
  occurred_at     timestamptz not null default now()
);
create index whatsapp_messages_conversation_idx on public.whatsapp_messages (conversation_id, occurred_at desc);

create table public.message_templates (
  id                     uuid primary key default gen_random_uuid(),
  code                   text not null unique,          -- 'survey_booked'
  channel                public.msg_channel not null,
  category               public.msg_category not null,  -- utility vs marketing: 7.5x cost
  provider_template_name text,
  dlt_template_id        text,
  language               text not null default 'en',
  body                   text not null,
  variables              jsonb not null default '[]'::jsonb,
  is_active              boolean not null default true,
  approved_at            timestamptz
);

-- D16-05: which trigger sends what, toggleable. Seeded from the notifications matrix.
create table public.notification_rules (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,                    -- 'CN2', 'TN13'
  trigger_event text not null,
  template_code text,                                    -- message_templates.code, once approved
  channel       public.msg_channel not null,
  category      public.msg_category,
  audience      text not null check (audience in ('customer','assigned_cc','cc_queue','admin','surveyor','admin_and_cc','admin_and_surveyor')),
  is_active     boolean not null default true,
  quiet_hours   boolean not null default true
);

insert into public.notification_rules (code, trigger_event, template_code, channel, category, audience, quiet_hours) values
  ('CN1',  'lead_created',            'enquiry_received',  'whatsapp', 'utility',        'customer', true),
  ('CN2',  'survey_booked',           'survey_booked',     'whatsapp', 'utility',        'customer', true),
  ('CN3',  'survey_reminder',         'survey_reminder',   'whatsapp', 'utility',        'customer', true),
  ('CN4',  'surveyor_on_way',         'surveyor_on_way',   'whatsapp', 'utility',        'customer', true),
  ('CN5',  'quote_shared',            'quote_shared',      'whatsapp', 'utility',        'customer', true),
  ('CN6',  'approval_otp',            'approval_otp',      'whatsapp', 'authentication', 'customer', false),
  ('CN7',  'quote_approved',          'quote_approved',    'whatsapp', 'utility',        'customer', true),
  ('CN8',  'quote_expiring',          'quote_expiring',    'whatsapp', 'utility',        'customer', true),
  ('CN9',  'dates_confirmed',         'dates_confirmed',   'whatsapp', 'utility',        'customer', true),
  ('CN10', 'job_stage_changed',       'job_update',        'whatsapp', 'utility',        'customer', true),
  ('CN11', 'handover_complete',       'handover_complete', 'whatsapp', 'utility',        'customer', true),
  ('CN12', 'invoice_raised',          'invoice_raised',    'whatsapp', 'utility',        'customer', true),
  ('CN13', 'payment_received',        'payment_received',  'whatsapp', 'utility',        'customer', true),
  ('CN14', 'payment_overdue',         'payment_overdue',   'whatsapp', 'utility',        'customer', true),
  ('CN15', 'login_otp',               'login_otp',         'whatsapp', 'authentication', 'customer', false),
  ('CN16', 'service_ack',             'service_ack',       'whatsapp', 'utility',        'customer', true),
  ('CN17', 'feedback_request',        'feedback_request',  'whatsapp', 'utility',        'customer', true),
  ('CN18', 'warranty_expiring',       'warranty_expiring', 'whatsapp', 'utility',        'customer', true),
  ('TN1',  'lead_assigned',           null, 'in_app', null, 'assigned_cc',        false),
  ('TN2',  'sla_due',                 null, 'in_app', null, 'assigned_cc',        false),
  ('TN3',  'sla_breached',            null, 'in_app', null, 'admin_and_cc',       false),
  ('TN4',  'follow_up_due',           null, 'in_app', null, 'assigned_cc',        false),
  ('TN5',  'integration_silent',      null, 'email',  null, 'admin',              false),
  ('TN6',  'survey_booked_surveyor',  null, 'push',   null, 'surveyor',           false),
  ('TN7',  'survey_changed',          null, 'push',   null, 'surveyor',           false),
  ('TN8',  'discount_needs_approval', null, 'in_app', null, 'admin',              false),
  ('TN9',  'quote_approved_team',     null, 'in_app', null, 'admin_and_surveyor', false),
  ('TN10', 'job_running_late',        null, 'in_app', null, 'admin',              false),
  ('TN11', 'surveyor_data_unsynced',  null, 'email',  null, 'admin',              false),
  ('TN12', 'service_request_raised',  null, 'in_app', null, 'cc_queue',           false),
  ('TN13', 'stock_below_minimum',     null, 'in_app', null, 'admin',              false),
  ('TN14', 'payment_event',           null, 'in_app', null, 'admin',              false),
  ('TN15', 'weekly_summary',          null, 'email',  null, 'admin',              false)
on conflict (code) do nothing;

-- Outbound customer messages (WhatsApp / SMS / email). The worker drains q_notifications.
create table public.messages (
  id                  uuid primary key default gen_random_uuid(),
  rule_code           text,
  template_code       text,
  channel             public.msg_channel not null,
  category            public.msg_category,
  to_address          text not null,
  lead_id             uuid references public.leads(id),
  customer_id         uuid references public.customers(id),
  entity_type         text,
  entity_id           uuid,
  variables           jsonb not null default '{}'::jsonb,
  body                text,
  status              public.msg_status not null default 'queued',
  send_after          timestamptz not null default now(),   -- quiet hours
  attempts            int not null default 0,
  provider_message_id text,
  error               text,
  cost_inr            numeric(10,4),                         -- messaging cost per job
  dedup_key           text unique,                           -- trigger + entity (+ window)
  queued_at           timestamptz not null default now(),
  sent_at             timestamptz,
  delivered_at        timestamptz
);
create index messages_lead_id_idx     on public.messages (lead_id);
create index messages_customer_id_idx on public.messages (customer_id);
create index messages_status_idx      on public.messages (status, send_after) where status in ('queued','failed');

-- In-app team alerts (TN*)
create table public.team_notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id),
  rule_code   text not null,
  title       text not null,
  body        text,
  entity_type text,
  entity_id   uuid,
  dedup_key   text,
  read_at     timestamptz,
  created_at  timestamptz not null default now(),
  unique (user_id, dedup_key)
);
create index team_notifications_user_idx on public.team_notifications (user_id, created_at desc) where read_at is null;

-- Meta Conversions API — ads optimise on booked surveys and won jobs (D3-06)
create table public.capi_events (
  id         uuid primary key default gen_random_uuid(),
  event_name text not null check (event_name in ('survey_booked','job_won')),
  lead_id    uuid not null references public.leads(id),
  ctwa_clid  text,
  value      numeric(12,2),
  currency   text not null default 'INR',
  status     text not null default 'pending' check (status in ('pending','sent','failed')),
  sent_at    timestamptz,
  response   jsonb,
  created_at timestamptz not null default now(),
  unique (event_name, lead_id)                            -- each fires once per lead
);
create index capi_events_status_idx on public.capi_events (status) where status <> 'sent';

alter table public.integration_accounts   enable row level security;
alter table public.webhook_events         enable row level security;
alter table public.lead_form_field_map    enable row level security;
alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages      enable row level security;
alter table public.message_templates      enable row level security;
alter table public.notification_rules     enable row level security;
alter table public.messages               enable row level security;
alter table public.team_notifications     enable row level security;
alter table public.capi_events            enable row level security;

create trigger trg_audit_notification_rules after update on public.notification_rules
  for each row execute function public.write_audit();
create trigger trg_audit_message_templates after insert or update on public.message_templates
  for each row execute function public.write_audit();

-- ---------------------------------------------------------------------------
-- Webhooks (ADR-008): the route handler verifies the raw body, then calls record_webhook()
-- and returns 200. Duplicates are a no-op. Returns {id, duplicate}.
-- ---------------------------------------------------------------------------
create or replace function public.record_webhook(p_source public.webhook_source, p_external_id text,
                                                 p_event_type text, p_payload jsonb, p_signature_ok boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.is_system_caller() then
    raise exception 'Webhooks are recorded by the server only' using errcode = '42501';
  end if;
  insert into public.webhook_events (source, external_id, event_type, payload, signature_ok, status)
  values (p_source, p_external_id, p_event_type, p_payload, p_signature_ok,
          case when p_signature_ok then 'pending' else 'dead' end::public.webhook_status)
  on conflict (source, external_id) do nothing
  returning id into v_id;

  if v_id is null then
    return jsonb_build_object('id', (select id from public.webhook_events where source = p_source and external_id = p_external_id),
                              'duplicate', true);
  end if;

  if p_signature_ok then
    perform pgmq.send('q_webhooks', jsonb_build_object('webhook_event_id', v_id));   -- same transaction (ADR-009)
    update public.integration_accounts set last_event_at = now()
    where provider = case p_source when 'meta_leadgen' then 'meta' else p_source::text end;
  end if;
  return jsonb_build_object('id', v_id, 'duplicate', false);
end $$;
revoke execute on function public.record_webhook(public.webhook_source, text, text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.record_webhook(public.webhook_source, text, text, jsonb, boolean) to service_role;

create or replace function public.webhook_processed(p_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.webhook_events set status = 'done', processed_at = now(), last_error = null where id = p_id;
$$;
revoke execute on function public.webhook_processed(uuid) from public, anon, authenticated;
grant execute on function public.webhook_processed(uuid) to service_role;

-- D3-03: retry with backoff, then dead-letter with an admin alert
create or replace function public.webhook_failed(p_id uuid, p_error text)
returns public.webhook_status language plpgsql security definer set search_path = '' as $$
declare
  v_max int := coalesce((select (value #>> '{}')::int from public.settings where key = 'webhook_max_attempts'), 6);
  e     public.webhook_events%rowtype;
begin
  update public.webhook_events set retry_count = retry_count + 1, last_error = left(p_error, 2000),
    status = case when retry_count + 1 >= v_max then 'dead' else 'failed' end::public.webhook_status
  where id = p_id returning * into e;
  if e.status = 'failed' then
    -- exponential backoff: 30 s, 60 s, 120 s, … capped at 30 min
    perform pgmq.send('q_webhooks', jsonb_build_object('webhook_event_id', p_id), least(30 * power(2, e.retry_count - 1)::int, 1800));
  else
    perform public.notify_team('TN5', 'Webhook dead-lettered', e.source || ' event ' || e.external_id || ': ' || left(p_error, 200),
                               'webhook_events', p_id, 'dead:' || p_id);
  end if;
  return e.status;
end $$;
revoke execute on function public.webhook_failed(uuid, text) from public, anon, authenticated;
grant execute on function public.webhook_failed(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
-- The next moment a customer WhatsApp may go out (quiet hours 21:00–09:00 IST)
create or replace function public.next_send_time(p_at timestamptz)
returns timestamptz language sql stable set search_path = '' as $$
  select case
    when (p_at at time zone 'Asia/Kolkata')::time >= '21:00' then
      (((p_at at time zone 'Asia/Kolkata')::date + 1) + time '09:00') at time zone 'Asia/Kolkata'
    when (p_at at time zone 'Asia/Kolkata')::time < '09:00' then
      ((p_at at time zone 'Asia/Kolkata')::date + time '09:00') at time zone 'Asia/Kolkata'
    else p_at end;
$$;

-- TN*: one in-app row per recipient, deduplicated. Audience from the rule.
create or replace function public.notify_team(p_rule text, p_title text, p_body text,
                                              p_entity_type text, p_entity_id uuid, p_dedup text,
                                              p_user uuid default null)
returns int language plpgsql security definer set search_path = '' as $$
declare
  r       public.notification_rules%rowtype;
  v_count int;
begin
  select * into r from public.notification_rules where code = p_rule;
  if not found or not r.is_active then return 0; end if;

  insert into public.team_notifications (user_id, rule_code, title, body, entity_type, entity_id, dedup_key)
  select u, p_rule, p_title, p_body, p_entity_type, p_entity_id, p_dedup
  from (
    select p_user as u where p_user is not null and r.audience in ('assigned_cc','surveyor','admin_and_cc','admin_and_surveyor')
    union
    select ur.user_id from public.user_roles ur join public.profiles pr on pr.id = ur.user_id and pr.is_active
    where (ur.role = 'super_admin' and r.audience in ('admin','admin_and_cc','admin_and_surveyor'))
       or (ur.role = 'cc_exec' and r.audience = 'cc_queue')
  ) recipients
  where u is not null
  on conflict (user_id, dedup_key) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke execute on function public.notify_team(text, text, text, text, uuid, text, uuid) from public, anon, authenticated;

-- CN*: queue one customer message (rule active, dedup, quiet hours) and hand it to the worker.
create or replace function public.notify_customer(p_rule text, p_to text, p_lead uuid, p_customer uuid,
                                                  p_entity_type text, p_entity_id uuid, p_variables jsonb,
                                                  p_dedup text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  r      public.notification_rules%rowtype;
  v_id   uuid;
  v_when timestamptz;
begin
  select * into r from public.notification_rules where code = p_rule;
  if not found or not r.is_active or p_to is null then return null; end if;
  v_when := case when r.quiet_hours then public.next_send_time(now()) else now() end;

  insert into public.messages (rule_code, template_code, channel, category, to_address, lead_id, customer_id,
                               entity_type, entity_id, variables, send_after, dedup_key)
  values (p_rule, r.template_code, r.channel, r.category, p_to, p_lead, p_customer,
          p_entity_type, p_entity_id, coalesce(p_variables, '{}'::jsonb), v_when, p_dedup)
  on conflict (dedup_key) do nothing
  returning id into v_id;

  if v_id is not null then
    perform pgmq.send('q_notifications', jsonb_build_object('message_id', v_id),
                      greatest(0, extract(epoch from (v_when - now()))::int));
  end if;
  return v_id;
end $$;
revoke execute on function public.notify_customer(text, text, uuid, uuid, text, uuid, jsonb, text) from public, anon, authenticated;

-- D3-06: fire each conversion once per lead
create or replace function public.enqueue_capi(p_event text, p_lead uuid, p_value numeric default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into public.capi_events (event_name, lead_id, ctwa_clid, value)
  select p_event, l.id, l.ctwa_clid, p_value from public.leads l where l.id = p_lead
  on conflict (event_name, lead_id) do nothing
  returning id into v_id;
  if v_id is not null then
    perform pgmq.send('q_capi', jsonb_build_object('capi_event_id', v_id));
  end if;
end $$;
revoke execute on function public.enqueue_capi(text, uuid, numeric) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Triggers: enqueue in the same transaction as the change (architecture §5)
-- ---------------------------------------------------------------------------
-- CN1 + TN1: a new lead is acknowledged and its executive told
create or replace function public.on_lead_created() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify_customer('CN1', new.phone, new.id, null, 'leads', new.id,
                                 jsonb_build_object('name', new.name), 'CN1:' || new.id);
  if new.assigned_to is not null then
    perform public.notify_team('TN1', 'New lead assigned', coalesce(new.name, new.phone), 'leads', new.id,
                               'TN1:' || new.id || ':' || new.assigned_to, new.assigned_to);
  end if;
  return null;
end $$;
create trigger trg_lead_created_notify after insert on public.leads
  for each row execute function public.on_lead_created();

-- TN1 on reassignment
create or replace function public.on_lead_reassigned() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.assigned_to is not null then
    perform public.notify_team('TN1', 'Lead reassigned to you', coalesce(new.name, new.phone), 'leads', new.id,
                               'TN1:' || new.id || ':' || new.assigned_to, new.assigned_to);
  end if;
  return null;
end $$;
create trigger trg_lead_reassigned_notify after update of assigned_to on public.leads
  for each row when (old.assigned_to is distinct from new.assigned_to)
  execute function public.on_lead_reassigned();

-- CN2 + TN6 + CAPI survey_booked
create or replace function public.on_survey_booked() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_phone text; v_surveyor text;
begin
  select phone into v_phone from public.leads where id = new.lead_id;
  select full_name into v_surveyor from public.profiles where id = new.surveyor_id;
  perform public.notify_customer('CN2', v_phone, new.lead_id, null, 'surveys', new.id,
    jsonb_build_object('date', to_char(new.scheduled_at at time zone 'Asia/Kolkata', 'DD Mon YYYY'),
                       'slot', to_char(new.scheduled_at at time zone 'Asia/Kolkata', 'HH24:MI') || '–' ||
                               to_char(new.slot_end_at at time zone 'Asia/Kolkata', 'HH24:MI'),
                       'surveyor', v_surveyor),
    'CN2:' || new.id);
  perform public.notify_team('TN6', 'New survey booked', to_char(new.scheduled_at at time zone 'Asia/Kolkata', 'DD Mon HH24:MI'),
                             'surveys', new.id, 'TN6:' || new.id, new.surveyor_id);
  if new.lead_id is not null then
    perform public.enqueue_capi('survey_booked', new.lead_id);
  end if;
  return null;
end $$;
create trigger trg_survey_booked_notify after insert on public.surveys
  for each row execute function public.on_survey_booked();

-- CN7 + TN9 + CAPI job_won when a quote is approved
create or replace function public.on_quote_approved() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_phone text; v_surveyor uuid;
begin
  select phone into v_phone from public.customer_contacts
  where customer_id = new.customer_id and is_active order by is_primary desc limit 1;
  select surveyor_id into v_surveyor from public.surveys where id = new.survey_id;
  perform public.notify_customer('CN7', v_phone, new.lead_id, new.customer_id, 'quotations', new.id,
                                 jsonb_build_object('quote_no', new.quote_no, 'total', new.total), 'CN7:' || new.id);
  perform public.notify_team('TN9', 'Quote approved', new.quote_no || ' v' || new.version, 'quotations', new.id,
                             'TN9:' || new.id, v_surveyor);
  if new.lead_id is not null then
    perform public.enqueue_capi('job_won', new.lead_id, new.total);
  end if;
  return null;
end $$;
create trigger trg_quote_approved_notify after update of status on public.quotations
  for each row when (new.status = 'approved' and old.status is distinct from 'approved')
  execute function public.on_quote_approved();

-- TN8: a discount waits for super_admin
create or replace function public.on_discount_requested() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify_team('TN8', 'Discount needs approval', new.requested_pct || '% — ' || new.reason,
                             'discount_approvals', new.id, 'TN8:' || new.id);
  return null;
end $$;
create trigger trg_discount_requested_notify after insert on public.discount_approvals
  for each row execute function public.on_discount_requested();

-- TN12: service request into the care queue
create or replace function public.on_service_request_raised() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify_team('TN12', 'Service request ' || new.request_no, new.subject,
                             'service_requests', new.id, 'TN12:' || new.id);
  return null;
end $$;
create trigger trg_service_request_notify after insert on public.service_requests
  for each row execute function public.on_service_request_raised();

-- TN13: drains the stock_alerts outbox (BR-ST3 already guarantees once per crossing)
create or replace function public.on_stock_alert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify_team('TN13', 'Stock below minimum',
    (select name || ': ' || new.quantity || ' ' || uom || ' (minimum ' || new.min_level || ')' from public.stock_items where id = new.item_id),
    'stock_items', new.item_id, 'TN13:' || new.id);
  update public.stock_alerts set notified_at = now() where id = new.id;
  return null;
end $$;
create trigger trg_stock_alert_notify after insert on public.stock_alerts
  for each row execute function public.on_stock_alert();

-- ---------------------------------------------------------------------------
-- Sweeps (pg_cron, once installed)
-- ---------------------------------------------------------------------------
-- TN3 breach (once per lead) and TN4 follow-ups due (once per follow-up)
create or replace function public.sweep_sla()
returns int language plpgsql security definer set search_path = '' as $$
declare l record; f record; v_n int := 0;
begin
  for l in select id, name, phone, assigned_to from public.leads
           where status = 'new' and sla_due_at < now() loop
    v_n := v_n + public.notify_team('TN3', 'Call-back SLA breached', coalesce(l.name, l.phone), 'leads', l.id,
                                    'TN3:' || l.id, l.assigned_to);
  end loop;
  for f in select fu.id, fu.lead_id, fu.assigned_to, fu.note from public.follow_ups fu
           where fu.completed_at is null and fu.due_at <= now() loop
    v_n := v_n + public.notify_team('TN4', 'Follow-up due', f.note, 'leads', f.lead_id, 'TN4:' || f.id, f.assigned_to);
  end loop;
  return v_n;
end $$;

-- TN10: units past planned downtime (v_delayed_units already ignores blocked units)
create or replace function public.sweep_job_delays()
returns int language plpgsql security definer set search_path = '' as $$
declare d record; v_n int := 0;
begin
  for d in select job_unit_id, job_id, effective_downtime_hours, planned_downtime_hours from public.v_delayed_units loop
    v_n := v_n + public.notify_team('TN10', 'Room running late',
      d.effective_downtime_hours || ' h out of service against ' || d.planned_downtime_hours || ' h planned',
      'job_units', d.job_unit_id, 'TN10:' || d.job_unit_id || ':' || (now() at time zone 'Asia/Kolkata')::date);
  end loop;
  return v_n;
end $$;

-- TN5 / D3-07: a source silent longer than the threshold (only once it has ever been heard from)
create or replace function public.check_integration_health()
returns int language plpgsql security definer set search_path = '' as $$
declare a record; v_n int := 0;
  v_hours int := coalesce((select (value #>> '{}')::int from public.settings where key = 'integration_silence_hours'), 6);
begin
  for a in select id, provider, display_name, last_event_at from public.integration_accounts
           where is_active and last_event_at is not null and last_event_at < now() - make_interval(hours => v_hours) loop
    v_n := v_n + public.notify_team('TN5', 'Integration silent: ' || a.provider,
      coalesce(a.display_name, a.provider) || ' — nothing received for ' || v_hours || '+ hours',
      'integration_accounts', a.id, 'TN5:' || a.id || ':' || to_char(a.last_event_at, 'YYYYMMDDHH24MI'));
  end loop;
  return v_n;
end $$;

-- D3-04: the 15-minute Meta reconciliation is HTTP work → a queue message for the worker
create or replace function public.enqueue_meta_reconcile()
returns void language sql security definer set search_path = '' as $$
  select pgmq.send('q_webhooks', jsonb_build_object('task', 'meta_reconcile', 'since', now() - interval '1 hour'));
$$;

revoke execute on function public.sweep_sla() from public, anon, authenticated;
revoke execute on function public.sweep_job_delays() from public, anon, authenticated;
revoke execute on function public.check_integration_health() from public, anon, authenticated;
revoke execute on function public.enqueue_meta_reconcile() from public, anon, authenticated;

-- Architecture §5 schedules. Call once when the queue worker is deployed (not in this migration).
create or replace function public.install_schedules()
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform cron.schedule('meta_lead_reconcile', '*/15 * * * *', 'select public.enqueue_meta_reconcile()');
  perform cron.schedule('sla_sweep',           '*/5 * * * *',  'select public.sweep_sla()');
  perform cron.schedule('job_delay_sweep',     '0 * * * *',    'select public.sweep_job_delays()');
  perform cron.schedule('integration_health',  '*/30 * * * *', 'select public.check_integration_health()');
  perform cron.schedule('quote_expiry',        '30 3 * * *',   'select public.expire_quotes()');     -- 09:00 IST
end $$;
revoke execute on function public.install_schedules() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Policies (ADR-004). webhook_events, messages, capi_events: service role only — RLS on, no
-- policy (auth doc §4: a CRM leak must not also leak raw payloads).
-- ---------------------------------------------------------------------------
create policy integration_accounts_admin on public.integration_accounts for all to authenticated
  using ((select public.current_role_is('super_admin')))
  with check ((select public.current_role_is('super_admin')));
create policy lead_form_field_map_admin on public.lead_form_field_map for all to authenticated
  using ((select public.current_role_is('super_admin')))
  with check ((select public.current_role_is('super_admin')));
create policy message_templates_read_staff on public.message_templates for select to authenticated
  using ((select public.is_staff()));
create policy message_templates_admin on public.message_templates for all to authenticated
  using ((select public.current_role_is('super_admin')))
  with check ((select public.current_role_is('super_admin')));
create policy notification_rules_admin on public.notification_rules for all to authenticated
  using ((select public.current_role_is('super_admin')))
  with check ((select public.current_role_is('super_admin')));

-- D4-08: the inbox follows the lead — an executive sees the conversations of their own leads
create policy whatsapp_conversations_select on public.whatsapp_conversations for select to authenticated
using (
  (select public.current_role_is('super_admin'))
  or ((select public.current_role_is('cc_exec')) and exists (select 1 from public.leads l where l.id = whatsapp_conversations.lead_id))
);
create policy whatsapp_messages_select on public.whatsapp_messages for select to authenticated
  using (exists (select 1 from public.whatsapp_conversations c where c.id = whatsapp_messages.conversation_id));

-- Everyone reads and dismisses their own alerts; nothing else
create policy team_notifications_own on public.team_notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy team_notifications_mark_read on public.team_notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
