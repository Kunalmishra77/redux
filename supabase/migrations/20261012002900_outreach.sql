-- CR-001 phase 9 (E26, D32) — follow-up cadences, offers and outreach campaigns.
--   BR-C1 outreach only to contacts with live marketing consent, through an approved WhatsApp
--         MARKETING template or email; "STOP" withdraws consent
--   BR-C2 quiet hours and a per-contact frequency cap apply to every outreach message
--   BR-C3 the audience preview count equals the send count (same function)
--   BR-R5 an offer and a referral discount never stack — the larger single benefit applies
--   BR-L8 a lost lead that replies to a campaign is reopened; both events stay in its history
--
-- Existing `campaigns` are ad campaigns (Meta/Google); everything here is named outreach_*.
-- Cadences create executive tasks (follow_ups), never customer messages — a reminder sent on a
-- schedule is outreach and belongs to a campaign with its consent gate.

insert into public.settings (key, value, description) values
  ('outreach', '{"frequency_cap": 2, "cap_window_days": 7, "reply_window_days": 14}',
   'BR-C2: at most frequency_cap marketing messages per contact in cap_window_days; replies within reply_window_days count for the campaign')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Offers (BR-R5)
-- ---------------------------------------------------------------------------
create table public.offers (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique check (code ~ '^[A-Z0-9]{3,16}$'),
  title             text not null,
  description       text,
  discount_pct      numeric(5,2) not null check (discount_pct > 0 and discount_pct <= 50),
  valid_from        date not null default current_date,
  valid_until       date not null,
  eligible_tiers    text[] not null default '{A,B,C}',
  eligible_segments text[],                                   -- segment codes; null = any
  max_redemptions   int check (max_redemptions is null or max_redemptions > 0),
  is_active         boolean not null default true,
  created_by        uuid references public.profiles(id),
  created_at        timestamptz not null default now(),
  constraint offers_dates check (valid_until >= valid_from)
);
create trigger trg_audit_offers after insert or update or delete on public.offers
  for each row execute function public.write_audit();

alter table public.quotations
  add column offer_id           uuid references public.offers(id),
  add column offer_discount_pct numeric(5,2);
create index quotations_offer_idx on public.quotations (offer_id);

-- apply an offer to a draft quotation: eligibility, validity, cap, and no stacking
create or replace function public.apply_offer(p_quote uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare q public.quotations%rowtype; o public.offers%rowtype; c public.customers%rowtype; v_used int; v_seg text;
begin
  select * into q from public.quotations where id = p_quote for update;
  if not found then raise exception 'Quote not found' using errcode = 'P0002'; end if;
  if not public.can_edit_quote(p_quote) then raise exception 'Not your quote' using errcode = '42501'; end if;
  if q.status <> 'draft' then raise exception 'Only a draft takes an offer' using errcode = '22023'; end if;
  select * into o from public.offers where code = upper(trim(p_code)) and is_active;
  if not found then raise exception 'No active offer with that code' using errcode = '22023'; end if;
  if current_date not between o.valid_from and o.valid_until then raise exception 'That offer is not valid today' using errcode = '22023'; end if;
  select * into c from public.customers where id = q.customer_id;
  select code into v_seg from public.segments where id = c.segment_id;
  if c.tier is not null and not (c.tier = any (o.eligible_tiers)) then
    raise exception 'This offer is for tier % accounts', array_to_string(o.eligible_tiers, '/') using errcode = '23514';
  end if;
  if o.eligible_segments is not null and not (coalesce(v_seg, '') = any (o.eligible_segments)) then
    raise exception 'This offer is not for this kind of business' using errcode = '23514';
  end if;
  select count(*) into v_used from public.quotations where offer_id = o.id and status = 'approved';
  if o.max_redemptions is not null and v_used >= o.max_redemptions then
    raise exception 'This offer has been fully used' using errcode = '23514';
  end if;

  -- BR-R5: one benefit — the larger of the referral discount and the offer
  if coalesce(q.referral_discount_pct, 0) >= o.discount_pct then
    return jsonb_build_object('applied', false, 'reason', 'The referral discount is larger — it stays, and the offer is not added');
  end if;
  update public.quotations set offer_id = o.id, offer_discount_pct = o.discount_pct, discount_pct = o.discount_pct
  where id = p_quote;
  perform public.recompute_quote(p_quote);
  return jsonb_build_object('applied', true, 'discount_pct', o.discount_pct);
end $$;
revoke execute on function public.apply_offer(uuid, text) from public, anon;
grant execute on function public.apply_offer(uuid, text) to authenticated;

-- set_quote_discount: referral and offer percentages are pre-approved (redefinition; otherwise unchanged)
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
  v_threshold := greatest(v_threshold, coalesce(q.referral_discount_pct, 0), coalesce(q.offer_discount_pct, 0));   -- BR-R2, BR-R5

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
-- Follow-up cadences → executive tasks
-- ---------------------------------------------------------------------------
create table public.followup_cadences (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  tier       text check (tier in ('A', 'B', 'C')),             -- null = any tier
  on_status  public.lead_status not null,
  steps      jsonb not null check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) > 0),   -- [{day, note}]
  is_active  boolean not null default true,
  sort_order int not null default 0
);
create trigger trg_audit_followup_cadences after insert or update or delete on public.followup_cadences
  for each row execute function public.write_audit();
