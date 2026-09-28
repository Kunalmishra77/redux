-- E11-S01, S03, S13, S14, S15 (+ S08 request half) · schema.sql §10 — quotations
-- BR-Q1…Q5, Q7 · BR-A1, A4, A6 · review items 3 and 12.
-- BR-Q6 (approval creates customer + job atomically) lives with §11 jobs: verify_quote_otp().
--
-- Deviations from schema.sql (task tracker → Deviations):
--   * Versions share one quote number: unique (quote_no, version), not unique (quote_no).
--   * State changes go through SECURITY DEFINER functions (item 3); a trigger enforces BR-Q2/Q7 —
--     after 'sent' only the status may move, along allowed transitions, and approved is final.
--   * Lines carry their own taxable value and CGST/SGST/IGST, so a quote reproduces exactly.
--   * Place of supply = the PROPERTY's state (GST: services on immovable property), vs supplier
--     state in settings. 07 = Delhi, from REDUX's Okhla address.
--   * Issue is two steps: freeze_quote_for_issue() fixes dates + terms so the PDF can be rendered
--     from final values; mark_quote_sent() records the PDF hash. Any change unfreezes.
--   * quote_otps holds the OTP lifecycle (BR-Q5); only hashes, never codes.
--   * Customers never see drafts or quotes awaiting discount approval (item 12).

insert into public.settings (key, value, description) values
  ('supplier_state_code',      '"07"', 'GST state code of REDUX (Okhla, New Delhi) — decides CGST+SGST vs IGST'),
  ('warranty_terms',           'null', 'D10-05 / A10: {"version","text","mechanical_days","finish_days"} — REDUX to supply; quotes cannot issue until set'),
  ('otp_expiry_minutes',       '10',   'BR-Q5'),
  ('otp_max_attempts',         '5',    'BR-Q5'),
  ('otp_max_per_hour',         '3',    'Auth doc §1: OTP rate limit per phone')
on conflict (key) do nothing;

create sequence public.quote_no_seq;

-- audit_log.actor_id pointed at profiles, but portal customers have no profile: any audited action
-- a customer takes (approving a quote, raising a service request) would fail the foreign key.
-- The actor is any authenticated user.
alter table public.audit_log drop constraint audit_log_actor_id_fkey;
alter table public.audit_log add constraint audit_log_actor_id_fkey
  foreign key (actor_id) references auth.users(id);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.quotations (
  id              uuid primary key default gen_random_uuid(),
  quote_no        text not null,                        -- Q-2026-0148, shared by its versions
  version         int  not null default 1 check (version > 0),
  supersedes_id   uuid references public.quotations(id),
  survey_id       uuid not null references public.surveys(id),
  lead_id         uuid references public.leads(id),
  customer_id     uuid not null references public.customers(id),
  property_id     uuid not null references public.properties(id),
  rate_card_id    uuid not null references public.rate_cards(id),

  status          public.quote_status not null default 'draft',
  issued_at       timestamptz,
  valid_until     date,                                  -- BR-Q1: issue date (IST) + 15 days

  subtotal        numeric(12,2) not null default 0,
  discount_pct    numeric(5,2)  not null default 0 check (discount_pct between 0 and 100),
  discount_amount numeric(12,2) not null default 0,
  taxable_value   numeric(12,2) not null default 0,
  cgst            numeric(12,2) not null default 0,
  sgst            numeric(12,2) not null default 0,
  igst            numeric(12,2) not null default 0,
  total           numeric(12,2) not null default 0,
  market_total    numeric(12,2) not null default 0,
  you_save        numeric(12,2) not null default 0 check (you_save >= 0),   -- BR-A4
  supplier_state_code        text,
  place_of_supply_state_code text,

  -- BR-Q3: terms snapshotted at issue, never re-read from master
  terms_text      text,
  terms_version   text,
  warranty_mechanical_days int,
  warranty_finish_days     int,

  pdf_path        text,
  pdf_sha256      text check (pdf_sha256 is null or pdf_sha256 ~ '^[0-9a-f]{64}$'),

  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (quote_no, version),
  constraint quote_sent_is_complete check (
    status in ('draft','pending_approval')
    or (issued_at is not null and valid_until is not null and terms_text is not null and pdf_sha256 is not null))
);
create index quotations_survey_id_idx   on public.quotations (survey_id);
create index quotations_lead_id_idx     on public.quotations (lead_id);
create index quotations_customer_id_idx on public.quotations (customer_id);
create index quotations_property_id_idx on public.quotations (property_id);
create index quotations_status_idx      on public.quotations (status);
create index quotations_supersedes_idx  on public.quotations (supersedes_id);
create index quotations_valid_until_idx on public.quotations (valid_until) where status = 'sent';
create trigger trg_quotations_updated before update on public.quotations
  for each row execute function public.set_updated_at();
