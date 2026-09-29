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
| **Last updated** | 2026-09-29 — full client demo on demo data: staff CRM, admin, customer portal, surveyor app (website finishing) |

---

## Blocked — check before starting work

| ID | What | Blocked on | Since | Impact |
|---|---|---|---|---|
| E0-S08 | Branch protection on `main` (CI itself runs green on every push) | Project owner | 2026-09-27 | Gates run but are not yet enforced on merge |

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

| ID | Status | Notes |
|---|:--:|---|
| E2-S10 | REVIEW | DB + server: `ingest_lead_with_consent()` (atomic), `consentSchema`, `ingestLead(…, consent)`. Form UI with the website |
| E2-S06 | WIP | `v_marketing_photos` + `set_photo_marketing_use()` enforce BR-P3; gallery page later |
| others | TODO | Website pages — need DS1 designs |
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

| ID | Status | Notes |
|---|:--:|---|
| E4-S01 | REVIEW | Migration 001400 + `worker/`: pgmq drained one transaction per message; dead-letter + TN5. Container (Dockerfile.worker) with the VPS work (E0-S07) |
| E4-S02 | REVIEW | `/api/webhooks/meta`: handshake + raw-body HMAC + record; worker fetches the lead from Graph |
| E4-S03 | REVIEW | `mapMetaLead()`; custom questions only via `lead_form_field_map` |
| E4-S04 | REVIEW | `reconcileMetaLeads()` (forms from integration_accounts.config.form_ids); scheduled by `install_schedules()` |
| E4-S05, S06 | REVIEW | `/api/webhooks/whatsapp`; conversations + inbox; CTWA referral / ctwa_clid on the lead at creation |
| E4-S07 | REVIEW | A reply to one of our templates → `whatsapp_campaign` source |
| E4-S08 | REVIEW | `/api/webhooks/google-ads`: never 4XX, key never stored, test data dropped |
| E4-S09 | REVIEW | Manual entry via `ingest_lead()` (E3) |
| E4-S10 | WIP | `capi_events` fire once per lead on survey_booked / job_won (queued on q_capi); the Graph API call is the worker's |
| E4-S11 | WIP | `integration_accounts.last_event_at` + `check_integration_health()` (TN5); screen B10 later |
| E4-S12 | REVIEW | Idempotency: SQL tests (item 7), handler unit tests, `pnpm worker:smoke` on staging (rolled back) |
</details>

<details><summary>E5 · Notifications (W6) — 8 stories</summary>

| ID | Status | Notes |
|---|:--:|---|
| E5-S01 | REVIEW | `messages` outbox, `message_templates`, `notification_rules` (CN1–18, TN1–15 seeded), `team_notifications` |
| E5-S02 | REVIEW | Worker sends approved templates via Graph; retries/backoff; outbound joins the inbox thread |
| E5-S03 | TODO | MSG91 SMS via the Supabase Send SMS Hook (needs DLT) |
| E5-S04 | REVIEW | Dedup keys, quiet hours (held to 09:00 IST), rule toggles; retry policy set (3) — applied by the worker |
| E5-S05 | TODO | Template bodies + Meta submission (copy in 05-content) |
| E5-S06 | REVIEW | CN1 on lead creation; CN2 on survey booking (DB side) |
| E5-S07 | REVIEW | TN1 (assign/reassign), TN3 breach + TN4 follow-ups via `sweep_sla()`, TN5 health; TN2 "due soon" needs a threshold — open item 24 |
| E5-S08 | REVIEW | `notification_rules.is_active` honoured; admin screen later |
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
| E11-S08 | REVIEW | `request_quote_otp`, `record_otp_delivery`, `verify_quote_otp` (attempts kept, lockout, expiry). Route handlers + sending wait for E5 |
| E11-S09 | REVIEW | Full evidence set written by `verify_quote_otp()`; tested field by field |
| E11-S10 | REVIEW | Approval → quote approved + customer converted + lead won + job + units, atomically (tested by forcing a mid-way failure) |

