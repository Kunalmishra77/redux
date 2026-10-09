-- CR-001 phase 6 (E23, D29) — referrals and rewards.
--   BR-R1 a referral is its own dimension, separate from the lead source
--   BR-R2 the referred business gets 5% off its first order, pre-approved
--   BR-R3 the referrer earns credit = 5% of that first order when it is paid, and one free fitting
--         ("extra fit") for every 3 converted referrals
--   BR-R4 branches of the same chain may refer each other; an account cannot refer itself
--   BR-R5 no stacking — the larger single benefit applies (offers arrive in phase 9; the quote keeps
--         one discount, so a referral discount never adds to another)
--   BR-R6 rewards are an append-only ledger; a reward is redeemed once, against a quotation or invoice
--
-- Deviation (task tracker): the programme's numbers live in one setting (`referral_programme`)
-- instead of separate referral_benefits / reward_rules tables — one benefit and two reward rules
-- today; tables when a second programme exists.

insert into public.settings (key, value, description) values
  ('referral_programme', '{"referred_discount_pct": 5, "referrer_credit_pct": 5, "free_fitting_every": 3, "reward_validity_days": 365}',
   'BR-R2/R3: referred business discount on the first order; referrer credit % of that order when paid; a free fitting every N converted referrals; reward validity')
on conflict (key) do nothing;

create or replace function public.referral_setting(p_key text)
returns numeric language sql stable security definer set search_path = '' as $$
  select (value ->> p_key)::numeric from public.settings where key = 'referral_programme';
$$;

-- ---------------------------------------------------------------------------
-- Codes and referrals
-- ---------------------------------------------------------------------------
create table public.referral_codes (
  code        text primary key check (code ~ '^[A-Z0-9]{4,12}$'),
  customer_id uuid not null unique references public.customers(id),
  created_at  timestamptz not null default now()
);

