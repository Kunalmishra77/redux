-- CR-001 phase 10 (E27, D33) — lifecycle reporting. One function per report tab, each returning the
-- figures as jsonb, so the screen and the CSV export read exactly the same numbers. Super Admin only.
-- Deviation (task tracker): plain functions, not materialised views — at today's volume each runs in
-- milliseconds; materialise the heavy ones when a query passes ~300 ms.

insert into public.settings (key, value, description) values
  ('outreach_message_cost_inr', '0.88', 'Phase 10: assumed cost of one WhatsApp marketing message when the provider has not reported it (cost per reactivation)')
on conflict (key) do nothing;

create or replace function public._report_guard()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.is_system_caller() or (select public.current_role_is('super_admin'))) then
    raise exception 'Reports are for the Super Admin' using errcode = '42501';
  end if;
end $$;
revoke execute on function public._report_guard() from public, anon;
grant execute on function public._report_guard() to authenticated;

-- approved order value per lead (the quotation that won it)
create or replace function public._lead_won_value(p_lead uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce(sum(total), 0) from public.quotations where lead_id = p_lead and status = 'approved';
$$;
revoke execute on function public._lead_won_value(uuid) from public, anon, authenticated;

-- ── leads by tier / segment / source (+ referral) / tier drift ─────────────
create or replace function public.report_tiers(p_since timestamptz)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  perform public._report_guard();
  with l as (
    select x.*, (x.status = 'won') as is_won, public._lead_won_value(x.id) as won_value,
           exists (select 1 from public.referrals r where r.referred_lead_id = x.id and r.status <> 'rejected') as referred
    from public.leads x where x.created_at >= p_since
  )
  select jsonb_build_object(
    'by_tier', coalesce((select jsonb_agg(t order by t.tier) from (
        select coalesce(tier, '—') as tier, count(*) as leads, count(*) filter (where is_won) as won,
               count(*) filter (where status = 'lost') as lost, sum(won_value) as won_value
        from l group by 1) t), '[]'),
    'by_segment', coalesce((select jsonb_agg(t order by t.leads desc) from (
        select coalesce(sg.name, 'Not set') as segment, count(*) as leads, count(*) filter (where is_won) as won, sum(won_value) as won_value
        from l left join public.segments sg on sg.id = l.segment_id group by 1) t), '[]'),
    'by_source', coalesce((select jsonb_agg(t order by t.leads desc) from (
        select s.name as source, count(*) as leads, count(*) filter (where referred) as referred,
               count(*) filter (where is_won) as won, sum(won_value) as won_value
        from l join public.lead_sources s on s.id = l.source_id group by 1) t), '[]'),
    'drift', coalesce((select jsonb_agg(t) from (
        select l.id as lead_id, coalesce(l.property_name, l.name) as lead, f.tier as first_tier, l.tier as tier_now
        from l join lateral (select ls.computed_tier as tier from public.lead_scores ls where ls.lead_id = l.id order by ls.created_at limit 1) f on true
        where l.tier is distinct from f.tier limit 25) t), '[]')
  ) into v;
  return v;
end $$;

-- ── assessments: mode mix, self-assessment turnaround, conversion by mode ─
create or replace function public.report_assessments(p_since timestamptz)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  perform public._report_guard();
  with s as (
    select x.*, (select min(q.created_at) from public.quotations q where q.survey_id = x.id) as first_quote_at,
           exists (select 1 from public.quotations q where q.survey_id = x.id and q.status = 'approved') as won,
           (select sum(q.total) from public.quotations q where q.survey_id = x.id and q.status = 'approved') as won_value
    from public.surveys x where x.created_at >= p_since and x.status <> 'cancelled'
  )
  select jsonb_build_object(
    'by_mode', coalesce((select jsonb_agg(t order by t.mode) from (
        select mode, count(*) as assessments, count(*) filter (where status = 'submitted') as completed,
               count(*) filter (where first_quote_at is not null) as quoted, count(*) filter (where won) as won,
               coalesce(sum(won_value), 0) as won_value
        from s group by mode) t), '[]'),
    'self_turnaround', (select jsonb_build_object(
        'reviewed', count(*) filter (where first_quote_at is not null),
        'median_hours', round((percentile_cont(0.5) within group (order by extract(epoch from first_quote_at - submitted_at) / 3600))::numeric, 1),
        'within_sla', count(*) filter (where first_quote_at <= review_due_at),
        'late', count(*) filter (where first_quote_at > review_due_at or (first_quote_at is null and review_due_at < now())),
        'waiting', count(*) filter (where review_status = 'awaiting'))
      from s where mode <> 'onsite' and submitted_at is not null)
  ) into v;
  return v;
end $$;

-- ── demos: funnel, investment, by type and tier ────────────────────────────
create or replace function public.report_demos(p_since timestamptz)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  perform public._report_guard();
  with d as (
    select x.*, t.name as type_name, c.tier
    from public.demos x join public.demo_types t on t.id = x.demo_type_id join public.customers c on c.id = x.customer_id
    where x.created_at >= p_since
  )
  select jsonb_build_object(
    'funnel', jsonb_build_object(
        'proposed', (select count(*) from d),
        'approved', (select count(*) from d where status not in ('proposed', 'rejected')),
        'done', (select count(*) from d where status in ('completed', 'converted', 'not_converted')),
        'converted', (select count(*) from d where status = 'converted')),
    'cost_total', (select coalesce(sum(internal_cost), 0) from d),
    'cost_per_converted', (select case when count(*) filter (where status = 'converted') > 0
                                       then round(coalesce(sum(internal_cost), 0) / count(*) filter (where status = 'converted'), 0) end from d),
    'converted_value', (select coalesce(sum(q.total), 0) from d join public.quotations q on q.id = d.converted_quote_id),
    'by_type', coalesce((select jsonb_agg(t order by t.type) from (
        select type_name as type, count(*) as demos, count(*) filter (where status in ('completed', 'converted', 'not_converted')) as done,
               count(*) filter (where status = 'converted') as converted, coalesce(sum(internal_cost), 0) as cost,
               round(avg(customer_rating), 1) as rating
        from d group by type_name) t), '[]'),
    'by_tier', coalesce((select jsonb_agg(t order by t.tier) from (
        select coalesce(tier, '—') as tier, count(*) as demos, count(*) filter (where status = 'converted') as converted
        from d group by 1) t), '[]')
  ) into v;
  return v;
end $$;

-- ── people: executives (leads) and surveyors / reviewers (assessments) ────
create or replace function public.report_people(p_since timestamptz)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  perform public._report_guard();
  select jsonb_build_object(
    'executives', coalesce((select jsonb_agg(t order by t.won_value desc) from (
        select p.full_name as person, count(*) as leads, count(*) filter (where l.status = 'won') as won,
               count(*) filter (where l.status = 'lost') as lost, sum(public._lead_won_value(l.id)) as won_value
        from public.leads l join public.profiles p on p.id = l.assigned_to
        where l.created_at >= p_since group by p.full_name) t), '[]'),
    'surveyors', coalesce((select jsonb_agg(t order by t.won_value desc) from (
        select p.full_name as person, count(*) as assessments, count(*) filter (where s.status = 'submitted') as completed,
               count(*) filter (where exists (select 1 from public.quotations q where q.survey_id = s.id and q.status = 'approved')) as won,
               coalesce(sum((select sum(q.total) from public.quotations q where q.survey_id = s.id and q.status = 'approved')), 0) as won_value
        from public.surveys s join public.profiles p on p.id = coalesce(s.surveyor_id, s.reviewer_id)
        where s.created_at >= p_since and s.status <> 'cancelled' group by p.full_name) t), '[]')
  ) into v;
  return v;
end $$;

-- ── accounts: repeat business, lifetime value, groups ──────────────────────
create or replace function public.report_accounts()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  perform public._report_guard();
  with q as (
    select customer_id, total, row_number() over (partition by customer_id order by created_at) as n
    from public.quotations where status = 'approved'
  ), a as (
    select c.id, c.name, c.group_id, s.lifetime_billed, s.lifetime_paid, s.approved_value, s.jobs_done,
           (select count(*) from q where q.customer_id = c.id) as orders,
           (select coalesce(sum(total), 0) from q where q.customer_id = c.id and q.n > 1) as repeat_value
    from public.customers c join public.v_account_summary s on s.customer_id = c.id
    where c.kind = 'business'
  )
  select jsonb_build_object(
    'repeat', jsonb_build_object(
        'customers', (select count(*) from a where orders >= 1),
        'repeat_customers', (select count(*) from a where orders >= 2),
        'repeat_value', (select coalesce(sum(repeat_value), 0) from a),
        'approved_value', (select coalesce(sum(approved_value), 0) from a)),
    'top_accounts', coalesce((select jsonb_agg(t) from (
        select id as customer_id, name as account, orders, jobs_done, approved_value, lifetime_billed, lifetime_paid
        from a where approved_value > 0 order by approved_value desc limit 15) t), '[]'),
    'groups', coalesce((select jsonb_agg(t order by t.approved_value desc) from (
        select g.name as group_name, count(a.id) as accounts, coalesce(sum(a.orders), 0) as orders,
               coalesce(sum(a.approved_value), 0) as approved_value, coalesce(sum(a.lifetime_billed), 0) as billed
        from public.customer_groups g left join a on a.group_id = g.id group by g.name) t), '[]')
  ) into v;
  return v;
end $$;

-- ── referrals ───────────────────────────────────────────────────────────────
create or replace function public.report_referrals(p_since timestamptz)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  perform public._report_guard();
  with r as (select * from public.referrals where created_at >= p_since and status <> 'rejected')
  select jsonb_build_object(
    'totals', jsonb_build_object(
        'referrals', (select count(*) from r),
        'converted', (select count(*) from r where status in ('converted', 'rewarded')),
        'first_order_value', (select coalesce(sum(first_order_value), 0) from r),
        'credit_issued', (select coalesce(sum(amount), 0) from public.rewards where kind = 'credit' and issued_at >= p_since),
        'credit_redeemed', (select coalesce(sum(x.amount), 0) from public.reward_redemptions x join public.rewards w on w.id = x.reward_id where w.kind = 'credit' and x.redeemed_at >= p_since),
        'free_fittings', (select count(*) from public.rewards where kind = 'free_fitting' and issued_at >= p_since)),
    'by_channel', coalesce((select jsonb_agg(t) from (select channel, count(*) as referrals, count(*) filter (where status in ('converted', 'rewarded')) as converted from r group by channel) t), '[]'),
    'top_referrers', coalesce((select jsonb_agg(t order by t.first_order_value desc, t.referrals desc) from (
        select c.name as referrer, count(*) as referrals, count(*) filter (where r.status in ('converted', 'rewarded')) as converted,
               coalesce(sum(r.first_order_value), 0) as first_order_value,
               (select coalesce(sum(w.amount), 0) from public.rewards w where w.customer_id = c.id and w.kind = 'credit') as credit
        from r join public.customers c on c.id = r.referrer_customer_id group by c.id, c.name limit 15) t), '[]')
  ) into v;
  return v;
end $$;

-- ── campaigns: delivery, replies, reactivations, revenue, cost ─────────────
create or replace function public.report_campaigns()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb; v_unit numeric := coalesce((select (value #>> '{}')::numeric from public.settings where key = 'outreach_message_cost_inr'), 0);
begin
  perform public._report_guard();
  select coalesce(jsonb_agg(t order by t.launched_at desc nulls last), '[]') into v from (
    select cp.id as campaign_id, cp.name as campaign, cp.channel, cp.launched_at,
           count(x.*) filter (where x.status <> 'skipped') as sent,
           count(x.*) filter (where x.status = 'skipped') as skipped,
           count(x.*) filter (where m.status in ('delivered', 'read')) as delivered,
           count(x.*) filter (where m.status = 'read') as read,
           count(x.*) filter (where x.status in ('replied', 'reactivated')) as replied,
           count(x.*) filter (where x.status = 'reactivated') as reactivated,
           count(x.*) filter (where x.status = 'opted_out') as opted_out,
           round(coalesce(sum(coalesce(m.cost_inr, case when m.id is not null and cp.channel = 'whatsapp' then v_unit end)), 0), 2) as cost,
           coalesce((select sum(q.total) from public.quotations q
                     where q.status = 'approved' and q.updated_at >= cp.launched_at
                       and (q.lead_id in (select y.reactivated_lead_id from public.outreach_recipients y where y.campaign_id = cp.id)
                            or q.customer_id in (select y.customer_id from public.outreach_recipients y where y.campaign_id = cp.id and y.status in ('replied', 'reactivated')))), 0) as revenue
    from public.outreach_campaigns cp
    left join public.outreach_recipients x on x.campaign_id = cp.id
    left join public.messages m on m.id = x.message_id
    where cp.status = 'sent'
    group by cp.id, cp.name, cp.channel, cp.launched_at
  ) t;
  return jsonb_build_object('campaigns', v);
end $$;

-- ── products: what is sold, by fitting type and work (catalog products once phase 7 lands) ──
create or replace function public.report_products(p_since timestamptz)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  perform public._report_guard();
  select coalesce(jsonb_agg(t order by t.value desc), '[]') into v from (
    select ft.name as fitting, w.name as work, count(*) as lines, coalesce(sum(l.qty), 0) as qty, coalesce(sum(l.line_total), 0) as value
    from public.quotation_lines l
    join public.quotations q on q.id = l.quotation_id and q.status = 'approved' and q.created_at >= p_since
    left join public.fittings f on f.id = l.fitting_id
    left join public.fitting_types ft on ft.id = f.fitting_type_id
    left join public.work_types w on w.id = l.work_type_id
    group by ft.name, w.name) t;
  return jsonb_build_object('products', v);
end $$;

do $$ declare f text; begin
  foreach f in array array['report_tiers(timestamptz)', 'report_assessments(timestamptz)', 'report_demos(timestamptz)', 'report_people(timestamptz)',
                           'report_accounts()', 'report_referrals(timestamptz)', 'report_campaigns()', 'report_products(timestamptz)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