insert into public.followup_cadences (name, tier, on_status, steps, sort_order) values
  ('A-tier new enquiry', 'A', 'new', '[{"day":0,"note":"Call within 2 hours — high-value account"},{"day":1,"note":"Confirm the assessment and who decides"},{"day":3,"note":"Share a case study; mention the room demo"},{"day":7,"note":"Check the decision timeline"}]', 10),
  ('B-tier new enquiry', 'B', 'new', '[{"day":0,"note":"Call today; send the self-assessment link"},{"day":2,"note":"Remind about the self-assessment"},{"day":5,"note":"Follow up; offer a single-fitting demo if eligible"}]', 20),
  ('C-tier new enquiry', 'C', 'new', '[{"day":1,"note":"Call; offer a self-assessment"},{"day":7,"note":"Nurture check"},{"day":30,"note":"Re-check the need"}]', 30),
  ('Proposal sent', null, 'quoted', '[{"day":2,"note":"Follow up on the proposal"},{"day":5,"note":"Handle questions; offer a demo if eligible"},{"day":10,"note":"Last follow-up before the quote expires"}]', 40),
  ('Lost — reactivation', null, 'lost', '[{"day":90,"note":"Reactivation call — has anything changed?"}]', 50)
on conflict (name) do nothing;

alter table public.follow_ups add column cadence_id uuid references public.followup_cadences(id);
create index follow_ups_cadence_idx on public.follow_ups (cadence_id) where cadence_id is not null;

create table public.cadence_runs (
  lead_id    uuid not null references public.leads(id),
  cadence_id uuid not null references public.followup_cadences(id),
  started_at timestamptz not null default now(),
  primary key (lead_id, cadence_id)
);

