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
| **Last updated** | 2026-09-28 — §10 quotations (build, discount gate, freeze-and-send, versions, OTP request) |

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
| E6-S03 | REVIEW | `book_survey()` + `available_surveyors()` (migration 000700) + `lib/surveys/book.ts`; UI waits for DS1. WhatsApp "survey booked" (E5) and CAPI `survey_booked` (E4-S10) hook in when those queues exist |
| E6-S04 … E6-S09 | TODO | |
</details>

<details><summary>E7 · QA & go-live (W8–W9) — 9 stories</summary>

E7-S01 … E7-S09 — all `TODO`
</details>

---

## Phase 2 — W10–W19

<details><summary>E8–E13 — 66 stories</summary>

| ID | Status | Notes |
|---|:--:|---|
| E10-S01 | REVIEW | Migration 000800: rate_cards, rate_card_items, market_prices + RLS |
| E10-S02 | REVIEW | Versions freeze on activation; `new_rate_card_version()`, `activate_rate_card()`; one active |
| E10-S03 | WIP | CSV parser/validator `lib/services/rate-card-csv.ts` done; editor UI (B27) + DB import wait for DS3 / D16 |
| E10-S04 | REVIEW | `upsert_assessment()` prices all three options server-side, idempotent per fitting |
| E10-S05 | REVIEW | `you_save` generated, null when not positive; `calculateYouSave()` mirrors it |
| E10-S06 | REVIEW | Manual override needs a reason; audited with actor |
| E10-S07, S08 | TODO | UI (C10 comparison, caveat copy) — Phase 2 screens |

Built early (Step 1 data foundation) — REDUX's real prices (A9) load as data, no code change.