| ID | Status | Notes |
|---|:--:|---|
| E12-S01 | REVIEW | Migration 001000: jobs, batches, units, unit_blocks, stage events, handovers, after-photos, warranties |
| E12-S05 | REVIEW | `move_unit_stage()`: one forward, back with a reason, never by hand |
| E12-S06 | REVIEW | `block_unit()` / `unblock_unit()`; `unit_effective_downtime_hours()` subtracts every block, open ones to now |
| E12-S07 | WIP | `v_delayed_units` done; TN10 alert with E5 |
| E12-S08 | REVIEW | `link_to_pilot()`. Rate inheritance for the wider project is a quote-time feature (E11 UI) — not built |
| E12-S09 | WIP | `record_handover()` + after-photos table; capture UI (C12/B25) later |
| E12-S10 | REVIEW | Warranty cards at handover from the quote's snapshot; kind per work type — **REDUX to confirm** (item 22) |
| E12-S02…S04, S11 | TODO | Screens and notifications |
| E11-S13 | WIP | `set_quote_discount()` / `decide_discount()` done; queue UI (B21) later |
| E11-S14 | REVIEW | Versions share quote_no; approved is final (BR-Q7) |
| E11-S15 | WIP | `expire_quotes()` done; pg_cron wiring + CN8 with E4-S01 / E5 |

E8 mobile foundation (9) · E9 survey capture (15) · E10 rate card & assessment (8) ·
E11 quotation & OTP (15) · E12 job tracking (11) · E13 QA & go-live (6) — all `TODO`
</details>

---

## Phase 3 — W20–W26

<details><summary>E14–E17 — 44 stories</summary>

