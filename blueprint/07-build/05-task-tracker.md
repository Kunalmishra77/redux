# 05 — Task Tracker

**Claude Code: update this file as you work.** It is the running state of the build and the first
thing to read when resuming a session.

Story IDs come from `../06-delivery/05-backlog.md`.
Status: `TODO` · `WIP` · `REVIEW` · `DONE` · `BLOCKED`

---

## Current

| Field | Value |
|---|---|
| **Phase** | Phase 0 — Mobilisation |
| **Week** | W0 (5–9 Oct 2026) |
| **Sprint goal** | Accounts, approvals and infrastructure. Meta App Review submitted |
| **Last updated** | 2026-09-28 — §6 calls + §7 customers/properties/prospects (BR-S8) |

---

## Blocked — check before starting work

| ID | What | Blocked on | Since | Impact |
|---|---|---|---|---|
| E1-S03 | Custom Access Token Hook must be switched on in the hosted dashboard (Authentication → Hooks → Custom Access Token → `public.custom_access_token_hook`) | Project owner | 2026-09-27 | Until then no JWT carries `user_role` and every staff policy denies |
| E0-S08 | CI has never run — needs the first push to GitHub, then branch protection on `main` | Project owner | 2026-09-27 | Gates exist but are not yet enforced |

> A blocker sits here until it is resolved. If something is blocked on REDUX, it also goes to
> `../00-brief/04-assumptions-open-questions.md` §A and gets raised at the weekly call — not
> quietly parked.

---

## Phase 0 — W0

| ID | Story | Status | Notes |
|---|---|:--:|---|
| E0-S01 | Meta Business Verification | TODO | REDUX |
| E0-S02 | Meta app + System User + Leads Access | TODO | |
| E0-S03 | **Submit Meta App Review** | TODO | **critical path** |
| E0-S04 | WhatsApp number, WABA, display name | TODO | |
| E0-S05 | DLT Principal Entity + header | TODO | REDUX, biometric |
| E0-S06 | Razorpay KYC | TODO | REDUX |
| E0-S07 | Repos, Supabase, VPS, Cloudflare | WIP | Next 16.3.6 scaffold, GitHub repo, Supabase **staging** done. Production project, VPS, Coolify, Cloudflare pending |
| E0-S08 | CI gates | REVIEW | `.github/workflows/ci.yml` has all 7. Gates 1–3, 6 green locally; 4–5 green against staging via `pnpm db:test`; 7 runs only in CI (Docker) |
| E0-S09 | Sentry, uptime, alerts | TODO | |
| E0-S10 | Blueprint sign-off (D19) | TODO | |

---

## Phase 1 — W1–W9

<details><summary>E1 · Foundation (W1–W2) — 12 stories</summary>

| ID | Status | | ID | Status |
|---|:--:|---|---|:--:|
| E1-S01 | REVIEW | | E1-S07 | TODO |
| E1-S02 | REVIEW | | E1-S08 | TODO |
| E1-S03 | BLOCKED | | E1-S09 | TODO |
| E1-S04 | WIP | | E1-S10 | TODO |
| E1-S05 | REVIEW | | E1-S11 | REVIEW |
| E1-S06 | WIP | | E1-S12 | WIP |

- E1-S04: `my_customer_id()` ships with `customer_contacts` (§7) — its body references that table.
- E1-S06: bare scaffold only; `@theme` tokens and shadcn/ui wait for the DS1 designs.
- E1-S12: P4 + hook tests (25 pgTAP assertions). P1–P3 and P7 arrive with their tables.
- REVIEW = built and tested, waiting for review by someone who did not write it (DoD).
</details>

<details><summary>E2 · Website (W3–W4) — 16 stories</summary>

E2-S01 … E2-S16 — all `TODO`
</details>

<details><summary>E3 · Lead CRM (W4–W5) — 14 stories</summary>

| ID | Status | Notes |
|---|:--:|---|
| E3-S01 | REVIEW | Migration 000400: sources (8 seeded), campaigns, leads, touches, history, notes, follow-ups |
| E3-S02 | REVIEW | Leads RLS: no INSERT policy — `ingest_lead()` is the only door; P3 tested |
| E3-S03 | REVIEW | BR-L1 dedup in `ingest_lead()` (advisory lock per phone) + `lib/services/phone.ts` E.164 |
| E3-S04 | REVIEW | BR-L3 trigger now also guards campaign_id, leadgen/google ids, utm, raw_payload, phone |
| E3-S05 | REVIEW | BR-L4 `assign_lead()` by city → global round-robin; deactivation reassigns open leads |
| E3-S06 | WIP | SLA set at creation (BR-L5, tested); the sweep cron waits for pg_cron/pgmq (E4-S01) |
| E3-S07 … E3-S14 | TODO | UI — waits for DS1 designs and E1-S06…S09 |
</details>