| ID | Status | Notes |
|---|:--:|---|
| E11-S01 | REVIEW | Migration 000900: quotations, lines, approvals (append-only), discounts, quote_otps |
| E11-S02 | WIP | `create_quote_from_survey()` done; builder UI (B19) is Phase 2 screens |
| E11-S03 | REVIEW | `freeze_quote_for_issue()`: validity (IST) + terms snapshot; refuses until A10 is loaded |
| E11-S05 | WIP | `mark_quote_sent()` stores the PDF hash; rendering waits for the Gotenberg service (E0-S07 VPS) |
| E11-S08 | WIP | Request half done (`request_quote_otp`, `record_otp_delivery`); verify comes with §11 (BR-Q6) |
| E11-S09, S10 | TODO | `verify_quote_otp()` — evidence + customer + job in one transaction — needs §11 jobs |
| E11-S13 | WIP | `set_quote_discount()` / `decide_discount()` done; queue UI (B21) later |
| E11-S14 | REVIEW | Versions share quote_no; approved is final (BR-Q7) |
| E11-S15 | WIP | `expire_quotes()` done; pg_cron wiring + CN8 with E4-S01 / E5 |

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
| 2026-09-28 | Place of supply = the **property's** state; supplier state `settings.supplier_state_code` = 07 (Okhla, Delhi) | GST place of supply for services on immovable property is the property's location (IGST Act s.12(3)); BR-I4 says "recipient's state" — flag to REDUX's CA | E11-S01 |
| 2026-09-28 | Issue = `freeze_quote_for_issue()` → render PDF from frozen values → `mark_quote_sent(pdf_sha256)`; any draft change unfreezes | The PDF must show the exact dates/terms the customer approves (BR-Q4) | E11-S03/S05 |
| 2026-09-28 | Quotes refuse to issue until `settings.warranty_terms` (A10) exists | Don't invent warranty periods | E11-S03 |
| 2026-09-28 | OTP codes: 6 digits from `gen_random_bytes`, hash = sha256(otp_id:code); server-only functions | BR-Q5 / auth doc §1 — never stored, never client-issued | E11-S08 |
| 2026-09-28 | Rate cards and assessments built in Step 1 (data foundation), before Phase 2 | Build order Step 1 lists the whole schema; prices arrive later as data | E10 |
| 2026-09-28 | Assessments are priced **on the server** from the active card; the app sends only the recommendation | api-spec "server re-prices"; a surveyor cannot mis-price | E10-S04 |
| 2026-09-28 | `no_action` is priced at 0 with both alternatives still priced | BR-A2 "all three always priced" | E10-S04 |
| 2026-09-28 | Executives and customers cannot read rate cards or assessments | Roles matrix: pricing only on a quote | E10-S01 |
| 2026-09-28 | Survey slot = `settings.survey_slot_minutes` (120, from screen B6) | No hardcoded durations | E6-S03 |
| 2026-09-28 | Impossible travel threshold = `settings.impossible_travel_kmh` (150) — **placeholder, REDUX to confirm** | BR-S4 names no number | E9 |
| 2026-09-28 | "Nearest surveyor" = same city first, then least-loaded that day | Surveyors have no base location in the schema — open item below | E6-S03 |
| 2026-09-28 | Check-in flags (accuracy, mock, geofence, impossible travel) are computed by a BEFORE INSERT trigger; client values are overwritten | BR-S3/S4 "never silently trusted" | E9 |
| 2026-09-28 | Customers read their own surveys → fittings → photos (not prospects) | D13-03 before/after photos | E14 |
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
| 2026-09-28 | BR-S2 via exclusion constraint on `tstzrange(scheduled_at, slot_end_at)`; `slot_end_at` NOT NULL; `property_id` NOT NULL | Item 14; BR-S8 | migration 000700 |
| 2026-09-28 | No cascade under surveys; no delete policy on fittings / photos | Item 4, rule 8/9 | migration 000700 |
| 2026-09-28 | Photo visibility follows the survey (owner surveyor, lead's executive, admin, customer) | Item 5 / P2 | migration 000700 |
| 2026-09-28 | `survey_checkins` + `idem_key`, `received_at`; `fittings` must have a unit (id or label); photo sha256 format check | Offline outbox (ADR-006); data integrity | migration 000700 |
| 2026-09-28 | `guard_lead_status` now checks BR-L6 fully: survey_booked needs a live survey, surveyed a submitted one | BR-L6 | migration 000700 |
| 2026-09-28 | BR-S5 server-side enforcement moved to survey submit | Item 10 | BR doc |
| 2026-09-28 | `rate_cards.activated_at`; activated versions frozen (items, market prices, version, date) by trigger | D9-02 — schema.sql only had "one active" | migration 000800 |
| 2026-09-28 | `unique nulls not distinct` on rate_card_items / market_prices | NULL finish could be priced twice | migration 000800 |
| 2026-09-28 | `market_prices` + optional `finish_id` (lookup falls back to the finish-less row) | The CSV template carries a market price per finish; schema.sql keyed by fitting type only | migration 000800 |
| 2026-09-28 | `quotations`: unique (quote_no, version); `survey_id`, `customer_id`, `property_id` NOT NULL; place-of-supply + supplier state stored; completeness check once sent | Versions share a number; BR-S8; BR-I3-style reproducibility | migration 000900 |
| 2026-09-28 | `quotation_lines` + `price_replace_eurobrass`, per-line taxable/CGST/SGST/IGST | D8-02 on the quote; exact reproduction | migration 000900 |
| 2026-09-28 | New table `quote_otps` (OTP lifecycle, hashes only) | BR-Q5 needs attempts/expiry somewhere | migration 000900 |
| 2026-09-28 | **`audit_log.actor_id` → auth.users** (was profiles) | Customers have no profile; their audited actions would fail the FK | migration 000900 |
| 2026-09-28 | `assessments.you_save` generated (null = hidden); `updated_at`; no cascade from fittings | BR-A4 "hidden, never negative"; rule 8 | migration 000800 |

### Open review items (27 Sep 2026) — each fixed in the migration for its section

| # | Item | Fix in | Needs a decision? |
|---|---|---|---|
| 2 | *(partly closed: §1–9 written; surveyor reads active rate card in 000800)* ~40 tables in schema.sql have no policy; surveyors can't read `rate_cards` / `market_prices` | each section | no |
| 3 | ~~Fixed for quotes in 000900 (no user write policy; functions + trigger)~~ UPDATE policies without WITH CHECK (`quotations_update` can never reach `sent`) → state changes via SECURITY DEFINER RPCs | §10 | no |
| 4 | ~~Fixed in 000700~~ `on delete cascade` + `FOR ALL` lets a delete wipe `fitting_photos` / warranties | §8, §11 | no |
| 5 | ~~Fixed in 000700~~ `fitting_photos_select` lets every surveyor read every photo (breaks P2); `v_incomplete_fittings` bypasses RLS (gate now catches it) | §8 | no |
| 6 | ~~No survey address / location~~ **Decided → BR-S8**, implement in §7–8. anywhere; property needs a customer, which exists only after approval → "nearest surveyor", geofence and job_units all break | §5–8 | **yes — REDUX / PM** |
| 7 | Webhook idempotency `(source, external_id)` collides for WhatsApp statuses (same wamid) and Razorpay events (same payment.id) | §15 | no |
| 8 | ~~Fixed in 000400~~ BR-L3 trigger misses `campaign_id` (+ leadgen / google ids, utm) | §5 | no |
| 9 | BR-J2: clock keeps running while currently blocked; one block per unit | §11 | no |
| 10 | ~~Fixed in 000700 + BR doc~~ BR-S5 can't be enforced at fitting insert (photos FK the fitting) → enforce at submit / quote | §8, BR doc | no |
| 11 | ~~Decided + implemented in 000400~~ BR-L1: a repeat enquiry from a Won/Lost customer becomes a touch, never a new lead | §5 | **yes — REDUX / PM** |
| 12 | ~~Fixed in 000900~~ Customers can read their own draft quotes | §10 | no |
| 13 | ~~Fixed in 000500~~ `my_customer_id()` `limit 1` breaks when one phone is a contact for several customers | §7 | no |
| 14 | ~~Fixed in 000700~~ BR-S2 double-book index only catches identical start times | §8 | no |
| 15 | **Invoicing has no D-number**, yet D12 (Phase 2) promises "handover with invoice" | PRD / timeline | **yes — contract** |
| 16 | D2-10 (Won → customer + job) sits under Phase-1 D2 but depends on D10 | PRD | yes — minor |
| 17 | Source count: "six channels" / "7 sources" / 8 codes | PRD, D3 | yes — minor |
| 19 | ~~Decided → ADR-014~~ Two repos + CI-checked copy of `lib/services` vs one repo with `mobile/` | repo structure | **yes — tech lead** |
| 20 | **Surveyors have no base location** — "nearest surveyor" (D4-04) is approximated by city + load | profiles | **yes — REDUX / PM**: add a base pin per surveyor? |
| 21 | `impossible_travel_kmh` = 150 is a placeholder | settings | yes — REDUX |

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

2026-09-28  Migration 000700 (§8 surveys): book_survey, available_surveyors, check-in integrity
            trigger, submit_survey; items 4, 5, 10, 14 closed; BR-L6 complete. Broke a leads ↔
            surveys policy cycle with a SECURITY DEFINER helper. CI green first, then staging;
            114/114 pgTAP. lib/surveys/book.ts + validator. Two new open items (20, 21).
            Next: §9 assessments + §4 rate cards are Phase 2 (need REDUX's rate card, A9) — so
            either E1-S06…S09 app shell/login (needs DS1) or E4-S01 queue + webhooks (pgmq/pg_cron).

2026-09-28  Migration 000800 (§4 rate cards + §9 assessments): frozen versions, one active,
            server-side three-price assessment, overrides audited, you_save generated. Caught two
            test bugs (a volatile fn in WHERE reads the pre-write snapshot — one test was passing
            for the wrong reason). CI green → staging; 145/145 pgTAP; CSV parser + 9 unit tests.
            Next: §10 quotations + quote_approvals (BR-Q1…Q7), then §11 jobs.

2026-09-28  Migration 000900 (§10 quotations). Found + fixed: audit_log.actor_id → auth.users
            (customers have no profile). Tests caught my own fixture activating a rate card before
            adding prices (the freeze guard was right) and showed quote immutability holds at the
            RLS layer before the trigger — both layers now tested. CI green → staging; 185/185.
            Next: §11 jobs + verify_quote_otp() (BR-Q6 atomic approval → customer + job).

```