| ID | Status | Notes |
|---|:--:|---|
| E14-S07 | REVIEW | Migration 001100: invoice_series, invoices, lines, payments, credit_notes |
| E14-S08 | REVIEW | `create_invoice_from_job()` from the approved quote; Rule 46 fields stored; issue refuses until A11 loaded |
| E14-S09 | REVIEW | `allocate_document_no()`: per series per FY, row-locked, allocated at issue — gap-free, 1 April reset. Concurrency (P8) proven by the lock; a true multi-session test is still to add |
| E14-S12 | WIP | DB half: `record_payment()` server-only, idempotent. Route handler + signature check with E4 |
| E14-S18 | REVIEW | `cancel_invoice()` → full credit note from its own series; partial credit notes not built |
| E14-S10, S11 | TODO | Razorpay Payment Link / Smart Collect calls — `payment_route` is already decided per invoice |
| E14-S16 | WIP | DSR queue + 30-day clock + `erasure_blockers()`; **erasure execution blocked on item 25**; export/correct screens later |
| E14-S15 | REVIEW | Migration 001300: `raise_service_request()` (ownership-checked), `progress_service_request()` forward-only, 48 h / 1 month clock, overdue view. Screens later |
| E15-S06 | REVIEW | Migration 001200: stock items, append-only movements, `record_stock_movement()`; screens B31/B32 later |
| E15-S07 | REVIEW | Never negative; once-per-crossing alert into `stock_alerts` (TN13 outbox), re-arms |
| E15-S08 | REVIEW | Consumption must name a job; usage per job queryable |

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
| 2026-09-28 | Worker = Node + `pg` directly (not PostgREST): pgmq is its own schema and a claim-less session is the system for `is_system_caller()`. Runs with `tsx` (path aliases shared with the app) | One copy of the mappers/validators for app and worker | E4-S01 |
| 2026-09-28 | Provider contracts are pure functions (`lib/webhooks/handlers.ts`), routes only adapt Request/Response | Unit-testable without HTTP or a DB | E4-S02 |
| 2026-09-28 | Meta/WhatsApp bad signature → 401, nothing stored; Google wrong key → 200 and stored unverified | Google never gets a 4XX; Meta forgeries aren't worth storing | E4-S02/S08 |
| 2026-09-28 | Unusable events (no phone, no invoice note, unknown source) dead-letter at once with TN5 | Retrying cannot fix them | E4-S01 |
| 2026-09-28 | `pnpm worker:smoke`: real worker against staging in one rolled-back transaction | End-to-end proof without Docker or test data left behind | E4-S12 |
| 2026-09-28 | Consent ledger: one append-only row per purpose, pointing at the notice row shown; only withdrawn_at ever changes | BR-P1/P2 | E2-S10 |
| 2026-09-28 | Web/dealer enquiries without service consent are rejected in the DB | D1-06 required checkbox — not just a UI rule | E2-S10 |
| 2026-09-28 | Recording purge queues the file in `storage_deletions`; the worker deletes via the Storage API | Never raw SQL on storage.objects | E6-S08 |
| 2026-09-28 | DSR response clock 30 days; GST retention setting 8 years (72 months from annual-return due date, CGST s.36) — **CA to confirm** | Blueprint: "an SLA clock", "GST 6 years+" | E14-S16 |
| 2026-09-28 | **pg_cron schedules are NOT installed by migration** — `install_schedules()` is called when the worker is deployed | With no worker, queued customer messages would go out days late | E4-S01 |
| 2026-09-28 | Cron work that needs HTTP (Meta reconcile) is a queue message for the worker; no pg_net | One place does HTTP; retries and logging stay in the worker | E4-S04 |
| 2026-09-28 | webhook_events.external_id = provider event id (Razorpay event id, Google lead_id) else sha256(raw body) | Item 7 | E4-S12 |
| 2026-09-28 | Unsigned webhooks stored as `dead` for audit, never queued | Audit trail without processing; Google still gets 200 | E4-S08 |
| 2026-09-28 | Webhook retries: 6 attempts, exponential backoff 30 s → 30 min cap, then dead-letter + TN5 | ADR-008 "dead-letters after N" — N was unspecified | E4-S01 |
| 2026-09-28 | Stock alerts written to `stock_alerts` (an outbox) until the notification queue (E5) exists | BR-ST3 "fires once" must be provable now, delivered later | E15-S07 |
| 2026-09-28 | Stock quantity only via movements; opening stock = an 'in' movement | One ledger; BR-ST2 actor on every change | E15-S06 |
| 2026-09-28 | Service requests: one shared care queue (TN12 → cc_exec); taker is recorded as `assigned_to` | Notifications matrix TN12 | E14-S15 |
| 2026-09-28 | SR clock from settings: 48 h acknowledge, 30 days resolve | E-Commerce Rules (compliance §5) | E14-S15 |
| 2026-09-28 | **Caller identity in SECURITY DEFINER functions comes from the JWT (`is_system_caller()`), never `current_user`** | Inside a definer function `current_user` is the owner — see Deviations | all |
| 2026-09-28 | Invoice number allocated at issue, not at draft | A draft can be abandoned without leaving a gap (BR-I1) | E14-S09 |
| 2026-09-28 | Supplier GSTIN / legal name / address / series codes in `settings`, empty until A11; issue refuses without them | Nothing invented | E14-S08 |
| 2026-09-28 | Series codes ≤ 5 characters | CODE/2627/00001 must stay ≤ 16 (Rule 46); 6 would make 17 | E14-S09 |
| 2026-09-28 | `due_date` = issue date (due on receipt) | Blueprint names no payment terms — REDUX may set terms later (item 23) | E14-S08 |
| 2026-09-28 | One live invoice per job; cancelling (credit note) frees the job to be re-invoiced | No partial / milestone billing (B7 out of scope) | E14-S08 |
| 2026-09-28 | A paid invoice cannot be cancelled until refunded | A credit note must not silently strand money | E14-S18 |
| 2026-09-28 | A wrong OTP returns `{ok:false}` instead of raising | An exception would roll back the attempt counter — BR-Q5 needs attempts kept | E11-S08 |
| 2026-09-28 | Warranty kind per work type: repair → mechanical; restore finish → finish; Eurobrass replacement → both | Blueprint silent; open item 22 | E12-S10 |
| 2026-09-28 | Warranty periods come from the **quote's** snapshot, not current settings | BR-Q3: the customer gets what they accepted | E12-S10 |
| 2026-09-28 | Handover by super_admin or the surveyor who surveyed the job; stage moves by super_admin only | J1 step 17; roles matrix | E12-S05/S09 |
| 2026-09-28 | Portal login linked to a customer contact by phone (trigger on auth.users) | "Customer account created automatically" without a manual step | E11-S10 / E14 |
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
| 2026-09-29 | Demo mode (`NEXT_PUBLIC_DEMO_MODE=true`): WhatsApp/OTP/payments simulated into `messages` and shown at `/demo/outbox`; one-click staff logins; demo data seeded through the real DB functions on staging | Client demo before integrations are approved; removal = reset staging | demo |
| 2026-09-29 | Demo hosting on Vercel (owner's request) | A shareable link now; production stays on the Mumbai VPS (ADR-003) | demo |
| 2026-09-29 | Portal login in demo: 6-digit code (HMAC-sealed cookie, 10 min, 5 tries) → session minted server-side from a one-time magic-link token; production path is Supabase phone OTP | No SMS provider in the demo; no customer passwords ever | E13 |
| 2026-09-29 | Demo "Pay now" records a captured payment through `record_payment()` with the service role (demo-only guard) | Stands in for the Razorpay webhook; same function, same reconciliation | E14 |
| 2026-09-29 | Stage events, blocks and downtime of the seeded jobs are re-spread in stage order on every `pnpm demo:seed` | Seeded events shared one timestamp, so timelines read out of order | demo |
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
| 2026-09-28 | **SECURITY FIX**: `move_unit_stage()` and `link_to_pilot()` (001000, on staging for a few hours, no real data) accepted any logged-in user — the check `current_user = 'authenticated'` never fires inside SECURITY DEFINER. Re-issued with `is_system_caller()`; test 11 makes the pattern structurally impossible | Found by the invoice test calling as cc_exec | migration 001100 |
| 2026-09-28 | `invoices.invoice_no` nullable until issue; supplier fields filled at issue; `payment_route`; issued-completeness + cancelled-consistency checks | BR-I1, BR-I3, BR-I6 | migration 001100 |
| 2026-09-28 | Webhook routes do **not** export `dynamic = 'force-dynamic'` (ADR-008 said to) | Next 16 removes `dynamic` when Cache Components is on; POST handlers are dynamic anyway | app/api/webhooks |
| 2026-09-28 | `privacy_notices` + language, one active per language, immutable once published; `consent_records` + notice_id, call_id, recorded_by, granted_at = clock_timestamp() | BR-P1; ordering within one transaction | migration 001500 |
| 2026-09-28 | `calls` + recording_hold_until, recording_deleted_at; new `storage_deletions` | BR-P4 dispute hold; deletion outbox | migration 001500 |
| 2026-09-28 | `dsr_requests` + requested_by, retained_explanation; `incidents.created_by` → auth.users | BR-P5 "what is retained and why" | migration 001500 |
| 2026-09-28 | `lead_status_history.actor_id` → auth.users | Same reason as audit_log | migration 001500 |
| 2026-09-28 | New `whatsapp_messages` (inbox, both directions) and `team_notifications` (TN* in-app) | schema.sql had nowhere for D4-08 or in-app alerts | migration 001400 |
| 2026-09-29 | CN9–CN13 and CN16 now have triggers (migration 001700); CN10 is one message per job step naming its rooms, not one per room; CN7 gets its job number when the job opens (001800) | The matrix listed them but nothing sent them — the customer heard nothing between approval and payment | migrations 001700–001800 |
| 2026-09-29 | A portal login created while the customer was a prospect is linked on the next visit after conversion (app-side, same rule as `trg_link_portal_user`) | The trigger fires only on auth-user insert/phone change, so an approving prospect lost access to their own job | `lib/data/portal.ts` |
| 2026-09-29 | **A prospect approves the quote in the portal**: `/portal/quotes/[id]` is released to a signed-in user whose verified phone is an active contact of the quote's customer, read server-side with the service role for that one quote | The spec sends the quote to a prospect, but `my_customer_ids()` excludes prospects (no portal access before approval) — the approval screen was unreachable | `lib/data/portal.ts` |
| 2026-09-29 | Storage: six buckets per 05-storage-media §1 with object policies keyed to the record the path names; no update/delete policy | The schema had no storage section; the surveyor app could not upload | migration 001600 |
| 2026-09-29 | Surveyor app writes straight to Supabase (PostgREST/RPC/Storage) under RLS instead of `/api/mobile/*` | Same rules enforced by RLS + idempotent functions; the route layer adds nothing for the demo | mobile/ |
| 2026-09-29 | Surveyor app: image-picker camera (+ gallery for the demo); no burned-in corner stamp, onboarding screen or foreground upload service | Not possible in Expo Go; GPS/time are stored in columns. Needed for the production build | mobile/ |
| 2026-09-29 | pgTAP 07/10/14 no longer assume an empty database | Demo data on staging broke global-state assertions | tests |
| 2026-09-28 | `notification_rules`: + channel, category, template_code; seeded from the matrix. `messages`: + send_after, attempts, variables | Quiet hours, retries, toggles | migration 001400 |
| 2026-09-28 | `capi_events` unique (event_name, lead_id) | Each conversion once per lead | migration 001400 |
| 2026-09-28 | `service_requests.ticket_no` → `request_no`; `resolution_note`; forward-only status; no user write policy | Glossary bans "ticket"; accountability | migration 001300 |
| 2026-09-28 | `stock_items` + `created_at/updated_at`, category check; `stock_movements` sign/reason checks, append-only; new `stock_alerts` | BR-ST1…3 | migration 001200 |
| 2026-09-28 | `credit_notes` get their own gap-free series + GST split; append-only | BR-I2 | migration 001100 |
| 2026-09-28 | `unit_blocks` table replaces job_units.blocked_* columns | Item 9: open and repeat blocks | migration 001000 |
| 2026-09-28 | `jobs.quotation_id` unique; handovers require all three checks (constraint); warranties unique per (fitting, job, kind); nothing cascades | One job per approval; D11-07; no duplicate cards; rule 8/9 | migration 001000 |
| 2026-09-28 | Actor columns on jobs tables reference auth.users | Same reason as audit_log | migration 001000 |
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
| 7 | ~~Fixed in 001400~~ Webhook idempotency `(source, external_id)` collides for WhatsApp statuses (same wamid) and Razorpay events (same payment.id) | §15 | no |
| 8 | ~~Fixed in 000400~~ BR-L3 trigger misses `campaign_id` (+ leadgen / google ids, utm) | §5 | no |
| 9 | ~~Fixed in 001000~~ BR-J2: clock keeps running while currently blocked; one block per unit | §11 | no |
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
| 22 | Which warranty (mechanical / finish) each work type earns — implemented as repair → mechanical, restore finish → finish, replacement → both | warranties | yes — REDUX |
| 23 | Invoice payment terms — implemented as due on issue | invoices | yes — REDUX |
| 24 | TN2 "call-back SLA due" needs a lead-time (e.g. 10 min before due) — only the breach (TN3) is built | notifications | yes — REDUX / PM |
| 25 | **Erasure vs BR-L3**: anonymising an erased person's lead means changing attribution fields BR-L3 makes immutable. Options: (a) erase PII columns (name, email, raw_payload) but keep attribution ids; (b) allow the erasure function to bypass BR-L3 with an audit entry | leads, BR doc | **yes — REDUX / PM + counsel** |
| 26 | **ADR-001 wording**: `cacheComponents` is one app-wide flag in Next 16 — it cannot be "on only for marketing". Intent still holds (caching is opt-in via `use cache`; portals never opt in). Proposed: amend ADR-001 when the marketing site is built | ADR doc | tech lead — no client input |
| 27 | Meta CAPI for **lead-ad** leads (CRM conversions keyed on leadgen_id) is not built; only click-to-WhatsApp conversions (ctwa_clid) are sent | worker/capi | yes — confirm REDUX wants it (D3-06 wording covers both?) |

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

2026-09-28  Migration 001000 (§11 jobs + verify_quote_otp). Tests caught a real bug: CASE with only
            literal branches resolves to text, so every stage move would have failed on the enum
            column — explicit casts added. BR-Q6 proven by forcing a failure mid-approval. CI green
            → staging; 227/227 pgTAP. Item 9 closed; open item 22 (warranty kind per work type).
            Next in Step 1: invoices + payments (§12) — but invoicing has no D-number (item 15).

2026-09-28  Migration 001100 (§12 invoices, payments, credit notes). The invoice test caught a
            SECURITY bug: "current_user = 'authenticated'" inside SECURITY DEFINER never fires, so
            move_unit_stage/link_to_pilot (on staging) let any user through. Fixed via JWT-based
            is_system_caller(); test 11 guards it structurally. Also caught: a 6-char series code
            breaks the 16-char limit → codes ≤ 5. CI green → staging; 274/274 pgTAP.
            Next in Step 1: §13 stock, then §14–16 (service requests, integrations/messaging, privacy).

2026-09-28  Migrations 001200 (§13 stock) + 001300 (§14 service requests). CI green → staging;
            312/312 pgTAP. Remaining in Step 1: §15 integrations/webhooks/messaging (with pgmq +
            pg_cron, E4-S01 / E5-S01) and §16 consent/privacy (DPDP) — both need the queue design.

2026-09-28  Migration 001400 (§15): pgmq queues, webhook recording + dead-letter, notification
            outbox with dedup/quiet hours/toggles, CAPI once-per-lead, sweeps; pg_cron jobs defined
            but deliberately not installed until the worker exists. Item 7 closed. CI green →
            staging; 342/342 pgTAP. Remaining in Step 1: §16 consent/privacy (DPDP).

2026-09-28  Migration 001500 (§16 DPDP): notices, consent ledger, atomic lead+consent, photo marketing
            consent, recording purge, DSR queue with blockers, 72-hour incident clock. Tests found:
            now() ties inside one transaction (→ clock_timestamp), phone-only consent not linked to
            the lead, another profiles-FK on an actor column. CI green → staging; 370/370 pgTAP.
            ── BUILD-ORDER STEP 1 COMPLETE ── schema §1–16 as 15 migrations, all on staging.
            Next: Step 2 (auth UI, proxy route protection, role sidebar) and Step 3 (design system)
            — both need DS1 designs for UI; or the queue worker (E4) which is pure server code.

2026-09-28  Webhook routes (Meta, WhatsApp, Google Ads, Razorpay) + queue worker (webhooks → leads /
            inbox / payments; notifications; CAPI). 79 unit tests; pnpm worker:smoke (9 checks,
            staging, rolled back) caught pgmq.send() ambiguity with untyped params. CI green.
            Open items 26, 27. Next: go-live plumbing (Dockerfile.worker, Coolify, install_schedules)
            with the VPS, or E5-S05 template bodies — or Step 2/3 once DS1 designs land.

2026-09-29  DEMO BUILD. Staff: leads (list, board, detail, new, my leads), follow-ups, inbox, stats,
            surveys, quotes (builder with discount gate, A4 preview, approval queue), jobs (detail,
            per-room stages/blocks, room board, handover). Admin: hub, invoices + credit notes,
            payments, stock + ledger, rate-card versions, masters, users, assignment, notification
            rules/templates, integrations, settings, audit, privacy, reports; service requests.
            Customer portal D1s–D10s incl. quote approval by OTP and pay now. Expo SDK 57 surveyor
            app in mobile/ (outbox, photo pipeline, offline pricing). Storage migration 001600:
            CI green; pushed to staging on the owner's go-ahead — 381/381 pgTAP on staging.
            Website (18 pages) done; production build green; demo live on Vercel
            (redux-demo-iota.vercel.app, bom1), 43 pages + staff/portal logins verified end to end.
            Next: the real integrations, Gotenberg PDFs, surveyor app production build.

2026-09-29  DEMO HARDENING. Golden path automated against the live Vercel demo: website enquiry →
            lead (SLA) → call → survey booked → surveyor check-in, 4 fittings × 4 photos uploaded and
            confirmed, assessments, submit (the Expo app's exact calls) → quote created and issued →
            prospect approves by OTP in the portal → job through all stages → handover (warranty
            cards) → invoice issued → paid in the portal → lead won; 15 WhatsApps in the outbox.
            Fixed: prospect→customer portal linking, prospect quote on portal home, outbox portal
            buttons and live rendering, pipeline column overlap, mobile stage labels, missing
            customer notifications (001700/001800, 392/392 pgTAP). pnpm demo:refresh re-dates the
            demo to the day. DEMO-GUIDE.md written.
```