<details><summary>E4 · Integrations (W5–W6) — 12 stories</summary>

E4-S01 … E4-S12 — all `TODO`
</details>

<details><summary>E5 · Notifications (W6) — 8 stories</summary>

E5-S01 … E5-S08 — all `TODO`
</details>

<details><summary>E6 · Care portal (W7) — 9 stories</summary>

| ID | Status | Notes |
|---|:--:|---|
| E6-S01 | WIP | Data layer done: `calls` + `log_call()` (migration 000600). Click-to-call provider not chosen yet; UI waits for DS1 |
| E6-S02 | REVIEW | `call_outcomes` master (admin-editable); required note enforced (D4-03) |
| E6-S03 | WIP | BR-S8 `ensure_prospect()` done (migration 000500); survey booking itself needs §8 surveys |
| E6-S04 … E6-S09 | TODO | |
</details>

<details><summary>E7 · QA & go-live (W8–W9) — 9 stories</summary>

E7-S01 … E7-S09 — all `TODO`
</details>

---

## Phase 2 — W10–W19

<details><summary>E8–E13 — 66 stories</summary>

E8 mobile foundation (9) · E9 survey capture (15) · E10 rate card & assessment (8) ·
E11 quotation & OTP (15) · E12 job tracking (11) · E13 QA & go-live (6) — all `TODO`
</details>

---

## Phase 3 — W20–W26

<details><summary>E14–E17 — 44 stories</summary>

E14 customer portal (18) · E15 super admin & stock (8) · E16 admin & reports (9) ·
E17 QA, go-live, handover (9) — all `TODO`
</details>

---

## Decisions made during the build

Anything decided that is not already in an ADR. If it contradicts an ADR, **write a new ADR** in
`../01-research/01-stack-decisions-adr.md` rather than diverging quietly.

| Date | Decision | Why | Story |
|---|---|---|---|
| 2026-09-27 | **ADR-013**: no Docker on dev PCs; Docker only in CI; local dev uses hosted staging | Team does not want Docker locally | E0-S07/08 |
| 2026-09-27 | pnpm is the package manager | Blueprint names none; pnpm already installed | E0-S07 |
| 2026-09-27 | Reference data (work types, condition flags, lost reasons, settings) seeded in **migrations**; `seed.sql` is CI fixtures only | `seed.sql` never runs on hosted projects, but the app depends on these codes | E1-S02 |
| 2026-09-27 | Kept Next's generated `AGENTS.md`; `CLAUDE.md` references it | It points agents at the Next 16.3 docs in `node_modules` | E0-S07 |
| 2026-09-27 | Gate 6 builds with `ci-canary-*` values in secret env vars and scans `.next/static` for names **and** values | Catches a leaked value even without the variable name | E0-S08 |
| 2026-09-27 | Local dev on Node 22; CI and images on Node 24 per ADR | Next 16 supports both | E0-S07 |
| 2026-09-27 | `pnpm db:test` runs pgTAP over a plain connection (`scripts/db-test.mjs`) | `supabase test db` needs Docker | E1-S12 |
| 2026-09-27 | **Item 6 → BR-S8**: a survey is booked against a property; booking creates a *prospect* customer + property, approval converts it | Address, "nearest surveyor", geofence and job_units all need a property before approval | §7–8 (E6-S03) |
| 2026-09-27 | **Item 11 → BR-L1 amended**: phone unique among open leads; after won/lost a new lead links via `previous_lead_id` | Returning customers must re-enter the pipeline and the dashboard | E3-S03 |
| 2026-09-27 | **Item 19 → ADR-014**: one repo, surveyor app in `mobile/` | Shared pricing logic identical by construction | E8 |
| 2026-09-27 | Leads enter only via `ingest_lead()` (SECURITY DEFINER), for every source | Dedup + assignment + SLA must be atomic and identical for web, webhooks and manual entry | E3-S03 |
| 2026-09-27 | Manual entry (call / walk-in) by a cc_exec is assigned to that executive, not round-robin | "With source and who took it" (PRD D3); the taker is already on the call | E3-S05 |
| 2026-09-28 | Calls are written only via `log_call()`; an outcome that reaches a person moves `new` → `contacted` | D2-07 pipeline stays truthful without a second click | E6-S01 |
| 2026-09-28 | Call outcomes seeded: interested, call back later, not interested (J3) + no answer + other | J3 names three; "no answer" is needed for any calling queue; admin-editable | E6-S02 |
| 2026-09-28 | cc_exec reads every **converted** customer (roles matrix: track job status) but a prospect only via their own lead | Keeps P3 intact for pre-sale data | E6-S03 |
| 2026-09-28 | `pnpm db:dry-run … --tests`: unpushed migrations + all pgTAP in one rolled-back transaction on staging | No Docker locally; CI logs are not readable without GitHub auth | ADR-013 |
| 2026-09-28 | CI runs on every branch push (was: PRs + main) | PRs cannot be opened from this machine; CI must be green before staging | E0-S08 |
| 2026-09-27 | survey_booked / surveyed / quoted / won are set only by system functions | BR-L6 and the Phase-2 flow own those transitions; a user UPDATE is rejected | E3-S01 |

