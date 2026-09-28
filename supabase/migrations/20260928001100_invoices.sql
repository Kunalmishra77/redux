-- E14-S07, S08, S09, S12 (DB half), S18 · schema.sql §12 — invoices, payments, credit notes (D13)
-- BR-I1…I8 · ADR-010 (stored GST fields) · ADR-011 (Razorpay routing) · compliance §4 (Rule 46).
--
-- Deviations from schema.sql (task tracker → Deviations):
--   * The number is allocated at ISSUE, not at draft: a draft has no number, so a deleted or
--     abandoned draft can never leave a gap (BR-I1). invoice_no is null until issued.
--   * allocate_document_no(code, date) picks (or opens) the series for the date's financial year
--     (1 April, IST) under a row lock — gap-free, reset every FY, ≤16 chars. Credit notes use their
--     own series the same way.
--   * Supplier identity (GSTIN, legal name, address) and the series codes are client input A11 —
--     settings start empty and issue refuses until they are loaded. Nothing is invented.
--   * After issue the invoice is frozen (BR-I3): only payment progress, the payment-route fields,
--     the one-time PDF and cancellation can change — and only by the system.
--   * Paid ONLY from record_payment(), which only the server (verified webhook) can call (BR-I5),
--     idempotent on the provider's payment id (BR-I7).
--   * Place of supply is carried over from the quote (the property's state).

insert into public.settings (key, value, description) values
  ('supplier_gstin',          'null', 'A11: REDUX GSTIN — invoices cannot issue until set'),
  ('supplier_legal_name',     'null', 'A11: legal name on the GST registration'),
  ('supplier_address',        'null', 'A11: registered address as on the GST certificate'),
  ('invoice_series_code',     'null', 'A11: invoice series prefix, e.g. "RDX" — ≤ 5 chars (A-Z 0-9 -), so numbers stay ≤ 16'),
  ('credit_note_series_code', 'null', 'A11: credit note series prefix, e.g. "RDXCN" — ≤ 5 chars'),
  ('invoice_warn_days',       '25',   'BR-I8: warn when a completed job is this many days from supply without an invoice'),
  ('invoice_due_by_days',     '30',   'BR-I8: services must be invoiced within this many days of supply')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- SECURITY FIX (found while testing this migration). Inside a SECURITY DEFINER function
-- current_user is the function's OWNER, never 'authenticated' — so the check
-- "current_user = 'authenticated'" could never fire, and any logged-in user could call
-- move_unit_stage() and link_to_pilot() (migration 001000). Caller identity comes from the
-- request's JWT claims: none (direct DB session) or role service_role = the system.
-- supabase/tests/11_definer_guards.test.sql calls every staff-only function as the wrong role.
-- ---------------------------------------------------------------------------
create or replace function public.is_system_caller()
returns boolean language sql stable set search_path = '' as $$
  -- no claims at all = a direct database session (migrations, cron); claims without a role are
  -- treated as a user, never as the system
  select case when nullif(current_setting('request.jwt.claims', true), '') is null then true
              else coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') = 'service_role' end;
$$;

-- ---------------------------------------------------------------------------
-- BR-I1: gap-free numbering per series per financial year
-- ---------------------------------------------------------------------------
create table public.invoice_series (
  id          uuid primary key default gen_random_uuid(),
  code        text not null check (code ~ '^[A-Z0-9-]{1,5}$'),   -- CODE/2627/00001 must stay ≤ 16 chars
  fy_start    date not null check (extract(month from fy_start) = 4 and extract(day from fy_start) = 1),
  fy_end      date not null,
  next_number int not null default 1 check (next_number > 0),
  unique (code, fy_start),
  constraint invoice_series_fy check (fy_end = (fy_start + interval '1 year - 1 day')::date)
);

create or replace function public.fy_start_of(p_date date)
returns date language sql immutable set search_path = '' as $$
  select make_date(case when extract(month from p_date) >= 4 then extract(year from p_date)::int
                        else extract(year from p_date)::int - 1 end, 4, 1);
$$;

-- CODE/2627/00042 — max 16 chars, alphanumerics plus - and / (compliance §4)
create or replace function public.allocate_document_no(p_code text, p_date date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_fy     date := public.fy_start_of(p_date);
  v_series public.invoice_series%rowtype;
  v_no     text;
begin
  insert into public.invoice_series (code, fy_start, fy_end)
  values (p_code, v_fy, (v_fy + interval '1 year - 1 day')::date)
  on conflict (code, fy_start) do nothing;

  select * into v_series from public.invoice_series where code = p_code and fy_start = v_fy for update;  -- serialises issuers
  update public.invoice_series set next_number = next_number + 1 where id = v_series.id;

  v_no := p_code || '/' || to_char(v_fy, 'YY') || to_char(v_fy + interval '1 year', 'YY') || '/'
          || lpad(v_series.next_number::text, 5, '0');
  if char_length(v_no) > 16 then
    raise exception 'Document number % exceeds 16 characters (GST Rule 46)', v_no using errcode = '22001';
  end if;
  return jsonb_build_object('series_id', v_series.id, 'number', v_no);
end $$;
revoke execute on function public.allocate_document_no(text, date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Invoices
-- ---------------------------------------------------------------------------
create table public.invoices (
  id            uuid primary key default gen_random_uuid(),
  invoice_no    text unique check (invoice_no is null or (char_length(invoice_no) <= 16 and invoice_no ~ '^[A-Za-z0-9/-]+$')),
  series_id     uuid references public.invoice_series(id),
  job_id        uuid references public.jobs(id),
  quotation_id  uuid references public.quotations(id),
  customer_id   uuid not null references public.customers(id),
  status        public.invoice_status not null default 'draft',
  issue_date    date,
  due_date      date,
  supply_date   date,                                          -- BR-I8

  -- GST fields stored, never recomputed at render (BR-I3). Supplier fields are fixed at issue.
  supplier_gstin    text,
  supplier_name     text,
  supplier_address  text,
  supplier_state_code text,
  recipient_gstin   text check (recipient_gstin is null or recipient_gstin ~ '^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  recipient_name    text not null,
  recipient_address text not null,
  place_of_supply_state_code text not null,                    -- BR-I4
  reverse_charge    boolean not null default false,

  subtotal      numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  taxable_value numeric(12,2) not null default 0,
  cgst          numeric(12,2) not null default 0,
  sgst          numeric(12,2) not null default 0,
  igst          numeric(12,2) not null default 0,
  total         numeric(12,2) not null default 0 check (total >= 0),
  amount_paid   numeric(12,2) not null default 0 check (amount_paid >= 0),

  pdf_path      text,
  pdf_sha256    text check (pdf_sha256 is null or pdf_sha256 ~ '^[0-9a-f]{64}$'),
  -- BR-I6 routing
  payment_route text check (payment_route in ('payment_link','virtual_account')),
  payment_link_url text,
  virtual_account_id text,
  virtual_account_details jsonb,

  cancelled_at  timestamptz,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint invoice_issued_complete check (
    status = 'draft'
    or (invoice_no is not null and series_id is not null and issue_date is not null
        and supplier_gstin is not null and supplier_name is not null and supplier_address is not null
        and payment_route is not null)),
  constraint invoice_cancelled_consistent check ((status = 'cancelled') = (cancelled_at is not null))
);
create index invoices_customer_id_idx on public.invoices (customer_id);
create index invoices_job_id_idx      on public.invoices (job_id);
create index invoices_status_idx      on public.invoices (status);
create index invoices_due_date_idx    on public.invoices (due_date) where status in ('issued','part_paid');
-- one live invoice per job
create unique index invoices_one_per_job on public.invoices (job_id) where job_id is not null and status <> 'cancelled';
create trigger trg_invoices_updated before update on public.invoices
  for each row execute function public.set_updated_at();
create trigger trg_audit_invoices after insert or update on public.invoices
  for each row execute function public.write_audit();

create table public.invoice_lines (
  id            uuid primary key default gen_random_uuid(),
  invoice_id    uuid not null references public.invoices(id),
  description   text not null,
  hsn_sac       text,                                           -- required at issue (Rule 46)
  qty           numeric(10,2) not null default 1 check (qty > 0),
  uom           text not null default 'NOS',
  unit_price    numeric(12,2) not null,
  taxable_value numeric(12,2) not null,
  gst_rate      numeric(5,2) not null,
  cgst          numeric(12,2) not null default 0,
  sgst          numeric(12,2) not null default 0,
  igst          numeric(12,2) not null default 0,
  line_total    numeric(12,2) not null,
  sort_order    int not null default 0
);
create index invoice_lines_invoice_id_idx on public.invoice_lines (invoice_id);

create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  invoice_id          uuid not null references public.invoices(id),
  provider            text not null default 'razorpay',
  provider_payment_id text not null,                            -- BR-I7 idempotency
  method              text,                                     -- upi | card | netbanking | neft | rtgs
  amount              numeric(12,2) not null check (amount > 0),
  status              public.payment_status not null,
  captured_at         timestamptz,
  raw_payload         jsonb,
  created_at          timestamptz not null default now(),
  unique (provider, provider_payment_id)
);
create index payments_invoice_id_idx on public.payments (invoice_id);
create trigger trg_audit_payments after insert or update on public.payments
  for each row execute function public.write_audit();

-- BR-I2: cancellation is a credit note, never a delete
create table public.credit_notes (
  id          uuid primary key default gen_random_uuid(),
  credit_no   text not null unique check (char_length(credit_no) <= 16),
  series_id   uuid not null references public.invoice_series(id),
  invoice_id  uuid not null references public.invoices(id),
  reason      text not null check (length(trim(reason)) > 0),
  amount      numeric(12,2) not null check (amount > 0),
  taxable_value numeric(12,2) not null,
  cgst        numeric(12,2) not null default 0,
  sgst        numeric(12,2) not null default 0,
  igst        numeric(12,2) not null default 0,
  issue_date  date not null,
  pdf_path    text,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);
create index credit_notes_invoice_id_idx on public.credit_notes (invoice_id);

alter table public.invoice_series enable row level security;
alter table public.invoices       enable row level security;
alter table public.invoice_lines  enable row level security;
alter table public.payments       enable row level security;
alter table public.credit_notes   enable row level security;

create trigger trg_credit_notes_append_only before update or delete on public.credit_notes
  for each row execute function public.forbid_change();
create trigger trg_payments_no_delete before delete on public.payments
  for each row execute function public.forbid_change();

-- ---------------------------------------------------------------------------
-- BR-I2 / BR-I3 / BR-I5: what may change after issue, and by whom
-- ---------------------------------------------------------------------------
create or replace function public.guard_invoice() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_mutable text[] := array['status','amount_paid','payment_link_url','virtual_account_id',
                            'virtual_account_details','cancelled_at','updated_at','pdf_path','pdf_sha256'];
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'Invoice % is never deleted — issue a credit note (BR-I2)', old.invoice_no using errcode = '42501';
    end if;
    return old;
  end if;

  if old.status = 'draft' then
    return new;
  end if;

  -- BR-I5: payment progress is the server's alone (verified webhook), never a user's
  if current_user = 'authenticated' then
    raise exception 'An issued invoice is changed only by the system (BR-I3, BR-I5)' using errcode = '42501';
  end if;
  if (to_jsonb(new) - v_mutable) is distinct from (to_jsonb(old) - v_mutable) then
    raise exception 'Invoice % is issued; its GST fields are frozen (BR-I3)', old.invoice_no using errcode = '42501';
  end if;
  if old.pdf_sha256 is not null and new.pdf_sha256 is distinct from old.pdf_sha256 then
    raise exception 'The PDF of invoice % is fixed once rendered (BR-I3)', old.invoice_no using errcode = '42501';
  end if;
  if old.status = 'cancelled' then
    raise exception 'Invoice % is cancelled', old.invoice_no using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_invoice_guard before update or delete on public.invoices
  for each row execute function public.guard_invoice();

create or replace function public.guard_invoice_lines() returns trigger
language plpgsql set search_path = '' as $$
declare v_status public.invoice_status;
begin
  select status into v_status from public.invoices
  where id = case when tg_op = 'DELETE' then old.invoice_id else new.invoice_id end;
  if v_status <> 'draft' then
    raise exception 'The lines of an issued invoice never change (BR-I3)' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
create trigger trg_invoice_lines_guard before insert or update or delete on public.invoice_lines
  for each row execute function public.guard_invoice_lines();

-- ---------------------------------------------------------------------------
-- E14-S08: a draft invoice from the job's approved quote — lines and GST exactly as agreed
-- ---------------------------------------------------------------------------
create or replace function public.create_invoice_from_job(p_job uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  j     public.jobs%rowtype;
  q     public.quotations%rowtype;
  c     public.customers%rowtype;
  v_inv uuid;
begin
  if not public.is_system_caller() and not public.current_role_is('super_admin') then
    raise exception 'Only a super_admin raises invoices' using errcode = '42501';
  end if;
  select * into j from public.jobs where id = p_job;
  if not found then raise exception 'Job not found' using errcode = 'P0002'; end if;
  select * into q from public.quotations where id = j.quotation_id;
  select * into c from public.customers where id = j.customer_id;
  if q.status <> 'approved' then
    raise exception 'Only an approved quote is invoiced' using errcode = '22023';
  end if;

  insert into public.invoices (job_id, quotation_id, customer_id, supply_date,
    recipient_gstin, recipient_name, recipient_address, place_of_supply_state_code,
    subtotal, discount_amount, taxable_value, cgst, sgst, igst, total, created_by)
  select j.id, q.id, c.id, coalesce(j.actual_end, (now() at time zone 'Asia/Kolkata')::date),
         c.gstin, c.name, coalesce(c.billing_address, p.address),
         coalesce(q.place_of_supply_state_code, c.billing_state_code),
         q.subtotal, q.discount_amount, q.taxable_value, q.cgst, q.sgst, q.igst, q.total, (select auth.uid())
  from public.properties p where p.id = q.property_id
  returning id into v_inv;

  insert into public.invoice_lines (invoice_id, description, hsn_sac, qty, unit_price, taxable_value, gst_rate,
                                    cgst, sgst, igst, line_total, sort_order)
  select v_inv, coalesce(l.unit_label || ' · ', '') || l.description, l.hsn_sac, l.qty, l.unit_price,
         l.taxable_value, l.gst_rate, l.cgst, l.sgst, l.igst,
         l.taxable_value + l.cgst + l.sgst + l.igst, l.sort_order
  from public.quotation_lines l where l.quotation_id = q.id;

  return v_inv;
end $$;
revoke execute on function public.create_invoice_from_job(uuid) from public, anon;
grant execute on function public.create_invoice_from_job(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- E14-S09: issue — freeze supplier identity, allocate the number, route the payment (BR-I6)
-- ---------------------------------------------------------------------------
create or replace function public.issue_invoice(p_invoice uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  i        public.invoices%rowtype;
  v_today  date := (now() at time zone 'Asia/Kolkata')::date;
  v_gstin  text := (select value #>> '{}' from public.settings where key = 'supplier_gstin');
  v_name   text := (select value #>> '{}' from public.settings where key = 'supplier_legal_name');
  v_addr   text := (select value #>> '{}' from public.settings where key = 'supplier_address');
  v_state  text := (select value #>> '{}' from public.settings where key = 'supplier_state_code');
  v_code   text := (select value #>> '{}' from public.settings where key = 'invoice_series_code');
  v_limit  numeric := coalesce((select (value #>> '{}')::numeric from public.settings where key = 'payment_link_max'), 50000);
  v_no     jsonb;
begin
  if not public.is_system_caller() and not public.current_role_is('super_admin') then
    raise exception 'Only a super_admin issues invoices' using errcode = '42501';
  end if;
  select * into i from public.invoices where id = p_invoice for update;
  if not found then raise exception 'Invoice not found' using errcode = 'P0002'; end if;
  if i.status <> 'draft' then raise exception 'Invoice % is already issued', i.invoice_no using errcode = '22023'; end if;
  if v_gstin is null or v_name is null or v_addr is null or v_code is null then
    raise exception 'REDUX''s GSTIN, legal name, address and invoice series are not loaded yet (client input A11)'
      using errcode = '55000';
  end if;
  if exists (select 1 from public.invoice_lines where invoice_id = p_invoice and coalesce(hsn_sac, '') = '') then
    raise exception 'Every line needs an HSN/SAC code before issue (GST Rule 46; A11)' using errcode = '23514';
  end if;
  if not exists (select 1 from public.invoice_lines where invoice_id = p_invoice) then
    raise exception 'An invoice needs at least one line' using errcode = '23514';
  end if;

  v_no := public.allocate_document_no(v_code, v_today);          -- BR-I1

  update public.invoices set
    status = 'issued', invoice_no = v_no ->> 'number', series_id = (v_no ->> 'series_id')::uuid,
    issue_date = v_today, due_date = v_today,
    supplier_gstin = v_gstin, supplier_name = v_name, supplier_address = v_addr, supplier_state_code = v_state,
    payment_route = case when i.total > v_limit then 'virtual_account' else 'payment_link' end   -- BR-I6
  where id = p_invoice;
  return v_no ->> 'number';
end $$;
revoke execute on function public.issue_invoice(uuid) from public, anon;
grant execute on function public.issue_invoice(uuid) to authenticated;

-- The rendered PDF is recorded once (server, after Gotenberg) — BR-I3 byte-identical reproduction
create or replace function public.set_invoice_pdf(p_invoice uuid, p_path text, p_sha256 text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.invoices set pdf_path = p_path, pdf_sha256 = p_sha256
  where id = p_invoice and status <> 'draft' and pdf_sha256 is null;
  if not found then raise exception 'Invoice not issued, or its PDF is already recorded' using errcode = '22023'; end if;
end $$;
revoke execute on function public.set_invoice_pdf(uuid, text, text) from public, anon, authenticated;
grant execute on function public.set_invoice_pdf(uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- BR-I5 / BR-I7: payments arrive only from the verified Razorpay webhook (via the queue worker)
--   p: {invoice_id, provider_payment_id, amount, status, method?, captured_at?, raw_payload?}
-- Returns {recorded: bool, invoice_status}.
-- ---------------------------------------------------------------------------
create or replace function public.record_payment(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  i        public.invoices%rowtype;
  v_id     uuid;
  v_paid   numeric;
begin
  if v_claims is not null and coalesce(v_claims ->> 'role', '') <> 'service_role' then
    raise exception 'Payments are recorded only from the verified webhook (BR-I5)' using errcode = '42501';
  end if;
  select * into i from public.invoices where id = (p ->> 'invoice_id')::uuid for update;
  if not found then raise exception 'Invoice not found' using errcode = 'P0002'; end if;
  if i.status in ('draft','cancelled') then
    raise exception 'Invoice is % — payment not applied', i.status using errcode = '22023';
  end if;

  insert into public.payments (invoice_id, provider, provider_payment_id, method, amount, status, captured_at, raw_payload)
  values (i.id, coalesce(p ->> 'provider', 'razorpay'), p ->> 'provider_payment_id', p ->> 'method',
          (p ->> 'amount')::numeric, (p ->> 'status')::public.payment_status,
          (p ->> 'captured_at')::timestamptz, p -> 'raw_payload')
  on conflict (provider, provider_payment_id) do nothing          -- BR-I7: a redelivery changes nothing
  returning id into v_id;

  if v_id is null then
    -- the same payment moving on (e.g. created → captured) updates its status once
    update public.payments set status = (p ->> 'status')::public.payment_status,
      captured_at = coalesce(captured_at, (p ->> 'captured_at')::timestamptz)
    where provider = coalesce(p ->> 'provider', 'razorpay') and provider_payment_id = p ->> 'provider_payment_id'
      and status is distinct from (p ->> 'status')::public.payment_status
      and status not in ('captured','refunded')
    returning id into v_id;
  end if;

  select coalesce(sum(amount) filter (where status = 'captured'), 0)
       - coalesce(sum(amount) filter (where status = 'refunded'), 0)
  into v_paid from public.payments where invoice_id = i.id;

  update public.invoices set
    amount_paid = greatest(v_paid, 0),
    status = case when v_paid >= total then 'paid'
                  when v_paid > 0 then 'part_paid'
                  else 'issued' end::public.invoice_status
  where id = i.id;

  return jsonb_build_object('recorded', v_id is not null,
                            'invoice_status', (select status from public.invoices where id = i.id));
end $$;
revoke execute on function public.record_payment(jsonb) from public, anon, authenticated;
grant execute on function public.record_payment(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- E14-S18 / BR-I2: cancel = full credit note from its own gap-free series
-- ---------------------------------------------------------------------------
create or replace function public.cancel_invoice(p_invoice uuid, p_reason text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  i       public.invoices%rowtype;
  v_code  text := (select value #>> '{}' from public.settings where key = 'credit_note_series_code');
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_no    jsonb;
begin
  if not public.is_system_caller() and not public.current_role_is('super_admin') then
    raise exception 'Only a super_admin cancels invoices' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'A credit note needs a reason' using errcode = '23514';
  end if;
  select * into i from public.invoices where id = p_invoice for update;
  if not found then raise exception 'Invoice not found' using errcode = 'P0002'; end if;
  if i.status in ('draft','cancelled') then
    raise exception 'Only an issued invoice is cancelled by credit note' using errcode = '22023';
  end if;
  if i.amount_paid > 0 then
    raise exception 'Refund the payments first; a paid invoice is not cancelled silently' using errcode = '22023';
  end if;
  if v_code is null then
    raise exception 'The credit note series is not loaded yet (client input A11)' using errcode = '55000';
  end if;

  v_no := public.allocate_document_no(v_code, v_today);
  insert into public.credit_notes (credit_no, series_id, invoice_id, reason, amount, taxable_value, cgst, sgst, igst,
                                   issue_date, created_by)
  values (v_no ->> 'number', (v_no ->> 'series_id')::uuid, i.id, trim(p_reason), i.total, i.taxable_value,
          i.cgst, i.sgst, i.igst, v_today, (select auth.uid()));
  update public.invoices set status = 'cancelled', cancelled_at = now() where id = i.id;
  return v_no ->> 'number';
end $$;
revoke execute on function public.cancel_invoice(uuid, text) from public, anon;
grant execute on function public.cancel_invoice(uuid, text) to authenticated;

-- BR-I8: completed jobs not yet invoiced, with days since supply (warn from invoice_warn_days)
create view public.v_invoices_due as
select j.id as job_id, j.job_no, j.customer_id, j.actual_end as supply_date,
       ((now() at time zone 'Asia/Kolkata')::date - j.actual_end) as days_since_supply
from public.jobs j
where j.status = 'completed' and j.actual_end is not null
  and not exists (select 1 from public.invoices i where i.job_id = j.id and i.status <> 'draft' and i.status <> 'cancelled')
  and ((now() at time zone 'Asia/Kolkata')::date - j.actual_end)
      >= coalesce((select (value #>> '{}')::int from public.settings where key = 'invoice_warn_days'), 25);
alter view public.v_invoices_due set (security_invoker = true);

-- ---------------------------------------------------------------------------
-- Policies (ADR-004). Roles matrix: invoices & payments — super_admin all, cc_exec view,
-- customer own. No user write policies: every change goes through the functions above.
-- ---------------------------------------------------------------------------
create policy invoice_series_admin_read on public.invoice_series for select to authenticated
  using ((select public.current_role_is('super_admin')));

create policy invoices_select on public.invoices for select to authenticated
using (
  ((select auth.jwt()) ->> 'user_role') in ('super_admin','cc_exec')
  or (status <> 'draft' and customer_id = any ((select public.my_customer_ids())::uuid[]))
);
create policy invoice_lines_select on public.invoice_lines for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_lines.invoice_id));
create policy payments_select on public.payments for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = payments.invoice_id));
create policy credit_notes_select on public.credit_notes for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = credit_notes.invoice_id));

-- ---------------------------------------------------------------------------
-- The two functions from 001000 with the same fix (see is_system_caller above)
-- ---------------------------------------------------------------------------
create or replace function public.move_unit_stage(p_unit uuid, p_to public.job_stage,
                                                  p_note text default null, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  u        public.job_units%rowtype;
  v_stages public.job_stage[] := enum_range(null::public.job_stage);
  v_from_i int;
  v_to_i   int;
  v_back   boolean;
begin
  select * into u from public.job_units where id = p_unit for update;
  if not found then raise exception 'Unit not found' using errcode = 'P0002'; end if;
  if not public.is_system_caller() and not public.current_role_is('super_admin') then
    raise exception 'Only a super_admin moves job stages' using errcode = '42501';
  end if;
  if p_to in ('handover','warranty_active') then
    raise exception 'Handover is recorded with the handover checks, not by moving the stage (D11-07)' using errcode = '22023';
  end if;
  if u.status = 'blocked' then
    raise exception 'The unit is blocked — unblock it first (BR-J2)' using errcode = '22023';
  end if;

  v_from_i := array_position(v_stages, u.current_stage);
  v_to_i   := array_position(v_stages, p_to);
  v_back   := v_to_i < v_from_i;
  if v_to_i = v_from_i then
    raise exception 'The unit is already at %', p_to using errcode = '22023';
  end if;
  if not v_back and v_to_i <> v_from_i + 1 then
    raise exception 'Stages move one at a time: % → % skips a stage (BR-J1)', u.current_stage, p_to using errcode = '23514';
  end if;
  if v_back and length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Moving a unit back needs a reason (BR-J1)' using errcode = '23514';
  end if;

  update public.job_units set
    current_stage = p_to,
    status = (case when p_to = 'dates_confirmed' then 'scheduled' else 'in_progress' end)::public.unit_status,
    -- the room leaves service at removal (D11 downtime)
    downtime_from = case when p_to = 'removal_pickup' then coalesce(downtime_from, now()) else downtime_from end
  where id = p_unit;

  insert into public.job_stage_events (job_id, job_unit_id, from_stage, to_stage, actor_id, note, is_backward, backward_reason)
  values (u.job_id, p_unit, u.current_stage, p_to, (select auth.uid()), p_note, v_back, nullif(trim(p_reason), ''));

  perform public.rollup_job(u.job_id);
end $$;

create or replace function public.link_to_pilot(p_job uuid, p_pilot uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_system_caller() and not public.current_role_is('super_admin') then
    raise exception 'Only a super_admin links projects' using errcode = '42501';
  end if;
  if not exists (select 1 from public.jobs p join public.jobs j on j.customer_id = p.customer_id
                 where p.id = p_pilot and p.is_pilot and j.id = p_job and j.id <> p.id) then
    raise exception 'The parent must be a pilot job of the same customer (BR-J6)' using errcode = '23514';
  end if;
  update public.jobs set parent_job_id = p_pilot where id = p_job;
end $$;