-- one code per account, made on first ask: letters from the name + 3 digits (no 0/O/1/I confusion)
create or replace function public.referral_code_for(p_customer uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_code text; v_base text; n int := 0;
begin
  select code into v_code from public.referral_codes where customer_id = p_customer;
  if v_code is not null then return v_code; end if;
  if not ((select public.is_staff()) or p_customer = any (public.my_customer_ids()) or public.is_system_caller()) then
    raise exception 'Not your account' using errcode = '42501';
  end if;
  select upper(left(regexp_replace(regexp_replace(name, '^(hotel|the)\s+', '', 'i'), '[^A-Za-z]', '', 'g'), 5)) into v_base
  from public.customers where id = p_customer;
  if v_base is null then raise exception 'Account not found' using errcode = 'P0002'; end if;
  v_base := translate(rpad(coalesce(nullif(v_base, ''), 'REDUX'), 4, 'X'), 'OI', 'QJ');
  loop
    v_code := v_base || (200 + floor(random() * 700))::int;
    begin
      insert into public.referral_codes (code, customer_id) values (v_code, p_customer);
      return v_code;
    exception when unique_violation then
      n := n + 1;
      if n > 20 then raise; end if;
      select code into v_code from public.referral_codes where customer_id = p_customer;   -- a parallel call made it
      if v_code is not null then return v_code; end if;
    end;
  end loop;
end $$;
revoke execute on function public.referral_code_for(uuid) from public, anon;
grant execute on function public.referral_code_for(uuid) to authenticated;

create table public.referrals (
  id                    uuid primary key default gen_random_uuid(),
  referrer_customer_id  uuid not null references public.customers(id),
  referred_lead_id      uuid references public.leads(id),
  referred_customer_id  uuid references public.customers(id),
  channel               text not null check (channel in ('code', 'link', 'registration', 'manual')),
  status                text not null default 'pending' check (status in ('pending', 'converted', 'rewarded', 'rejected')),
  first_quote_id        uuid references public.quotations(id),
  first_order_value     numeric(12,2),                          -- taxable value of the first approved order
  converted_at          timestamptz,
  rejected_reason       text,
  created_by            uuid references public.profiles(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint referrals_has_referred check (referred_lead_id is not null or referred_customer_id is not null),
  constraint referrals_not_self check (referred_customer_id is distinct from referrer_customer_id),       -- BR-R4
  constraint referrals_rejected_reason check (status <> 'rejected' or length(trim(rejected_reason)) > 0)
);
create unique index referrals_one_per_lead on public.referrals (referred_lead_id) where status <> 'rejected' and referred_lead_id is not null;
create unique index referrals_one_per_account on public.referrals (referred_customer_id) where status <> 'rejected' and referred_customer_id is not null;
create index referrals_referrer_idx on public.referrals (referrer_customer_id);
create index referrals_status_idx on public.referrals (status);
create trigger trg_referrals_updated before update on public.referrals
  for each row execute function public.set_updated_at();
create trigger trg_audit_referrals after insert or update on public.referrals
  for each row execute function public.write_audit();

-- ---------------------------------------------------------------------------
-- The ledger (BR-R6)
-- ---------------------------------------------------------------------------
create table public.rewards (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),          -- who holds it (the referrer)
  referral_id uuid references public.referrals(id),
  kind        text not null check (kind in ('credit', 'free_fitting')),
  amount      numeric(12,2) check ((kind = 'credit') = (amount is not null and amount > 0)),
  milestone   int,                                                     -- free fitting: the Nth conversion
  description text not null,
  issued_at   timestamptz not null default now(),
  expires_at  timestamptz not null,
  unique (referral_id, kind),
  unique (customer_id, kind, milestone)
);
create index rewards_customer_idx on public.rewards (customer_id);
create trigger trg_rewards_append_only before update or delete on public.rewards
  for each row execute function public.forbid_change();

create table public.reward_redemptions (
  id           uuid primary key default gen_random_uuid(),
  reward_id    uuid not null unique references public.rewards(id),      -- BR-R6: once
  quotation_id uuid references public.quotations(id),
  invoice_id   uuid references public.invoices(id),
  payment_id   uuid references public.payments(id),
  amount       numeric(12,2),
  note         text,
  redeemed_by  uuid references public.profiles(id),
  redeemed_at  timestamptz not null default now(),
  constraint reward_redemptions_against check (quotation_id is not null or invoice_id is not null)
);
create index reward_redemptions_quote_idx on public.reward_redemptions (quotation_id);
create index reward_redemptions_invoice_idx on public.reward_redemptions (invoice_id);
create trigger trg_reward_redemptions_append_only before update or delete on public.reward_redemptions
  for each row execute function public.forbid_change();

create view public.v_rewards with (security_invoker = true) as
select r.*, x.redeemed_at, x.quotation_id, x.invoice_id,
       case when x.id is not null then 'redeemed' when r.expires_at < now() then 'expired' else 'available' end as status
from public.rewards r left join public.reward_redemptions x on x.reward_id = r.id;

-- ---------------------------------------------------------------------------
-- Capture (BR-R1)
-- ---------------------------------------------------------------------------
-- staff record a referral by hand, or the system resolves a code
create or replace function public._record_referral(p_lead uuid, p_customer uuid, p_referrer uuid, p_channel text, p_actor uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_referrer is null then return null; end if;
  if p_customer is not distinct from p_referrer then
    raise exception 'An account cannot refer itself' using errcode = '23514';    -- BR-R4
  end if;
  insert into public.referrals (referrer_customer_id, referred_lead_id, referred_customer_id, channel, created_by)
  values (p_referrer, p_lead, p_customer, p_channel, p_actor)
  on conflict do nothing
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public._record_referral(uuid, uuid, uuid, text, uuid) from public, anon, authenticated;

create or replace function public.record_referral(p_referrer uuid, p_lead uuid default null, p_customer uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_customer uuid := p_customer; v_id uuid;
begin
  if not (select public.current_role_is('super_admin')) and not ((select public.current_role_is('cc_exec'))
          and (exists (select 1 from public.leads where id = p_lead and assigned_to = (select auth.uid())) or public.can_work_account(p_customer))) then
    raise exception 'Only the executive or the Super Admin records a referral' using errcode = '42501';
  end if;
  if v_customer is null and p_lead is not null then select customer_id into v_customer from public.leads where id = p_lead; end if;
  if exists (select 1 from public.referrals where status <> 'rejected'
             and (referred_lead_id = p_lead or referred_customer_id = v_customer)) then
    raise exception 'This business already has a referral on record' using errcode = '23505';
  end if;
  v_id := public._record_referral(p_lead, v_customer, p_referrer, 'manual', (select auth.uid()));
  if p_lead is not null then perform public._score_lead(p_lead); end if;
  return v_id;
end $$;
revoke execute on function public.record_referral(uuid, uuid, uuid) from public, anon;
grant execute on function public.record_referral(uuid, uuid, uuid) to authenticated;

create or replace function public.reject_referral(p_referral uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (select public.current_role_is('super_admin')) then
    raise exception 'Only the Super Admin rejects a referral' using errcode = '42501';
  end if;
  update public.referrals set status = 'rejected', rejected_reason = trim(p_reason)
  where id = p_referral and status = 'pending';
  if not found then raise exception 'Only a pending referral can be rejected' using errcode = '22023'; end if;
end $$;
revoke execute on function public.reject_referral(uuid, text) from public, anon;
grant execute on function public.reject_referral(uuid, text) to authenticated;

-- a new enquiry carrying a code (the /r/{code} link, or typed into "referred by") is a referral
create or replace function public.on_lead_referral_code() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_code text; v_referrer uuid; v_channel text;
begin
  v_code := upper(nullif(trim(coalesce(new.raw_payload ->> 'referral_code', '')), ''));
  v_channel := 'link';
  if v_code is null then
    v_code := upper(nullif(trim(coalesce(new.raw_payload ->> 'referred_by', '')), ''));
    v_channel := case when new.raw_payload ->> 'form' = 'registration' then 'registration' else 'code' end;
  end if;
  if v_code is null then return null; end if;
  select customer_id into v_referrer from public.referral_codes where code = v_code;
  if v_referrer is null or v_referrer is not distinct from new.customer_id then return null; end if;   -- free text stays for the review queue
  if exists (select 1 from public.referrals where status <> 'rejected'
             and (referred_lead_id = new.id or referred_customer_id = new.customer_id)) then return null; end if;
  perform public._record_referral(new.id, new.customer_id, v_referrer, v_channel, null);
  return null;
end $$;
-- runs before the scoring trigger (alphabetical: trg_lead_referral < trg_lead_score) so the score sees it
create trigger trg_lead_referral_code after insert on public.leads
  for each row execute function public.on_lead_referral_code();

-- the referred business's account becomes known later (registration, booking): keep it on the referral
create or replace function public.on_lead_account_for_referral() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.referrals set referred_customer_id = new.customer_id
  where referred_lead_id = new.id and referred_customer_id is null and status <> 'rejected'
    and referrer_customer_id <> new.customer_id;
  update public.referrals set status = 'rejected', rejected_reason = 'Self-referral: the referrer is the same account'
  where referred_lead_id = new.id and referrer_customer_id = new.customer_id and status = 'pending';
  return null;
end $$;
create trigger trg_lead_account_referral after update of customer_id on public.leads
  for each row when (new.customer_id is not null and old.customer_id is distinct from new.customer_id)
  execute function public.on_lead_account_for_referral();

-- scoring: a recorded referral counts, not only the free text (redefinition of 002200; body otherwise unchanged)
create or replace function public._score_lead(p_lead uuid, p_actor uuid default null, p_force boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  l       public.leads%rowtype;
  c       public.customers%rowtype;
  v_loc   jsonb;
  v_in    jsonb;
  v_res   jsonb;
  v_tier  text;
  v_last  public.lead_scores%rowtype;
begin
  select * into l from public.leads where id = p_lead;
  if not found then raise exception 'Lead not found' using errcode = 'P0002'; end if;
  if l.customer_id is not null then select * into c from public.customers where id = l.customer_id; end if;
  v_loc := public.locate(l.pincode, l.city_id);
  v_in := jsonb_build_object(
    'units', coalesce(l.estimated_units, l.unit_count, c.size_units),
    'value', l.estimated_value,
    'segment', (select code from public.segments where id = coalesce(l.segment_id, c.segment_id)),
    'source', (select code from public.lead_sources where id = l.source_id),
    'distance_band', v_loc ->> 'band',
    'group_member', c.group_id is not null,
    'repeat_customer', c.id is not null and not c.is_prospect and c.converted_at is not null and c.converted_at < l.created_at,
    'referral', length(trim(coalesce(l.raw_payload ->> 'referred_by', ''))) > 0
                or exists (select 1 from public.referrals r where r.status <> 'rejected'
                           and (r.referred_lead_id = l.id or (l.customer_id is not null and r.referred_customer_id = l.customer_id))));
  v_res := public.evaluate_score(v_in);
  v_tier := coalesce(l.tier_override, v_res ->> 'tier');

  select * into v_last from public.lead_scores where lead_id = p_lead order by created_at desc limit 1;
  if p_force or v_last.id is null or v_last.score <> (v_res ->> 'score')::int or v_last.tier <> v_tier
     or v_last.distance_band <> (v_loc ->> 'band') or v_last.override_reason is distinct from l.tier_override_reason then
    insert into public.lead_scores (lead_id, score, computed_tier, tier, breakdown, inputs, rules_version, distance_band, scored_by, override_reason)
    values (p_lead, (v_res ->> 'score')::int, v_res ->> 'tier', v_tier, v_res -> 'breakdown', v_in,
            coalesce((select (value #>> '{}')::int from public.settings where key = 'scoring_rules_version'), 1),
            v_loc ->> 'band', p_actor, case when l.tier_override is not null then l.tier_override_reason end);
  end if;

  update public.leads set score = (v_res ->> 'score')::int, tier = v_tier, distance_band = v_loc ->> 'band',
    distance_km = (v_loc ->> 'km')::numeric, scored_at = now()
  where id = p_lead;
  if l.customer_id is not null and l.status not in ('won', 'lost') then
    update public.customers set tier = v_tier where id = l.customer_id and tier is distinct from v_tier;
  end if;
  perform public._decide_assessment(p_lead);
  return v_res || jsonb_build_object('final_tier', v_tier, 'distance', v_loc);
end $$;
revoke execute on function public._score_lead(uuid, uuid, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- BR-R2: the referred business's first quotation carries the pre-approved discount
-- ---------------------------------------------------------------------------
alter table public.quotations
  add column referral_id          uuid references public.referrals(id),
  add column referral_discount_pct numeric(5,2);
create index quotations_referral_idx on public.quotations (referral_id);

create or replace function public.on_quote_referral_benefit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_ref uuid; v_pct numeric := coalesce(public.referral_setting('referred_discount_pct'), 0);
begin
  if v_pct <= 0 then return null; end if;
  select r.id into v_ref from public.referrals r
  where r.status = 'pending'
    and (r.referred_customer_id = new.customer_id
         or r.referred_lead_id in (select id from public.leads where customer_id = new.customer_id))
  limit 1;
  -- first order only: nothing approved for this account yet
  if v_ref is null or exists (select 1 from public.quotations where customer_id = new.customer_id and status = 'approved') then
    return null;
  end if;
  -- BR-R5: one discount on the quote — the referral never adds to a bigger one already there
  update public.quotations set referral_id = v_ref, referral_discount_pct = v_pct,
    discount_pct = greatest(discount_pct, v_pct)
  where id = new.id;
  return null;
end $$;
create trigger trg_quote_referral_benefit after insert on public.quotations
  for each row when (new.status = 'draft') execute function public.on_quote_referral_benefit();

-- set_quote_discount: the referral's percentage is pre-approved (redefinition; otherwise unchanged)
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
  v_threshold := greatest(v_threshold, coalesce(q.referral_discount_pct, 0));   -- BR-R2

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

-- ---------------------------------------------------------------------------
-- BR-R3: conversion, credit on payment, a free fitting every N conversions
-- ---------------------------------------------------------------------------
create or replace function public.on_quote_approved_referral() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r public.referrals%rowtype; v_every int := coalesce(public.referral_setting('free_fitting_every'), 0)::int;
        v_days int := coalesce(public.referral_setting('reward_validity_days'), 365)::int; v_n int;
begin
  select * into r from public.referrals x
  where x.status = 'pending'
    and (x.referred_customer_id = new.customer_id or x.referred_lead_id in (select id from public.leads where customer_id = new.customer_id))
  limit 1;
  if r.id is null then return null; end if;
  update public.referrals set status = 'converted', first_quote_id = new.id, first_order_value = new.taxable_value,
    converted_at = now(), referred_customer_id = coalesce(referred_customer_id, new.customer_id)
  where id = r.id;

  -- one free fitting for every N converted referrals by this referrer
  select count(*) into v_n from public.referrals where referrer_customer_id = r.referrer_customer_id and status in ('converted', 'rewarded');
  if v_every > 0 and v_n % v_every = 0 then
    insert into public.rewards (customer_id, referral_id, kind, milestone, description, expires_at)
    values (r.referrer_customer_id, null, 'free_fitting', v_n,
            'One free fitting restoration — ' || v_n || ' businesses you referred have ordered', now() + make_interval(days => v_days))
    on conflict do nothing;
    perform public.notify_team('TN21', 'Referral reward: free fitting', (select name from public.customers where id = r.referrer_customer_id),
      'customers', r.referrer_customer_id, 'TN21:' || r.referrer_customer_id || ':' || v_n);
  end if;
  return null;
end $$;
create trigger trg_quote_approved_referral after update of status on public.quotations
  for each row when (new.status = 'approved' and old.status is distinct from 'approved')
  execute function public.on_quote_approved_referral();

create or replace function public.on_invoice_paid_referral() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r public.referrals%rowtype; v_pct numeric := coalesce(public.referral_setting('referrer_credit_pct'), 0);
        v_days int := coalesce(public.referral_setting('reward_validity_days'), 365)::int; v_amt numeric; c record;
begin
  select * into r from public.referrals where first_quote_id = new.quotation_id and status = 'converted';
  if r.id is null or v_pct <= 0 then return null; end if;
  v_amt := round(coalesce(r.first_order_value, 0) * v_pct / 100, 2);
  if v_amt > 0 then
    insert into public.rewards (customer_id, referral_id, kind, amount, description, expires_at)
    values (r.referrer_customer_id, r.id, 'credit', v_amt,
            v_pct || '% of the first order of ' || coalesce((select name from public.customers where id = r.referred_customer_id), 'a business you referred'),
            now() + make_interval(days => v_days))
    on conflict do nothing;
    select * into c from public.customer_contact(r.referrer_customer_id);
    perform public.notify_customer('CN24', c.phone, null, r.referrer_customer_id, 'referrals', r.id,
      jsonb_build_object('name', split_part(c.name, ' ', 1), 'amount', public.inr(v_amt),
                         'business', coalesce((select name from public.customers where id = r.referred_customer_id), 'A business you referred')),
      'CN24:' || r.id);
  end if;
  update public.referrals set status = 'rewarded' where id = r.id;
  return null;
end $$;
create trigger trg_invoice_paid_referral after update of status on public.invoices
  for each row when (new.status = 'paid' and old.status is distinct from 'paid')
  execute function public.on_invoice_paid_referral();

-- ---------------------------------------------------------------------------
-- BR-R6: redeem once. A credit settles part of an issued invoice of the same account (recorded as a
-- payment by 'reward_credit', so the tax invoice itself never changes); a free fitting is recorded
-- against the quotation it is given on.
-- ---------------------------------------------------------------------------
create or replace function public.redeem_reward(p_reward uuid, p_invoice uuid, p_quotation uuid, p_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare rw public.rewards%rowtype; i public.invoices%rowtype; v_pay uuid; v_amt numeric; v_paid numeric; v_id uuid;
begin
  if not (select public.current_role_is('super_admin')) then
    raise exception 'Only the Super Admin redeems rewards' using errcode = '42501';
  end if;
  select * into rw from public.rewards where id = p_reward for update;
  if not found then raise exception 'Reward not found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.reward_redemptions where reward_id = rw.id) then
    raise exception 'This reward has already been used' using errcode = '23505';
  end if;
  if rw.expires_at < now() then raise exception 'This reward has expired' using errcode = '22023'; end if;

  if rw.kind = 'credit' then
    select * into i from public.invoices where id = p_invoice for update;
    if not found or i.customer_id <> rw.customer_id then
      raise exception 'Choose an invoice of the same account' using errcode = '22023';
    end if;
    if i.status not in ('issued', 'part_paid') then raise exception 'Only an issued, unpaid invoice takes a credit' using errcode = '22023'; end if;
    v_amt := least(rw.amount, i.total - i.amount_paid);
    insert into public.payments (invoice_id, provider, provider_payment_id, method, amount, status, captured_at)
    values (i.id, 'reward_credit', rw.id::text, 'credit', v_amt, 'captured', now())
    returning id into v_pay;
    select coalesce(sum(amount) filter (where status = 'captured'), 0) - coalesce(sum(amount) filter (where status = 'refunded'), 0)
    into v_paid from public.payments where invoice_id = i.id;
    update public.invoices set amount_paid = greatest(v_paid, 0),
      status = case when v_paid >= total then 'paid' when v_paid > 0 then 'part_paid' else 'issued' end::public.invoice_status
    where id = i.id;
    insert into public.reward_redemptions (reward_id, invoice_id, payment_id, amount, note, redeemed_by)
    values (rw.id, i.id, v_pay, v_amt, nullif(trim(p_note), ''), (select auth.uid()))
    returning id into v_id;
  else
    if not exists (select 1 from public.quotations where id = p_quotation and customer_id = rw.customer_id) then
      raise exception 'Choose a quotation of the same account' using errcode = '22023';
    end if;
    insert into public.reward_redemptions (reward_id, quotation_id, note, redeemed_by)
    values (rw.id, p_quotation, coalesce(nullif(trim(p_note), ''), 'One fitting restored free'), (select auth.uid()))
    returning id into v_id;
  end if;
  return v_id;
end $$;
revoke execute on function public.redeem_reward(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.redeem_reward(uuid, uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- The portal's view of the programme — safe columns only
-- ---------------------------------------------------------------------------
create or replace function public.my_referrals()
returns table (id uuid, business text, status text, created_at timestamptz, converted_at timestamptz, credit numeric)
language sql stable security definer set search_path = '' as $$
  select r.id, coalesce(c.name, l.property_name, l.name, 'A business you referred'),
         case r.status when 'rewarded' then 'converted' else r.status end, r.created_at, r.converted_at,
         (select w.amount from public.rewards w where w.referral_id = r.id and w.kind = 'credit')
  from public.referrals r
  left join public.customers c on c.id = r.referred_customer_id
  left join public.leads l on l.id = r.referred_lead_id
  where r.referrer_customer_id = any (public.my_customer_ids()) and r.status <> 'rejected'
  order by r.created_at desc;
$$;
revoke execute on function public.my_referrals() from public, anon;
grant execute on function public.my_referrals() to authenticated;

create or replace function public.my_rewards()
returns table (id uuid, kind text, amount numeric, description text, issued_at timestamptz, expires_at timestamptz, status text, redeemed_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.id, r.kind, r.amount, r.description, r.issued_at, r.expires_at,
         case when x.id is not null then 'redeemed' when r.expires_at < now() then 'expired' else 'available' end, x.redeemed_at
  from public.rewards r left join public.reward_redemptions x on x.reward_id = r.id
  where r.customer_id = any (public.my_customer_ids())
  order by r.issued_at desc;
$$;
revoke execute on function public.my_rewards() from public, anon;
grant execute on function public.my_rewards() to authenticated;

-- ---------------------------------------------------------------------------
-- Messages
-- ---------------------------------------------------------------------------
insert into public.notification_rules (code, trigger_event, template_code, channel, category, audience, is_active, quiet_hours) values
  ('TN21', 'referral_reward_issued', null, 'in_app', null, 'admin', true, false),
  ('CN24', 'referral_credit_issued', 'referral_credit', 'whatsapp', 'utility', 'customer', true, true)
on conflict (code) do nothing;
-- utility: an account update about a balance, no offer language
insert into public.message_templates (code, channel, category, language, body, variables, is_active) values
  ('referral_credit', 'whatsapp', 'utility', 'en',
   E'Hello {{1}},\n\n{{2}} has been added to your REDUX account as referral credit for {{3}}. It is applied to your next invoice; you can see it under Referrals in your portal.',
   '["name","amount","business"]'::jsonb, true)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Policies (ADR-004): staff-only tables; customers use the functions above.
-- ---------------------------------------------------------------------------
alter table public.referral_codes     enable row level security;
alter table public.referrals          enable row level security;
alter table public.rewards            enable row level security;
alter table public.reward_redemptions enable row level security;

create policy referral_codes_select on public.referral_codes for select to authenticated
  using ((select public.is_staff()) or customer_id = any ((select public.my_customer_ids())::uuid[]));
create policy referrals_select on public.referrals for select to authenticated
  using ((select public.current_role_is('super_admin'))
         or ((select public.current_role_is('cc_exec'))
             and (public.staff_can_see_customer(referrer_customer_id) or public.staff_can_see_customer(referred_customer_id)
                  or exists (select 1 from public.leads l where l.id = referrals.referred_lead_id))));
create policy rewards_select on public.rewards for select to authenticated
  using ((select public.current_role_is('super_admin'))
         or ((select public.current_role_is('cc_exec')) and public.staff_can_see_customer(customer_id)));
create policy reward_redemptions_select on public.reward_redemptions for select to authenticated
  using (exists (select 1 from public.rewards r where r.id = reward_redemptions.reward_id));

-- CN13 is for money received; a reward credit settling part of an invoice is not one
create or replace function public.on_payment_captured() returns trigger
language plpgsql security definer set search_path = '' as $$
declare i public.invoices%rowtype; c record;
begin
  if new.provider = 'reward_credit' then return null; end if;
  select * into i from public.invoices where id = new.invoice_id;
  select * into c from public.customer_contact(i.customer_id);
  perform public.notify_customer('CN13', c.phone, null, i.customer_id, 'invoices', i.id,
    jsonb_build_object('name', split_part(c.name, ' ', 1), 'amount', public.inr(new.amount), 'invoice_no', i.invoice_no),
    'CN13:' || new.id);
  return null;
end $$;