---

## Deviations from the blueprint

When reality disagrees with the spec — and it will — record it here and update the spec. A
blueprint that silently stops matching the code is worse than no blueprint.

| Date | What changed | Why | Docs updated |
|---|---|---|---|
| 2026-09-27 | Access token hook: `supabase_auth_admin` grants + RLS policy on `user_roles`; execute revoked from other roles | Without them the hook reads no rows and stamps every staff user `customer` (review item 1) | migration 000200 |
| 2026-09-27 | Hook picks the role by enum order, not an unordered `limit 1` | `unique(user_id, role)` allows several roles | migration 000200 |
| 2026-09-27 | RLS enabled per table in each migration, not by the trailing loop | A loop only covers tables that exist when it runs | migrations |
| 2026-09-27 | `is_staff()` helper; policies call helpers as `(select fn())` | One definition of "staff"; ADR-004 rule 1 | migration 000200 |
| 2026-09-27 | `profiles` policies + `guard_profile_self_edit` trigger | schema.sql had none; self-edit must not change is_active/city/email | migration 000200 |
| 2026-09-27 | `write_audit()` reads id via jsonb (works on `settings`); attached to cities, profiles, role_permissions, masters, settings | schema.sql version fails on tables without uuid `id`; BR-X4 | migrations 000200/000300 |
| 2026-09-27 | `uuid-ossp` dropped; `pg_cron`/`pgmq` deferred to first use (E4) | Unused now | migration 000100 |
| 2026-09-27 | `lost_reasons.sort_order`; setting `gps_accuracy_flag_m = 50` | Ordered picker; BR-S3's 50 m must not be hardcoded | migration 000300 |
| 2026-09-27 | Environments: local = hosted staging, no Docker | ADR-013 | architecture §6, ADR doc |
| 2026-09-27 | `assignment_state` keyed by `scope` ('city:<uuid>' / 'global') instead of `city_id` PK | The no-city round-robin had nowhere to keep its pointer | migration 000400 |
| 2026-09-27 | `leads`: + `previous_lead_id`, `firm_gstin` (D1-04), phone CHECK (E.164); open-only phone uniqueness | Item 11 decision; dealer form; format enforced in DB too | migration 000400, BR-L1 |
| 2026-09-27 | Executives cannot change `sla_due_at`, `assigned_at`, `previous_lead_id` | Otherwise an SLA breach can be hidden by hand | migration 000400 |
| 2026-09-27 | Child tables of leads no longer `on delete cascade` | Leads are never deleted; a cascade would silently erase the timeline | migration 000400 |
| 2026-09-27 | Repo layout: one repo, `mobile/` | ADR-014 | repo-structure doc, ADR doc |
| 2026-09-28 | `customers.is_prospect` + `converted_at`; `properties.address` NOT NULL, lat/lng range + pair checks | BR-S8 | migration 000500 |
| 2026-09-28 | `my_customer_ids()` (array, prospects excluded) replaces `my_customer_id()` | Review item 13 | migration 000500 |
| 2026-09-28 | `calls.outcome` text → `outcome_id` FK to `call_outcomes`; `duration_sec` generated | No hardcoded lists; one source for duration | migration 000600 |
| 2026-09-28 | Seed data in migrations, not `seed.sql` | Hosted projects never run seed.sql | schema guide §5 |
| 2026-09-28 | Schema guide §2.1 "one lead per phone forever" → one open lead per phone | BR-L1 amendment | schema guide §2.1 |