create trigger trg_audit_quotations after insert or update on public.quotations
  for each row execute function public.write_audit();

create table public.quotation_lines (
  id                      uuid primary key default gen_random_uuid(),
  quotation_id            uuid not null references public.quotations(id),
  fitting_id              uuid references public.fittings(id),
  assessment_id           uuid references public.assessments(id),
  unit_label              text,
  description             text not null,
  work_type_id            uuid references public.work_types(id),
  finish_id               uuid references public.finishes(id),
  qty                     numeric(10,2) not null default 1 check (qty > 0),
  unit_price              numeric(12,2) not null check (unit_price >= 0),
  line_total              numeric(12,2) not null,
  price_replace_eurobrass numeric(12,2),                 -- D8-02: the alternatives on the quote
  market_price            numeric(12,2) not null default 0,
  gst_rate                numeric(5,2)  not null,
  hsn_sac                 text,
  taxable_value           numeric(12,2) not null default 0,   -- after the quote-level discount
  cgst                    numeric(12,2) not null default 0,
  sgst                    numeric(12,2) not null default 0,
  igst                    numeric(12,2) not null default 0,
  sort_order              int not null default 0
);
create index quotation_lines_quotation_id_idx on public.quotation_lines (quotation_id);

-- BR-Q4 / compliance §6 — append-only evidence for IT Act s.65B / BSA s.63. Written by
-- verify_quote_otp() (§11); never updated, never deleted.
create table public.quote_approvals (
  id                 uuid primary key default gen_random_uuid(),
  quotation_id       uuid not null references public.quotations(id),
  quotation_version  int not null,
  pdf_sha256         text not null,
  approver_name      text not null,
  approver_phone     text not null,
  otp_hash           text not null,                     -- never plaintext
  otp_generated_at   timestamptz not null,
  otp_delivered_at   timestamptz,
  otp_verified_at    timestamptz not null,              -- server clock
  delivery_channel   public.msg_channel not null,
  gateway_message_id text,
  dlt_template_id    text,
  attempt_count      int not null default 1,
  failed_attempts    int not null default 0,
  ip_address         inet,
  user_agent         text,
  geolocation        jsonb,
  terms_text         text not null,
  created_at         timestamptz not null default now()
);
create index quote_approvals_quotation_id_idx on public.quote_approvals (quotation_id);

create table public.discount_approvals (
  id            uuid primary key default gen_random_uuid(),
  quotation_id  uuid not null references public.quotations(id),
  requested_by  uuid not null references public.profiles(id),
  requested_pct numeric(5,2) not null,
  reason        text not null check (length(trim(reason)) > 0),
  decided_by    uuid references public.profiles(id),
  decision      text check (decision in ('approved','rejected')),
  decision_note text,
  requested_at  timestamptz not null default now(),
  decided_at    timestamptz
);
create index discount_approvals_quotation_id_idx on public.discount_approvals (quotation_id);
create index discount_approvals_requested_by_idx on public.discount_approvals (requested_by);
create index discount_approvals_pending_idx on public.discount_approvals (requested_at) where decision is null;

-- BR-Q5: the OTP lifecycle. Hash only (salted with the row id).
create table public.quote_otps (
  id                 uuid primary key default gen_random_uuid(),
  quotation_id       uuid not null references public.quotations(id),
  phone              text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  channel            public.msg_channel not null,
  otp_hash           text not null,
  generated_at       timestamptz not null default now(),
  expires_at         timestamptz not null,
  delivered_at       timestamptz,
  gateway_message_id text,
  dlt_template_id    text,
  attempts           int not null default 0,
  failed_attempts    int not null default 0,
  verified_at        timestamptz,
  locked_at          timestamptz
);
create index quote_otps_quotation_id_idx on public.quote_otps (quotation_id);
create index quote_otps_phone_idx        on public.quote_otps (phone, generated_at desc);

alter table public.quotations         enable row level security;
alter table public.quotation_lines    enable row level security;
alter table public.quote_approvals    enable row level security;
alter table public.discount_approvals enable row level security;
alter table public.quote_otps         enable row level security;

