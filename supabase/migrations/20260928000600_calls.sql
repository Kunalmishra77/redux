-- E6-S01, E6-S02 · schema.sql §6 — calls and call outcomes (D4-02, D4-03)
--
-- Deviations from schema.sql (task tracker → Deviations):
--   * calls.outcome (free text, "controlled list in app config") → outcome_id FK to a new
--     admin-editable master, call_outcomes. CLAUDE.md: no hardcoded lists.
--   * Calls are written only through log_call(), which also moves a 'new' lead to 'contacted'
--     when the outcome means somebody was actually spoken to.
--   * Recording fields are system-managed (D4-10 / BR-P4); nobody sets them by hand.

create table public.call_outcomes (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  name             text not null,
  marks_contacted  boolean not null default false,   -- a person was reached → lead 'contacted'
  requires_note    boolean not null default false,   -- D4-03: "with a reason where required"
  sort_order       int not null default 0,
  is_active        boolean not null default true
);

-- The outcomes named in the journeys (J3) plus "no answer", without which a calling queue cannot
-- work. Admin-editable (D16-03); REDUX can rename or extend.
insert into public.call_outcomes (code, name, marks_contacted, requires_note, sort_order) values
  ('interested',      'Interested',       true,  false, 10),
  ('call_back_later', 'Call back later',  true,  false, 20),
  ('not_interested',  'Not interested',   true,  false, 30),
  ('no_answer',       'No answer',        false, false, 40),
  ('other',           'Other',            false, true,  50)
on conflict (code) do nothing;

create table public.calls (
  id             uuid primary key default gen_random_uuid(),
  lead_id        uuid references public.leads(id),
  customer_id    uuid references public.customers(id),
  agent_id       uuid not null references public.profiles(id),
  direction      text not null check (direction in ('outbound','inbound')),
  started_at     timestamptz not null,
  ended_at       timestamptz,
  duration_sec   int generated always as
                   (case when ended_at is null then null
                         else greatest(0, extract(epoch from (ended_at - started_at))::int) end) stored,
  outcome_id     uuid references public.call_outcomes(id),
  outcome_note   text,
  provider_call_id text,
  -- consent: announcement played and the customer did not opt out (BR-P2)
  recording_consent boolean not null default false,
  recording_path text,                               -- private bucket
  recording_expires_at timestamptz,                  -- BR-P4: 90 days
  created_at     timestamptz not null default now(),
  constraint calls_has_subject check (lead_id is not null or customer_id is not null),
  constraint calls_end_after_start check (ended_at is null or ended_at >= started_at)
);
create index calls_lead_id_idx       on public.calls (lead_id);
create index calls_customer_id_idx   on public.calls (customer_id);
create index calls_agent_started_idx on public.calls (agent_id, started_at desc);
create index calls_agent_id_idx      on public.calls (agent_id);
create index calls_recording_exp_idx on public.calls (recording_expires_at) where recording_path is not null;
create unique index calls_provider_call_uq on public.calls (provider_call_id) where provider_call_id is not null;

alter table public.call_outcomes enable row level security;
alter table public.calls         enable row level security;

create trigger trg_audit_call_outcomes after insert or update or delete on public.call_outcomes
  for each row execute function public.write_audit();

-- ---------------------------------------------------------------------------
-- log_call(): D4-02/03 — one call, logged against a lead the caller owns, with an outcome.
-- Returns the call id.
-- ---------------------------------------------------------------------------
create or replace function public.log_call(p_call jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_claims  jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  v_role    text  := v_claims ->> 'user_role';
  v_caller  uuid  := nullif(v_claims ->> 'sub', '')::uuid;
  v_lead    public.leads%rowtype;
  v_outcome public.call_outcomes%rowtype;
  v_call_id uuid;
begin
  if v_role is null or v_role not in ('super_admin','cc_exec') or v_caller is null then
    raise exception 'Only care executives log calls' using errcode = '42501';
  end if;

  select * into v_lead from public.leads where id = (p_call ->> 'lead_id')::uuid for update;
  if not found then
    raise exception 'Lead not found' using errcode = 'P0002';
  end if;
  if v_role = 'cc_exec' and v_lead.assigned_to is distinct from v_caller then
    raise exception 'You can only log calls on your own leads (P3)' using errcode = '42501';
  end if;

  if p_call ? 'outcome' then
    select * into v_outcome from public.call_outcomes where code = p_call ->> 'outcome' and is_active;
    if not found then
      raise exception 'Unknown call outcome: %', p_call ->> 'outcome' using errcode = '22023';
    end if;
    -- D4-03: a reason where required
    if v_outcome.requires_note and coalesce(trim(p_call ->> 'outcome_note'), '') = '' then
      raise exception 'This outcome needs a note' using errcode = '23514';
    end if;
  end if;

  insert into public.calls (lead_id, agent_id, direction, started_at, ended_at,
                            outcome_id, outcome_note)
  values (
    v_lead.id, v_caller,
    coalesce(p_call ->> 'direction', 'outbound'),
    coalesce((p_call ->> 'started_at')::timestamptz, now()),
    (p_call ->> 'ended_at')::timestamptz,
    v_outcome.id,
    nullif(trim(p_call ->> 'outcome_note'), '')
  ) returning id into v_call_id;

  -- Reaching a person moves a new lead along the pipeline (D2-07)
  if v_outcome.marks_contacted and v_lead.status = 'new' then
    update public.leads set status = 'contacted' where id = v_lead.id;
  end if;

  return v_call_id;
end $$;
revoke execute on function public.log_call(jsonb) from public, anon;
grant execute on function public.log_call(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Policies (ADR-004). No INSERT policy on calls: log_call() is the only door.
-- Roles matrix: call recordings — super_admin all, cc_exec own calls.
-- ---------------------------------------------------------------------------
create policy call_outcomes_read_staff on public.call_outcomes for select to authenticated
  using ((select public.is_staff()));
create policy call_outcomes_write_admin on public.call_outcomes for all to authenticated
  using ((select public.current_role_is('super_admin')))
  with check ((select public.current_role_is('super_admin')));

create policy calls_select on public.calls for select to authenticated
  using ((select public.current_role_is('super_admin')) or agent_id = (select auth.uid()));