### Open review items (27 Sep 2026) — each fixed in the migration for its section

| # | Item | Fix in | Needs a decision? |
|---|---|---|---|
| 2 | ~40 tables in schema.sql have no policy; surveyors can't read `rate_cards` / `market_prices` | each section | no |
| 3 | UPDATE policies without WITH CHECK (`quotations_update` can never reach `sent`) → state changes via SECURITY DEFINER RPCs | §10 | no |
| 4 | `on delete cascade` + `FOR ALL` lets a delete wipe `fitting_photos` / warranties | §8, §11 | no |
| 5 | `fitting_photos_select` lets every surveyor read every photo (breaks P2); `v_incomplete_fittings` bypasses RLS (gate now catches it) | §8 | no |
| 6 | ~~No survey address / location~~ **Decided → BR-S8**, implement in §7–8. anywhere; property needs a customer, which exists only after approval → "nearest surveyor", geofence and job_units all break | §5–8 | **yes — REDUX / PM** |
| 7 | Webhook idempotency `(source, external_id)` collides for WhatsApp statuses (same wamid) and Razorpay events (same payment.id) | §15 | no |
| 8 | ~~Fixed in 000400~~ BR-L3 trigger misses `campaign_id` (+ leadgen / google ids, utm) | §5 | no |
| 9 | BR-J2: clock keeps running while currently blocked; one block per unit | §11 | no |
| 10 | BR-S5 can't be enforced at fitting insert (photos FK the fitting) → enforce at submit / quote | §8, BR doc | no |
| 11 | ~~Decided + implemented in 000400~~ BR-L1: a repeat enquiry from a Won/Lost customer becomes a touch, never a new lead | §5 | **yes — REDUX / PM** |
| 12 | Customers can read their own draft quotes | §10 | no |
| 13 | ~~Fixed in 000500~~ `my_customer_id()` `limit 1` breaks when one phone is a contact for several customers | §7 | no |
| 14 | BR-S2 double-book index only catches identical start times | §8 | no |
| 15 | **Invoicing has no D-number**, yet D12 (Phase 2) promises "handover with invoice" | PRD / timeline | **yes — contract** |
| 16 | D2-10 (Won → customer + job) sits under Phase-1 D2 but depends on D10 | PRD | yes — minor |
| 17 | Source count: "six channels" / "7 sources" / 8 codes | PRD, D3 | yes — minor |
| 19 | ~~Decided → ADR-014~~ Two repos + CI-checked copy of `lib/services` vs one repo with `mobile/` | repo structure | **yes — tech lead** |

---

## Session log

Append one line per working session. This is how the next session (or the next person) picks up.

```
2026-09-27  Pre-mobilisation. Blueprint moved under blueprint/, git init. Read the blueprint and
            raised 19 review items (Deviations). ADR-013: no local Docker. Scaffolded Next 16.3.6 +
            React 19.3 (pnpm). CI workflow with all 7 gates. Migrations 000100–000300 (enums,
            identity/org + auth hook + audit, masters + settings) pushed to staging
            bkygjdzljfkkbkomujav; 25/25 pgTAP green via pnpm db:test; types generated.
            Next: owner enables the hook in the dashboard; CI's first run; decisions on items 6, 11,
            15, 19; then §5 leads (E3-S01) or E1-S06+ once DS1 lands.
2026-09-27  Decisions: item 6 → BR-S8, item 11 → BR-L1 amended, item 19 → ADR-014. Migration 000400
            (leads, §5) on staging; 55/55 pgTAP incl. 30 lead-rule tests; phone normaliser +
            lead validator + ingestLead() with 33 unit tests. Pushed to staging before CI ran —
            tests were green, but next time CI first (ADR-013).
            Next: §6 calls + §7 customers/properties (prospects, BR-S8), or E1-S06…S09 once DS1 lands.
2026-09-28  Migrations 000500 (customers/properties/units, prospects BR-S8, my_customer_ids) and
            000600 (call_outcomes, calls, log_call). First CI run failed gate 4: `= any ((select
            fn()))` parses as ANY(subquery) → uuid = uuid[]; fixed with an explicit ::uuid[] cast.
            Added pnpm db:dry-run --tests; 82/82 pgTAP green in a rolled-back transaction.
            Next: §8 surveys + survey booking (E6-S03) — completes BR-L6 and the surveyor side of RLS.

```