-- ---------------------------------------------------------------------------
-- Immutability (BR-Q2, BR-Q7, rule 9)
-- ---------------------------------------------------------------------------
create or replace function public.guard_quotation() returns trigger
language plpgsql set search_path = '' as $$
declare v_ok_transition boolean;
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'Quote % v% is %; it can be superseded, never deleted (BR-Q2)', old.quote_no, old.version, old.status
        using errcode = '42501';
    end if;
    return old;
  end if;

  if old.status in ('draft','pending_approval') then
    return new;                                   -- drafts are editable (through the functions)
  end if;

  v_ok_transition := (old.status = 'sent'     and new.status in ('approved','rejected','expired','superseded'))
                  or (old.status = 'expired'  and new.status = 'superseded')
                  or (old.status = 'rejected' and new.status = 'superseded');

  if current_user = 'authenticated'
     or not v_ok_transition
     or (to_jsonb(new) - array['status','updated_at']) is distinct from (to_jsonb(old) - array['status','updated_at']) then
    raise exception 'Quote % v% is % and cannot be edited; create a new version (BR-Q2, BR-Q7)',
      old.quote_no, old.version, old.status using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_quotation_guard before update or delete on public.quotations
  for each row execute function public.guard_quotation();

create or replace function public.guard_quotation_lines() returns trigger
language plpgsql set search_path = '' as $$
declare v_status public.quote_status;
begin
  select status into v_status from public.quotations
  where id = case when tg_op = 'DELETE' then old.quotation_id else new.quotation_id end;
  if v_status not in ('draft','pending_approval') then
    raise exception 'The lines of a % quote cannot change (BR-Q2)', v_status using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
create trigger trg_quotation_lines_guard before insert or update or delete on public.quotation_lines
  for each row execute function public.guard_quotation_lines();

create or replace function public.forbid_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception '% is append-only evidence; rows are never changed or deleted (BR-Q4, rule 9)', tg_table_name
    using errcode = '42501';
end $$;
create trigger trg_quote_approvals_append_only before update or delete on public.quote_approvals
  for each row execute function public.forbid_change();