-- a lead entering a status (with its tier) starts the matching cadence once
create or replace function public._start_cadence(p_lead uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare l public.leads%rowtype; cd public.followup_cadences%rowtype; n int;
begin
  select * into l from public.leads where id = p_lead;
  if l.assigned_to is null or l.tier is null then return 0; end if;
  select * into cd from public.followup_cadences
  where is_active and on_status = l.status and (tier is null or tier = l.tier)
  order by (tier is null), sort_order limit 1;
  if cd.id is null then return 0; end if;
  insert into public.cadence_runs (lead_id, cadence_id) values (l.id, cd.id) on conflict do nothing;
  if not found then return 0; end if;
  insert into public.follow_ups (lead_id, assigned_to, due_at, note, cadence_id)
  select l.id, l.assigned_to, now() + make_interval(days => (s ->> 'day')::int), s ->> 'note', cd.id
  from jsonb_array_elements(cd.steps) s;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public._start_cadence(uuid) from public, anon, authenticated;

-- leaving a stage closes the open tasks of earlier cadences; entering one starts its cadence
create or replace function public.on_lead_cadence() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    update public.follow_ups set completed_at = now()
    where lead_id = new.id and cadence_id is not null and completed_at is null
      and cadence_id not in (select id from public.followup_cadences where on_status = new.status);
  end if;
  perform public._start_cadence(new.id);
  return null;
end $$;
create trigger trg_lead_cadence after update of status, tier, assigned_to on public.leads
  for each row when (new.status is distinct from old.status or new.tier is distinct from old.tier or new.assigned_to is distinct from old.assigned_to)
  execute function public.on_lead_cadence();

-- ---------------------------------------------------------------------------
-- Outreach campaigns
-- ---------------------------------------------------------------------------
create table public.outreach_campaigns (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  channel       public.msg_channel not null check (channel in ('whatsapp', 'email')),
  template_code text not null references public.message_templates(code),
  offer_id      uuid references public.offers(id),
  audience      jsonb not null default '{}'::jsonb,
  status        text not null default 'draft' check (status in ('draft', 'scheduled', 'sent', 'cancelled')),
  scheduled_at  timestamptz,
  launched_at   timestamptz,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_outreach_campaigns_updated before update on public.outreach_campaigns
  for each row execute function public.set_updated_at();
create trigger trg_audit_outreach_campaigns after insert or update on public.outreach_campaigns
  for each row execute function public.write_audit();

create table public.outreach_recipients (
  id                  uuid primary key default gen_random_uuid(),
  campaign_id         uuid not null references public.outreach_campaigns(id),
  lead_id             uuid references public.leads(id),
  customer_id         uuid references public.customers(id),
  name                text,
  address             text not null,                         -- phone (E.164) or email
  status              text not null check (status in ('queued', 'skipped', 'replied', 'reactivated', 'opted_out')),
  skip_reason         text,
  message_id          uuid references public.messages(id),
  replied_at          timestamptz,
  reactivated_lead_id uuid references public.leads(id),
  created_at          timestamptz not null default now(),
  unique (campaign_id, address)
);
create index outreach_recipients_address_idx on public.outreach_recipients (address, created_at desc);
create index outreach_recipients_lead_idx on public.outreach_recipients (lead_id);
create index outreach_recipients_customer_idx on public.outreach_recipients (customer_id);
create index outreach_recipients_message_idx on public.outreach_recipients (message_id);

-- BR-C3: the one function behind both the preview and the launch.
-- p: {target: 'leads'|'accounts', tiers[], statuses[], lost_reason_ids[], segments[], city_ids[],
--     inactive_days, past_customers: bool, referrers: bool}
create or replace function public.resolve_audience(p jsonb, p_channel public.msg_channel)
returns table (lead_id uuid, customer_id uuid, name text, address text, eligible boolean, skip_reason text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_cap    int := coalesce((select (value ->> 'frequency_cap')::int from public.settings where key = 'outreach'), 2);
  v_window int := coalesce((select (value ->> 'cap_window_days')::int from public.settings where key = 'outreach'), 7);
  arr      text[];
begin
  if not (select public.is_staff()) and not public.is_system_caller() then
    raise exception 'Staff only' using errcode = '42501';
  end if;
  return query
  with base as (
    -- leads: the enquirer
    select l.id as lead_id, l.customer_id, coalesce(l.name, l.property_name) as name,
           case when p_channel = 'email' then l.email else l.phone end as address, l.phone,
           l.created_at as last_activity
    from public.leads l
    left join public.customers c on c.id = l.customer_id
    left join public.segments sg on sg.id = coalesce(l.segment_id, c.segment_id)
    where coalesce(p ->> 'target', 'leads') = 'leads'
      and (p -> 'tiers' is null or jsonb_array_length(p -> 'tiers') = 0 or l.tier = any (array(select jsonb_array_elements_text(p -> 'tiers'))))
      and (p -> 'statuses' is null or jsonb_array_length(p -> 'statuses') = 0 or l.status::text = any (array(select jsonb_array_elements_text(p -> 'statuses'))))
      and (p -> 'lost_reason_ids' is null or jsonb_array_length(p -> 'lost_reason_ids') = 0 or l.lost_reason_id::text = any (array(select jsonb_array_elements_text(p -> 'lost_reason_ids'))))
      and (p -> 'segments' is null or jsonb_array_length(p -> 'segments') = 0 or sg.code = any (array(select jsonb_array_elements_text(p -> 'segments'))))
      and (p -> 'city_ids' is null or jsonb_array_length(p -> 'city_ids') = 0 or l.city_id::text = any (array(select jsonb_array_elements_text(p -> 'city_ids'))))
      and (nullif(p ->> 'inactive_days', '') is null or l.updated_at < now() - make_interval(days => (p ->> 'inactive_days')::int))
    union all
    -- accounts: the primary active contact
    select null::uuid, c.id, cc.name,
           case when p_channel = 'email' then cc.email else cc.phone end, cc.phone,
           coalesce((select max(t.occurred_at) from public.v_account_timeline t where t.customer_id = c.id), c.created_at)
    from public.customers c
    join lateral (select x.name, x.phone, x.email from public.customer_contacts x
                  where x.customer_id = c.id and x.is_active order by x.is_primary desc, x.is_admin desc limit 1) cc on true
    left join public.segments sg on sg.id = c.segment_id
    where p ->> 'target' = 'accounts' and c.kind = 'business'
      and (p -> 'tiers' is null or jsonb_array_length(p -> 'tiers') = 0 or c.tier = any (array(select jsonb_array_elements_text(p -> 'tiers'))))
      and (p -> 'segments' is null or jsonb_array_length(p -> 'segments') = 0 or sg.code = any (array(select jsonb_array_elements_text(p -> 'segments'))))
      and (coalesce((p ->> 'past_customers')::boolean, false) is false or not c.is_prospect)
      and (coalesce((p ->> 'referrers')::boolean, false) is false or exists (select 1 from public.referrals r where r.referrer_customer_id = c.id and r.status <> 'rejected'))
  ), dedup as (
    select distinct on (coalesce(b.address, b.lead_id::text, b.customer_id::text)) b.*
    from base b
    where nullif(p ->> 'inactive_days', '') is null or p ->> 'target' <> 'accounts'
       or b.last_activity < now() - make_interval(days => (p ->> 'inactive_days')::int)
    order by coalesce(b.address, b.lead_id::text, b.customer_id::text), b.last_activity desc
  )
  select d.lead_id, d.customer_id, d.name, d.address,
         (d.address is not null
          and public.has_consent(d.phone, d.customer_id, 'marketing')
          and (select count(*) from public.messages m where m.category = 'marketing' and m.to_address = d.address
               and m.queued_at > now() - make_interval(days => v_window)) < v_cap) as eligible,
         case when d.address is null then case when p_channel = 'email' then 'no_email' else 'no_phone' end
              when not public.has_consent(d.phone, d.customer_id, 'marketing') then 'no_marketing_consent'
              when (select count(*) from public.messages m where m.category = 'marketing' and m.to_address = d.address
                    and m.queued_at > now() - make_interval(days => v_window)) >= v_cap then 'frequency_cap'
         end as skip_reason
  from dedup d;
end $$;
revoke execute on function public.resolve_audience(jsonb, public.msg_channel) from public, anon;
grant execute on function public.resolve_audience(jsonb, public.msg_channel) to authenticated;

create or replace function public.preview_audience(p jsonb, p_channel public.msg_channel)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'matched', count(*),
    'eligible', count(*) filter (where eligible),
    'no_marketing_consent', count(*) filter (where skip_reason = 'no_marketing_consent'),
    'frequency_cap', count(*) filter (where skip_reason = 'frequency_cap'),
    'no_address', count(*) filter (where skip_reason in ('no_email', 'no_phone')))
  from public.resolve_audience(p, p_channel);
$$;
revoke execute on function public.preview_audience(jsonb, public.msg_channel) from public, anon;
grant execute on function public.preview_audience(jsonb, public.msg_channel) to authenticated;

-- BR-C1 template gate: WhatsApp outreach only through an approved, active MARKETING template
create or replace function public.guard_outreach_template() returns trigger
language plpgsql security definer set search_path = '' as $$
declare t public.message_templates%rowtype;
begin
  select * into t from public.message_templates where code = new.template_code;
  if t.channel is distinct from new.channel then
    raise exception 'The template is for %, not %', t.channel, new.channel using errcode = '23514';
  end if;
  if t.category is distinct from 'marketing' or not t.is_active then
    raise exception 'Outreach uses an active marketing template — never a utility one (Meta reclassifies it)' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger trg_outreach_template before insert or update of template_code, channel on public.outreach_campaigns
  for each row execute function public.guard_outreach_template();

-- launch: resolve once, record every recipient (sent or skipped, with the reason), queue the sends
create or replace function public.launch_campaign(p_campaign uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  cp     public.outreach_campaigns%rowtype;
  o      public.offers%rowtype;
  r      record;
  v_when timestamptz := public.next_send_time(now());   -- BR-C2 quiet hours
  v_msg  uuid;
  v_sent int := 0;
  v_skip int := 0;
begin
  if not (public.is_system_caller() or (select public.current_role_is('super_admin'))) then
    raise exception 'Only the Super Admin launches a campaign' using errcode = '42501';
  end if;
  select * into cp from public.outreach_campaigns where id = p_campaign for update;
  if not found then raise exception 'Campaign not found' using errcode = 'P0002'; end if;
  if cp.status not in ('draft', 'scheduled') then raise exception 'This campaign has already gone out' using errcode = '22023'; end if;
  if cp.offer_id is not null then select * into o from public.offers where id = cp.offer_id; end if;

  for r in select * from public.resolve_audience(cp.audience, cp.channel) loop
    if r.eligible then
      insert into public.messages (rule_code, template_code, channel, category, to_address, lead_id, customer_id,
                                   entity_type, entity_id, variables, send_after, dedup_key)
      values (null, cp.template_code, cp.channel, 'marketing', r.address, r.lead_id, r.customer_id,
              'outreach_campaigns', cp.id,
              jsonb_build_object('name', split_part(coalesce(r.name, 'there'), ' ', 1), 'offer', o.title, 'code', o.code,
                                 'discount', case when o.id is not null then trim(to_char(o.discount_pct, 'FM990.##')) || '%' end,
                                 'until', to_char(o.valid_until, 'DD Mon YYYY')),
              v_when, 'OC:' || cp.id || ':' || r.address)
      on conflict (dedup_key) do nothing
      returning id into v_msg;
      if v_msg is not null and cp.channel = 'whatsapp' then
        perform pgmq.send('q_notifications', jsonb_build_object('message_id', v_msg), greatest(0, extract(epoch from (v_when - now()))::int));
      end if;
      insert into public.outreach_recipients (campaign_id, lead_id, customer_id, name, address, status, message_id)
      values (cp.id, r.lead_id, r.customer_id, r.name, r.address, 'queued', v_msg) on conflict do nothing;
      v_sent := v_sent + 1;
    else
      insert into public.outreach_recipients (campaign_id, lead_id, customer_id, name, address, status, skip_reason)
      values (cp.id, r.lead_id, r.customer_id, r.name, coalesce(r.address, 'none:' || coalesce(r.lead_id, r.customer_id)), 'skipped', r.skip_reason)
      on conflict do nothing;
      v_skip := v_skip + 1;
    end if;
  end loop;
  update public.outreach_campaigns set status = 'sent', launched_at = now() where id = cp.id;
  return jsonb_build_object('queued', v_sent, 'skipped', v_skip);
end $$;
revoke execute on function public.launch_campaign(uuid) from public, anon;
grant execute on function public.launch_campaign(uuid) to authenticated;

-- scheduled campaigns go out when due (cron, installed with the worker)
create or replace function public.launch_due_campaigns()
returns int language plpgsql security definer set search_path = '' as $$
declare v_id uuid; n int := 0;
begin
  for v_id in select id from public.outreach_campaigns where status = 'scheduled' and scheduled_at <= now() loop
    perform public.launch_campaign(v_id); n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.launch_due_campaigns() from public, anon, authenticated;

create or replace function public.install_schedules()
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform cron.schedule('meta_lead_reconcile', '*/15 * * * *', 'select public.enqueue_meta_reconcile()');
  perform cron.schedule('sla_sweep',           '*/5 * * * *',  'select public.sweep_sla()');
  perform cron.schedule('job_delay_sweep',     '0 * * * *',    'select public.sweep_job_delays()');
  perform cron.schedule('integration_health',  '*/30 * * * *', 'select public.check_integration_health()');
  perform cron.schedule('quote_expiry',        '30 3 * * *',   'select public.expire_quotes()');     -- 09:00 IST
  perform cron.schedule('lead_rescore',        '30 21 * * *',  'select public.rescore_open_leads()'); -- 03:00 IST
  perform cron.schedule('self_assessment_sla', '*/15 * * * *', 'select public.sweep_self_assessment_sla()');
  perform cron.schedule('outreach_due',        '*/5 * * * *',  'select public.launch_due_campaigns()');
end $$;
revoke execute on function public.install_schedules() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Replies: STOP withdraws marketing consent (BR-C1); any other reply to a recent campaign counts,
-- and a lost lead that replies is reopened (BR-L8) with the campaign as a touch.
-- ---------------------------------------------------------------------------
create or replace function public.on_inbound_whatsapp_outreach() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_phone  text;
  v_days   int := coalesce((select (value ->> 'reply_window_days')::int from public.settings where key = 'outreach'), 14);
  rc       record;
  l        public.leads%rowtype;
begin
  select '+' || ltrim(wa_id, '+') into v_phone from public.whatsapp_conversations where id = new.conversation_id;
  if v_phone is null then return null; end if;

  if coalesce(new.body, '') ~* '^\s*(stop|unsubscribe|stop all|band karo|band)\s*[.!]*\s*$' then
    perform public.withdraw_consent('marketing', v_phone, null);
    update public.consent_records set withdrawn_at = now()
    where purpose = 'marketing' and withdrawn_at is null and granted
      and customer_id in (select customer_id from public.customer_contacts where phone = v_phone);
    update public.outreach_recipients set status = 'opted_out', replied_at = now()
    where address = v_phone and status in ('queued', 'replied');
    return null;
  end if;

  for rc in select x.* from public.outreach_recipients x
            where x.address = v_phone and x.status = 'queued' and x.created_at > now() - make_interval(days => v_days)
            order by x.created_at desc limit 1 loop
    update public.outreach_recipients set status = 'replied', replied_at = now() where id = rc.id;
    select * into l from public.leads
    where (id = rc.lead_id or (rc.lead_id is null and phone = v_phone)) and status = 'lost'
    order by created_at desc limit 1;
    if l.id is not null then
      update public.leads set status = 'contacted', lost_reason_id = null, lost_note = null where id = l.id;   -- BR-L8 reopen
      insert into public.lead_touches (lead_id, source_id, payload)
      values (l.id, (select id from public.lead_sources where code = 'whatsapp_campaign'),
              jsonb_build_object('outreach_campaign_id', rc.campaign_id, 'reply', left(new.body, 300)));
      update public.outreach_recipients set status = 'reactivated', reactivated_lead_id = l.id where id = rc.id;
      perform public.notify_team('TN22', 'Lost lead replied to a campaign', coalesce(l.property_name, l.name, v_phone) || ': ' || left(coalesce(new.body, ''), 120),
        'leads', l.id, 'TN22:' || l.id || ':' || rc.campaign_id, l.assigned_to);
    end if;
  end loop;
  return null;
end $$;
create trigger trg_inbound_whatsapp_outreach after insert on public.whatsapp_messages
  for each row when (new.direction = 'inbound') execute function public.on_inbound_whatsapp_outreach();

-- ---------------------------------------------------------------------------
-- Templates and rules
-- ---------------------------------------------------------------------------
insert into public.notification_rules (code, trigger_event, template_code, channel, category, audience, is_active, quiet_hours) values
  ('TN22', 'outreach_reactivated', null, 'in_app', null, 'assigned_cc', true, false)
on conflict (code) do nothing;
-- MARKETING templates: Meta approval required before production use (approved_at stays null here)
insert into public.message_templates (code, channel, category, language, body, variables, is_active) values
  ('outreach_reactivation', 'whatsapp', 'marketing', 'en',
   E'Hello {{1}},\n\nIt has been a while since we spoke about your bathroom fittings. Restoring them with REDUX costs a fraction of replacing — and this month {{2}}: {{3}} off with code {{4}}, until {{5}}.\n\nReply YES and we will call you. Reply STOP to stop these messages.',
   '["name","offer","discount","code","until"]'::jsonb, true),
  ('outreach_restore_season', 'whatsapp', 'marketing', 'en',
   E'Hello {{1}},\n\nBefore the season starts, get your rooms'' taps and mixers restored with REDUX — a free assessment first, no obligation.\n\nReply YES to book. Reply STOP to stop these messages.',
   '["name"]'::jsonb, true),
  ('outreach_referral_invite', 'whatsapp', 'marketing', 'en',
   E'Hello {{1}},\n\nThank you for working with REDUX. Know another hotel or business that should restore, not replace? Share your referral link from your REDUX portal — they get a discount on their first order and you earn credit.\n\nReply STOP to stop these messages.',
   '["name"]'::jsonb, true),
  ('email_reactivation', 'email', 'marketing', 'en',
   E'Subject: {{2}} — restore your bathroom fittings\n\nHello {{1}},\n\nRestoring your existing taps, mixers and showers with REDUX costs a fraction of replacing them. Until {{5}}, take {{3}} off with code {{4}}.\n\nReply to this email or call us to book a free assessment.\n\nTo stop these emails, reply UNSUBSCRIBE.',
   '["name","offer","discount","code","until"]'::jsonb, true)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Policies (ADR-004)
-- ---------------------------------------------------------------------------
alter table public.offers              enable row level security;
alter table public.followup_cadences   enable row level security;
alter table public.cadence_runs        enable row level security;
alter table public.outreach_campaigns  enable row level security;
alter table public.outreach_recipients enable row level security;

create policy offers_read on public.offers for select to authenticated using ((select public.is_staff()));
create policy offers_write on public.offers for all to authenticated
  using ((select public.current_role_is('super_admin'))) with check ((select public.current_role_is('super_admin')));
create policy followup_cadences_read on public.followup_cadences for select to authenticated using ((select public.is_staff()));
create policy followup_cadences_write on public.followup_cadences for all to authenticated
  using ((select public.current_role_is('super_admin'))) with check ((select public.current_role_is('super_admin')));
create policy cadence_runs_read on public.cadence_runs for select to authenticated
  using ((select public.is_staff()) and exists (select 1 from public.leads l where l.id = cadence_runs.lead_id));
create policy outreach_campaigns_read on public.outreach_campaigns for select to authenticated
  using ((select public.current_role_is('super_admin')) or (select public.current_role_is('cc_exec')));
create policy outreach_campaigns_write on public.outreach_campaigns for all to authenticated
  using ((select public.current_role_is('super_admin'))) with check ((select public.current_role_is('super_admin')));
create policy outreach_recipients_read on public.outreach_recipients for select to authenticated
  using ((select public.current_role_is('super_admin')) or (select public.current_role_is('cc_exec')));

-- open enquiries already in a cadence stage start theirs now (demo data and existing leads)
do $$ declare v_id uuid; begin
  for v_id in select id from public.leads where status in ('new', 'quoted') and tier is not null and assigned_to is not null loop
    perform public._start_cadence(v_id);
  end loop;
end $$;