-- ---------------------------------------------------------------------------
-- Pricing: recompute a draft's lines and totals (GST split per line, BR-A4 you_save)
-- Any change unfreezes the quote: dates and terms are re-fixed at issue.
-- ---------------------------------------------------------------------------
create or replace function public.recompute_quote(p_quote uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  q          public.quotations%rowtype;
  v_supplier text := (select value #>> '{}' from public.settings where key = 'supplier_state_code');
  v_pos      text;
  v_intra    boolean;
begin
  select * into q from public.quotations where id = p_quote for update;
  select coalesce(c.state_code, cu.billing_state_code) into v_pos
  from public.properties p
  join public.customers cu on cu.id = p.customer_id
  left join public.cities c on c.id = p.city_id
  where p.id = q.property_id;
  v_intra := v_pos is null or v_pos = v_supplier;     -- unknown state → treat as intra-state

  update public.quotation_lines l set
    line_total    = round(l.qty * l.unit_price, 2),
    taxable_value = round(round(l.qty * l.unit_price, 2) * (1 - q.discount_pct / 100), 2)
  where l.quotation_id = p_quote;

  update public.quotation_lines l set
    cgst = case when v_intra then round(l.taxable_value * l.gst_rate / 200, 2) else 0 end,
    sgst = case when v_intra then round(l.taxable_value * l.gst_rate / 200, 2) else 0 end,
    igst = case when v_intra then 0 else round(l.taxable_value * l.gst_rate / 100, 2) end
  where l.quotation_id = p_quote;

  update public.quotations qt set
    subtotal        = s.subtotal,
    discount_amount = s.subtotal - s.taxable,
    taxable_value   = s.taxable,
    cgst = s.cgst, sgst = s.sgst, igst = s.igst,
    total           = s.taxable + s.cgst + s.sgst + s.igst,
    market_total    = s.market,
    you_save        = greatest(s.market - (s.taxable + s.cgst + s.sgst + s.igst), 0),   -- BR-A4
    supplier_state_code = v_supplier,
    place_of_supply_state_code = v_pos,
    -- unfreeze: dates and terms are fixed again at issue
    issued_at = null, valid_until = null, terms_text = null, terms_version = null,
    warranty_mechanical_days = null, warranty_finish_days = null, pdf_path = null, pdf_sha256 = null
  from (
    select coalesce(sum(line_total), 0) subtotal, coalesce(sum(taxable_value), 0) taxable,
           coalesce(sum(cgst), 0) cgst, coalesce(sum(sgst), 0) sgst, coalesce(sum(igst), 0) igst,
           coalesce(sum(round(market_price * qty, 2)), 0) market
    from public.quotation_lines where quotation_id = p_quote
  ) s
  where qt.id = p_quote;
end $$;
revoke execute on function public.recompute_quote(uuid) from public, anon, authenticated;

-- Who may work on this quote as staff: super_admin, or the surveyor who owns its survey
create or replace function public.can_edit_quote(p_quote uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt()) ->> 'user_role', '') = 'super_admin'
      or exists (select 1 from public.quotations q join public.surveys s on s.id = q.survey_id
                 where q.id = p_quote and s.surveyor_id = (select auth.uid()));
$$;

-- ---------------------------------------------------------------------------
-- create_quote_from_survey(): D10-01 — no re-typing. BR-A1: every fitting assessed first.
-- ---------------------------------------------------------------------------
create or replace function public.create_quote_from_survey(p_survey uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  s        public.surveys%rowtype;
  v_card   uuid;
  v_cards  int;
  v_q      uuid;
  v_missing int;
begin
  select * into s from public.surveys where id = p_survey;
  if not found then raise exception 'Survey not found' using errcode = 'P0002'; end if;
  if not (coalesce((select auth.jwt()) ->> 'user_role', '') = 'super_admin' or s.surveyor_id = (select auth.uid())) then
    raise exception 'Only the surveyor who did this survey can quote it' using errcode = '42501';
  end if;
  if s.status <> 'submitted' then
    raise exception 'Submit the survey before quoting it' using errcode = '22023';
  end if;

  select count(*) into v_missing from public.fittings f
  where f.survey_id = p_survey and not exists (select 1 from public.assessments a where a.fitting_id = f.id);
  if v_missing > 0 then
    raise exception '% fitting(s) have no recommendation yet (BR-A1)', v_missing using errcode = '23514';
  end if;

  select count(distinct a.rate_card_id), min(a.rate_card_id::text)::uuid into v_cards, v_card
  from public.assessments a join public.fittings f on f.id = a.fitting_id where f.survey_id = p_survey;
  if v_cards <> 1 then
    raise exception 'Fittings were priced on different rate-card versions; re-price the survey first (BR-A3)'
      using errcode = '23514';
  end if;

  insert into public.quotations (quote_no, survey_id, lead_id, customer_id, property_id, rate_card_id, created_by)
  select 'Q-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY') || '-' || lpad(nextval('public.quote_no_seq')::text, 4, '0'),
         s.id, s.lead_id, p.customer_id, s.property_id, v_card, (select auth.uid())
  from public.properties p where p.id = s.property_id
  returning id into v_q;

  insert into public.quotation_lines (quotation_id, fitting_id, assessment_id, unit_label, description,
    work_type_id, finish_id, unit_price, line_total, price_replace_eurobrass, market_price, gst_rate, hsn_sac, sort_order)
  select v_q, f.id, a.id, coalesce(pu.label, f.unit_label),
         ft.name || ' — ' || w.name || coalesce(' (' || fi.name || ')', ''),
         w.id, a.finish_id, a.price_recommended, a.price_recommended, a.price_replace_eurobrass,
         a.price_market_replacement,
         coalesce(i.gst_rate, 18.00), i.hsn_sac,
         row_number() over (order by coalesce(pu.label, f.unit_label), ft.sort_order, f.captured_at)
  from public.fittings f
  join public.assessments a on a.fitting_id = f.id and a.recommended <> 'no_action'
  join public.fitting_types ft on ft.id = f.fitting_type_id
  join public.work_types w on w.code = a.recommended::text
  left join public.finishes fi on fi.id = a.finish_id
  left join public.property_units pu on pu.id = f.property_unit_id
  left join lateral (
    select ri.gst_rate, ri.hsn_sac from public.rate_card_items ri
    where ri.rate_card_id = a.rate_card_id and ri.fitting_type_id = f.fitting_type_id and ri.work_type_id = w.id
      and (ri.finish_id = coalesce(a.finish_id, f.current_finish_id) or ri.finish_id is null)
    order by (ri.finish_id is null) limit 1
  ) i on true
  where f.survey_id = p_survey;

  if not exists (select 1 from public.quotation_lines where quotation_id = v_q) then
    raise exception 'Every fitting is "no action" — there is nothing to quote' using errcode = '23514';
  end if;

  perform public.recompute_quote(v_q);
  return v_q;
end $$;
revoke execute on function public.create_quote_from_survey(uuid) from public, anon;
grant execute on function public.create_quote_from_survey(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- BR-A6: a discount above the threshold blocks sending until super_admin approves it
-- ---------------------------------------------------------------------------
create or replace function public.set_quote_discount(p_quote uuid, p_pct numeric, p_reason text default null)
returns public.quote_status language plpgsql security definer set search_path = '' as $$
declare
  q           public.quotations%rowtype;
  v_threshold numeric := coalesce((select (value #>> '{}')::numeric from public.settings where key = 'discount_threshold_pct'), 5);
begin
  select * into q from public.quotations where id = p_quote for update;
  if not found then raise exception 'Quote not found' using errcode = 'P0002'; end if;
  if not public.can_edit_quote(p_quote) then raise exception 'Not your quote' using errcode = '42501'; end if;
  if q.status <> 'draft' then raise exception 'Only a draft can be discounted' using errcode = '22023'; end if;
  if p_pct < 0 or p_pct > 100 then raise exception 'Discount must be between 0 and 100%%' using errcode = '22023'; end if;

  if p_pct > v_threshold and coalesce((select auth.jwt()) ->> 'user_role', '') <> 'super_admin' then
    if length(trim(coalesce(p_reason, ''))) = 0 then
      raise exception 'A discount above % percent needs a reason for the approver (BR-A6)', v_threshold using errcode = '23514';
    end if;
    insert into public.discount_approvals (quotation_id, requested_by, requested_pct, reason)
    values (p_quote, (select auth.uid()), p_pct, trim(p_reason));
    update public.quotations set discount_pct = p_pct, status = 'pending_approval' where id = p_quote;
  else
    update public.quotations set discount_pct = p_pct where id = p_quote;
  end if;
  perform public.recompute_quote(p_quote);
  return (select status from public.quotations where id = p_quote);
end $$;
revoke execute on function public.set_quote_discount(uuid, numeric, text) from public, anon;
grant execute on function public.set_quote_discount(uuid, numeric, text) to authenticated;

create or replace function public.decide_discount(p_approval uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare d public.discount_approvals%rowtype;
begin
  if coalesce((select auth.jwt()) ->> 'user_role', '') <> 'super_admin' then
    raise exception 'Only a super_admin decides discounts (BR-A6)' using errcode = '42501';
  end if;
  select * into d from public.discount_approvals where id = p_approval for update;
  if not found or d.decision is not null then
    raise exception 'No pending discount request' using errcode = 'P0002';
  end if;
  update public.discount_approvals
  set decision = case when p_approve then 'approved' else 'rejected' end,
      decided_by = (select auth.uid()), decided_at = now(), decision_note = p_note
  where id = p_approval;
  update public.quotations
  set status = 'draft', discount_pct = case when p_approve then d.requested_pct else 0 end
  where id = d.quotation_id and status = 'pending_approval';
  perform public.recompute_quote(d.quotation_id);
end $$;
revoke execute on function public.decide_discount(uuid, boolean, text) from public, anon;
grant execute on function public.decide_discount(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Issue: freeze dates + terms (BR-Q1, BR-Q3), render the PDF from them, then mark sent
-- ---------------------------------------------------------------------------
create or replace function public.freeze_quote_for_issue(p_quote uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  q        public.quotations%rowtype;
  v_terms  jsonb := (select value from public.settings where key = 'warranty_terms');
  v_days   int   := coalesce((select (value #>> '{}')::int from public.settings where key = 'quote_validity_days'), 15);
begin
  select * into q from public.quotations where id = p_quote for update;
  if not found then raise exception 'Quote not found' using errcode = 'P0002'; end if;
  if not public.can_edit_quote(p_quote) then raise exception 'Not your quote' using errcode = '42501'; end if;
  if q.status = 'pending_approval' then
    raise exception 'The discount is waiting for approval — the quote cannot be sent yet (BR-A6)' using errcode = '22023';
  end if;
  if q.status <> 'draft' then raise exception 'Only a draft can be issued' using errcode = '22023'; end if;
  if v_terms is null or jsonb_typeof(v_terms) <> 'object' or length(coalesce(v_terms ->> 'text', '')) = 0 then
    raise exception 'Warranty terms are not loaded yet (client input A10)' using errcode = '55000';
  end if;

  update public.quotations set
    issued_at = now(),
    valid_until = (now() at time zone 'Asia/Kolkata')::date + v_days,          -- BR-Q1
    terms_text = v_terms ->> 'text', terms_version = v_terms ->> 'version',  -- BR-Q3
    warranty_mechanical_days = (v_terms ->> 'mechanical_days')::int,
    warranty_finish_days     = (v_terms ->> 'finish_days')::int
  where id = p_quote;

  return (select jsonb_build_object('issued_at', issued_at, 'valid_until', valid_until, 'terms_version', terms_version)
          from public.quotations where id = p_quote);
end $$;
revoke execute on function public.freeze_quote_for_issue(uuid) from public, anon;
grant execute on function public.freeze_quote_for_issue(uuid) to authenticated;

create or replace function public.mark_quote_sent(p_quote uuid, p_pdf_path text, p_pdf_sha256 text)
returns void language plpgsql security definer set search_path = '' as $$
declare q public.quotations%rowtype;
begin
  select * into q from public.quotations where id = p_quote for update;
  if not found then raise exception 'Quote not found' using errcode = 'P0002'; end if;
  if not public.can_edit_quote(p_quote) then raise exception 'Not your quote' using errcode = '42501'; end if;
  if q.status <> 'draft' or q.issued_at is null then
    raise exception 'Freeze the quote before sending it' using errcode = '22023';
  end if;
  if p_pdf_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'pdf_sha256 must be a SHA-256 hex digest' using errcode = '22023';
  end if;

  update public.quotations set status = 'sent', pdf_path = p_pdf_path, pdf_sha256 = p_pdf_sha256 where id = p_quote;
  -- D2-07: the pipeline moves to Quoted
  update public.leads set status = 'quoted' where id = q.lead_id and status = 'surveyed';
end $$;
revoke execute on function public.mark_quote_sent(uuid, text, text) from public, anon;
grant execute on function public.mark_quote_sent(uuid, text, text) to authenticated;

-- BR-Q2: a change to a sent/expired/rejected quote is a new version; the old one is superseded
create or replace function public.create_quote_version(p_quote uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare q public.quotations%rowtype; v_new uuid;
begin
  select * into q from public.quotations where id = p_quote for update;
  if not found then raise exception 'Quote not found' using errcode = 'P0002'; end if;
  if not public.can_edit_quote(p_quote) then raise exception 'Not your quote' using errcode = '42501'; end if;
  if q.status = 'approved' then
    raise exception 'An approved quote is final; changes need a change order (BR-Q7)' using errcode = '42501';
  end if;
  if q.status not in ('sent','expired','rejected') then
    raise exception 'Only a sent, expired or rejected quote gets a new version — edit the draft instead' using errcode = '22023';
  end if;

  insert into public.quotations (quote_no, version, supersedes_id, survey_id, lead_id, customer_id, property_id,
                                 rate_card_id, discount_pct, created_by)
  values (q.quote_no, q.version + 1, q.id, q.survey_id, q.lead_id, q.customer_id, q.property_id,
          q.rate_card_id, q.discount_pct, (select auth.uid()))
  returning id into v_new;

  insert into public.quotation_lines (quotation_id, fitting_id, assessment_id, unit_label, description, work_type_id,
    finish_id, qty, unit_price, line_total, price_replace_eurobrass, market_price, gst_rate, hsn_sac, sort_order)
  select v_new, fitting_id, assessment_id, unit_label, description, work_type_id,
    finish_id, qty, unit_price, line_total, price_replace_eurobrass, market_price, gst_rate, hsn_sac, sort_order
  from public.quotation_lines where quotation_id = q.id;

  update public.quotations set status = 'superseded' where id = q.id;
  perform public.recompute_quote(v_new);
  return v_new;
end $$;
revoke execute on function public.create_quote_version(uuid) from public, anon;
grant execute on function public.create_quote_version(uuid) to authenticated;

-- E11-S15: the daily sweep (pg_cron wiring comes with E4-S01). BR-Q1: past valid_until → expired.
create or replace function public.expire_quotes()
returns int language plpgsql security definer set search_path = '' as $$
declare v_count int;
begin
  update public.quotations set status = 'expired'
  where status = 'sent' and valid_until < (now() at time zone 'Asia/Kolkata')::date;
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke execute on function public.expire_quotes() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- E11-S08 (request half): issue an approval OTP. Service role only — the public quote page's
-- route handler calls it, sends the code over WhatsApp/SMS, then record_otp_delivery().
-- Returns {otp_id, code, expires_at}; the code is never stored.
-- ---------------------------------------------------------------------------
create or replace function public.request_quote_otp(p_quote uuid, p_phone text, p_channel public.msg_channel)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  q         public.quotations%rowtype;
  v_claims  jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  v_expiry  int := coalesce((select (value #>> '{}')::int from public.settings where key = 'otp_expiry_minutes'), 10);
  v_perhour int := coalesce((select (value #>> '{}')::int from public.settings where key = 'otp_max_per_hour'), 3);
  v_id      uuid := gen_random_uuid();
  v_code    text;
begin
  if v_claims is not null and coalesce(v_claims ->> 'role', '') <> 'service_role' then
    raise exception 'OTPs are issued by the server only' using errcode = '42501';
  end if;
  select * into q from public.quotations where id = p_quote;
  if not found then raise exception 'Quote not found' using errcode = 'P0002'; end if;
  if q.status <> 'sent' or q.valid_until < (now() at time zone 'Asia/Kolkata')::date then
    raise exception 'This quote can no longer be approved — ask for a re-quote (BR-Q1)' using errcode = '22023';
  end if;
  if (select count(*) from public.quote_otps
      where phone = p_phone and generated_at > now() - interval '1 hour') >= v_perhour then
    raise exception 'Too many codes requested — try again in an hour' using errcode = '53400';
  end if;

  v_code := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
  insert into public.quote_otps (id, quotation_id, phone, channel, otp_hash, expires_at)
  values (v_id, p_quote, p_phone, p_channel,
          encode(extensions.digest(v_id::text || ':' || v_code, 'sha256'), 'hex'),
          now() + make_interval(mins => v_expiry));
  return jsonb_build_object('otp_id', v_id, 'code', v_code, 'expires_at', now() + make_interval(mins => v_expiry));
end $$;
revoke execute on function public.request_quote_otp(uuid, text, public.msg_channel) from public, anon, authenticated;
grant execute on function public.request_quote_otp(uuid, text, public.msg_channel) to service_role;

create or replace function public.record_otp_delivery(p_otp uuid, p_gateway_message_id text, p_dlt_template_id text default null)
returns void language sql security definer set search_path = '' as $$
  update public.quote_otps
  set delivered_at = coalesce(delivered_at, now()),
      gateway_message_id = coalesce(p_gateway_message_id, gateway_message_id),
      dlt_template_id = coalesce(p_dlt_template_id, dlt_template_id)
  where id = p_otp;
$$;
revoke execute on function public.record_otp_delivery(uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_otp_delivery(uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Policies (ADR-004). No INSERT/UPDATE policies: writes go through the functions above.
-- ---------------------------------------------------------------------------
create policy quotations_select on public.quotations for select to authenticated
using (
  (select public.current_role_is('super_admin'))
  or ((select public.current_role_is('surveyor'))
      and exists (select 1 from public.surveys s where s.id = quotations.survey_id and s.surveyor_id = (select auth.uid())))
  -- the executive discussing it with their lead (roles: pricing only on a quote)
  or ((select public.current_role_is('cc_exec'))
      and exists (select 1 from public.leads l where l.id = quotations.lead_id))
  -- item 12: a customer never sees a draft or a quote awaiting discount approval
  or (status not in ('draft','pending_approval')
      and customer_id = any ((select public.my_customer_ids())::uuid[]))
);

create policy quotation_lines_select on public.quotation_lines for select to authenticated
  using (exists (select 1 from public.quotations q where q.id = quotation_lines.quotation_id));

create policy quote_approvals_select on public.quote_approvals for select to authenticated
  using (exists (select 1 from public.quotations q where q.id = quote_approvals.quotation_id));

create policy discount_approvals_select on public.discount_approvals for select to authenticated
  using ((select public.current_role_is('super_admin')) or requested_by = (select auth.uid()));

-- OTP rows hold hashes; only super_admin may inspect them (support), nobody writes directly
create policy quote_otps_admin_read on public.quote_otps for select to authenticated
  using ((select public.current_role_is('super_admin')));
