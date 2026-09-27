# 05 — Backlog

Every story carries its **deliverable ID** and **target week**. Nothing is built without a
D-number — if a good idea has no D-number it is a change request
(`../00-brief/04-assumptions-open-questions.md` §C), not a sprint item.

Story IDs are stable. Use them in commits (`feat(E4-S03): source tagging`), in PR titles and in
`../07-build/05-task-tracker.md`.

**Estimates:** S ≈ ½ day · M ≈ 1–2 days · L ≈ 3–5 days.

---

# PHASE 0 — Mobilisation

## E0 · Accounts & infrastructure · W0

| ID | Story | Size | D |
|---|---|---|---|
| E0-S01 | REDUX completes Meta Business Verification | — | D3 |
| E0-S02 | Create Meta app + System User token; assign Leads Access on the Page | M | D3 |
| E0-S03 | **Submit Meta App Review** with end-to-end screencast | M | D3 |
| E0-S04 | WhatsApp number prepared, WABA created, display name submitted | M | D5 |
| E0-S05 | DLT Principal Entity + header registration started (biometric) | — | D5 |
| E0-S06 | Razorpay KYC started | — | D13 |
| E0-S07 | Repos, Supabase staging + prod (ap-south-1), VPS + Coolify, Cloudflare | L | all |
| E0-S08 | CI pipeline: tsc, lint, migration check, **RLS check**, **secret scan** | M | all |
| E0-S09 | Sentry, uptime monitoring, alert routing | S | all |
| E0-S10 | Blueprint walkthrough and sign-off | — | **D19** |

---

# PHASE 1 — Capture & Convert

## E1 · Foundation · W1–W2

| ID | Story | Size | D |
|---|---|---|---|
| E1-S01 | Migrations: enums, identity, org (`schema.sql` §1–2) | M | D6 |
| E1-S02 | Migrations: master data + seed (§3) | M | D16 |
| E1-S03 | Supabase Auth + **Custom Access Token Hook** + `user_roles` | M | D6 |
| E1-S04 | `authorize()`, `current_role_is()`, `my_customer_id()` helpers | S | D6 |
| E1-S05 | RLS policies for §1–3, all four ADR-004 rules | M | D6 |
| E1-S06 | Next 16.3 app shell, Tailwind v4 `@theme`, shadcn/ui | M | — |
| E1-S07 | Design-system components: button, pill, table, card, empty state, form | L | D20 |
| E1-S08 | Role-filtered sidebar + three-hostname routing | M | D6 |
| E1-S09 | Login, reset, profile, notification prefs | M | D6 |
| E1-S10 | **D6** — users, roles, cities, assignment rules admin | M | **D6** |
| E1-S11 | `audit_log` + generic audit trigger | S | — |
| E1-S12 | Permission test suite (the 8 tests) | M | D6 |

## E2 · Website · W3–W4 · **D1**

| ID | Story | Size |
|---|---|---|
| E2-S01 | Home (A1) — all 10 sections | L |
| E2-S02 | Service pages A2–A4 | M |
| E2-S03 | For Hotels (A5) — the main B2B page | M |
| E2-S04 | For Homes (A6), For Dealers (A7) | M |
| E2-S05 | Why REDUX (A8) | S |
| E2-S06 | Gallery (A9) + case study (A10) — **only `marketing_use_consented` photos** | M |
| E2-S07 | Process (A11) | S |
| E2-S08 | **Terms, Privacy+DPDP notice, Refunds, Contact (A12, A15–A17)** — gate Razorpay KYC | M |
| E2-S09 | Enquiry forms (A13, A14): home / hotel / dealer → CRM with source | L |
| E2-S10 | Consent capture against the active notice version | M |
| E2-S11 | WhatsApp button with page-aware pre-filled message | S |
| E2-S12 | Thank-you page (A18) | S |
| E2-S13 | SEO: metadata, sitemap, robots, schema.org, canonicals | M |
| E2-S14 | Core Web Vitals pass; `cacheComponents` on for marketing only | M |
| E2-S15 | Honeypot + Cloudflare rate limiting | S |
| E2-S16 | Accessibility pass (WCAG 2.2 AA) | M |

## E3 · Lead CRM · W4–W5 · **D2**

| ID | Story | Size |
|---|---|---|
| E3-S01 | Migrations: leads, touches, history, notes, follow-ups, campaigns (§5) | M |
| E3-S02 | RLS for leads; indexes on every policy column | S |
| E3-S03 | **Phone dedup → `lead_touches`** (BR-L1) | M |
| E3-S04 | Attribution immutability trigger (BR-L3) | S |
| E3-S05 | Auto-assignment: city then round-robin; `assignment_state` | M |
| E3-S06 | SLA timer from creation (BR-L5) + sweep cron | M |
| E3-S07 | Lead list (B5) with filters and server pagination | L |
| E3-S08 | **My leads queue (B6), SLA-sorted** | L |
| E3-S09 | Lead detail (B7) with activity timeline | L |
| E3-S10 | Pipeline board (B8), drag, lost-reason dialog | L |
| E3-S11 | Manual lead entry (B9) | S |
| E3-S12 | Lost reasons enforced (BR-L7) | S |
| E3-S13 | Optimistic status updates with rollback | M |
| E3-S14 | Keyboard shortcuts (j/k/c/b//) | S |

## E4 · Lead source integrations · W5–W6 · **D3**

| ID | Story | Size |
|---|---|---|
| E4-S01 | `webhook_events` + pgmq worker + dead-letter alerting | L |
| E4-S02 | **Meta `leadgen` webhook** — raw-body HMAC, persist, 200 fast | M |
| E4-S03 | Meta lead retrieval + `lead_form_field_map` (custom question slugs change) | M |
| E4-S04 | **Meta reconciliation poll, every 15 min** (90-day rule) | M |
| E4-S05 | WhatsApp `messages` webhook + conversations | M |
| E4-S06 | **CTWA `referral` → `ctwa_clid` captured at creation** | M |
| E4-S07 | WhatsApp campaign attribution | S |
| E4-S08 | **Google Ads webhook** — `google_key`, **200 `{}` always**, never 4XX | M |
| E4-S09 | Calls & walk-ins manual source | S |
| E4-S10 | **CAPI events** (`survey_booked`; `job_won` wired for Phase 2) | M |
| E4-S11 | **Integration health screen (B10)** + 6-hour silence alert | M |
| E4-S12 | Idempotency + replay tests for all four webhooks | M |

## E5 · Notifications · W6 · **D5**

| ID | Story | Size |
|---|---|---|
| E5-S01 | `messages`, templates, rules tables + queue worker | L |
| E5-S02 | WhatsApp Cloud API sender with cost capture | M |
| E5-S03 | MSG91 SMS fallback via Supabase Send SMS Hook | M |
| E5-S04 | Dedup keys, quiet hours, retry with backoff | M |
| E5-S05 | Submit 4 templates to Meta (Week 4, not Week 6) | S |
| E5-S06 | CN1, CN2 wired | S |
| E5-S07 | TN1–TN5 (assignment, SLA due, SLA breach, follow-up, integration silence) | M |
| E5-S08 | Admin toggle for every rule | S |

## E6 · Care Executive Portal · W7 · **D4**

| ID | Story | Size |
|---|---|---|
| E6-S01 | Click-to-call + `calls` logging | M |
| E6-S02 | Call outcomes with reasons | S |
| E6-S03 | **Inline survey booking**: date, slot, nearest surveyor — no navigation | L |
| E6-S04 | Surveyor availability, no double-booking (BR-S2) | M |
| E6-S05 | Follow-ups: create, snooze, complete, missed alert | M |
| E6-S06 | **WhatsApp inbox (B11)** with 24-hour window countdown | L |
| E6-S07 | Own performance stats (B15) | M |
| E6-S08 | Call recording: announcement, consent, 90-day retention, role-gated playback | M |
| E6-S09 | Call log screen (B14) | S |

## E7 · Phase 1 QA & go-live · W8–W9 · **D21, D22, D23**

| ID | Story | Size |
|---|---|---|
| E7-S01 | Functional QA against every D1–D6 acceptance criterion | L |
| E7-S02 | Security: 8 permission tests, RLS coverage, secret scan | M |
| E7-S03 | Test lead from **all 7 sources** end to end | M |
| E7-S04 | Performance: 50k seeded leads, list <1 s | M |
| E7-S05 | Accessibility audit | M |
| E7-S06 | **Backup restore actually performed** | S |
| E7-S07 | UAT with REDUX; fixes | L |
| E7-S08 | Training + user guides (admin, care exec) | M |
| E7-S09 | Production deploy, DNS cutover, smoke test | M |

---

# PHASE 2 — Survey & Quote

## E8 · Mobile foundation · W10–W11 · **D7**

| ID | Story | Size |
|---|---|---|
| E8-S01 | Expo SDK 57 project, Android, minSdk 24 / **targetSdk 36**, EAS | M |
| E8-S02 | Auth with long-lived session | M |
| E8-S03 | **SQLite `outbox` + `attachments`**, UUIDv7, idem keys | L |
| E8-S04 | Drain worker: FIFO per visit, backoff with jitter, attempt cap | L |
| E8-S05 | Bootstrap sync with ETag | M |
| E8-S06 | **C2 device onboarding** — OEM battery/autostart deep-links | M |
| E8-S07 | Migrations §7–9 (customers, properties, units, surveys, fittings, photos, assessments) | L |
| E8-S08 | `/api/mobile/*` handlers, idempotent on `idem_key` | L |
| E8-S09 | Offline-state UI: header chip, offline banner | M |

## E9 · Survey capture · W11–W13 · **D7**

| ID | Story | Size |
|---|---|---|
| E9-S01 | Today's visits (C3) with navigation | M |
| E9-S02 | **GPS check-in (C5)** — accuracy stored, >50 m flagged not blocked | M |
| E9-S03 | Server-side geofence + impossible-travel flagging | M |
| E9-S04 | Unit list (C6) with add-unit | M |
| E9-S05 | **Fitting capture (C7)** with master dropdowns + recents pinned | L |
| E9-S06 | **4-slot photo capture (C8)**; save blocked until complete | L |
| E9-S07 | Compress at capture (1600/2048) + corner stamp | M |
| E9-S08 | sha256 path, `upsert:false`, **409 = success** | M |
| E9-S09 | Confirm-then-delete-local (the no-loss guarantee) | M |
| E9-S10 | Condition checklist + recommendation (C9) | M |
| E9-S11 | Foreground `dataSync` service + Play Console declaration | M |
| E9-S12 | **Startup orphan reconciler** | M |
| E9-S13 | **Sync status screen (C11)** naming exact fitting + slot | M |
| E9-S14 | **Submit blocked while unsynced** (BR-S6) | S |
| E9-S15 | Offline test suite: airplane mode, kill app, storage full, 3 OEM phones | L |

## E10 · Rate card & assessment · W14 · **D8, D9**

| ID | Story | Size |
|---|---|---|
| E10-S01 | Migrations §4: rate cards, items, market prices | M |
| E10-S02 | Versioning; only one active (verified by partial unique index) | M |
| E10-S03 | Rate card editor (B27) + CSV import/export | L |
| E10-S04 | Assessment: recommendation + **all three prices**, `rate_card_id` frozen | L |
| E10-S05 | "You save" trigger, never negative | S |
| E10-S06 | Manual override with mandatory reason + audit | S |
| E10-S07 | Suitability caveat + "Eurobrass can re-machine" note | S |
| E10-S08 | **On-site three-column comparison (C10)** | M |

## E11 · Quotation & OTP · W15–W16 · **D10**

| ID | Story | Size |
|---|---|---|
| E11-S01 | Migrations §10: quotations, lines, approvals, discounts | M |
| E11-S02 | Quote builder (B19) from assessments | L |
| E11-S03 | Terms snapshot + `valid_until` on issue | M |
| E11-S04 | **Gotenberg image with Noto Sans; ₹ render test in CI** | M |
| E11-S05 | PDF render + `pdf_sha256` stored | M |
| E11-S06 | Preview route (B20) = the PDF source | S |
| E11-S07 | WhatsApp share with document attachment | M |
| E11-S08 | OTP request/verify with rate limits | M |
| E11-S09 | **Full `quote_approvals` evidence set** | L |
| E11-S10 | **Atomic approval → customer + property + units + job** | L |
| E11-S11 | Signed PDF + audit trail emailed immediately | S |
| E11-S12 | s.65B/s.63 certificate generator | M |
| E11-S13 | Discount approval queue (B21) | M |
| E11-S14 | Quote versioning; approved quote immutable | M |
| E11-S15 | Expiry sweep + CN8 | S |

## E12 · Job tracking · W17 · **D11, D12**

| ID | Story | Size |
|---|---|---|
| E12-S01 | Migrations §11: jobs, batches, units, stage events, handovers, warranties | M |
| E12-S02 | Job list + detail (B22, B23) | L |
| E12-S03 | Batches around approved dates | M |
| E12-S04 | **Room status board (B24)**, shared with the portal | M |
| E12-S05 | Stage transitions, forward-only, backward needs a reason | M |
| E12-S06 | **Blocked reason stops the delay clock** (BR-J2) | M |
| E12-S07 | Delay alerts (TN10) | S |
| E12-S08 | Pilot → wider project linkage | M |
| E12-S09 | Handover capture (C12, B25) + after-photos | L |
| E12-S10 | **Warranty generation at handover**, separate periods | M |
| E12-S11 | CN3–CN11, TN6–TN11 | M |

## E13 · Phase 2 QA & go-live · W18–W19

| ID | Story | Size |
|---|---|---|
| E13-S01 | **Real field trial** — full audit on a real property | L |
| E13-S02 | Offline test matrix on 3 OEM phones | L |
| E13-S03 | Quote/approval legal-evidence verification | M |
| E13-S04 | Play Store submission (FGS declared) | M |
| E13-S05 | Surveyor training **in the field** | M |
| E13-S06 | UAT, fixes, go-live | L |

---

# PHASE 3 — Retain & Control

## E14 · Customer portal · W20–W21 · **D13**

| ID | Story | Size |
|---|---|---|
| E14-S01 | OTP login (WhatsApp → SMS), contact linking | L |
| E14-S02 | Portal dashboard (D2s) | M |
| E14-S03 | Job progress + room board (D3s) | M |
| E14-S04 | Restored fittings, before/after (D4s) | M |
| E14-S05 | Quote view + OTP approval in portal (D5s) | M |
| E14-S06 | **Customer RLS proof test** | M |
| E14-S07 | Migrations §12: invoice series, invoices, lines, payments, credit notes | M |
| E14-S08 | GST invoice generation, all Rule 46 fields stored | L |
| E14-S09 | **Gap-free numbering, FY reset 1 April** | M |
| E14-S10 | Razorpay Payment Links ≤ ₹50,000 | M |
| E14-S11 | **Virtual accounts (NEFT/RTGS) > ₹50,000** | M |
| E14-S12 | Razorpay webhook: verified, idempotent, **paid only from webhook** | M |
| E14-S13 | Invoices & payment screens (D6s) | M |
| E14-S14 | Warranty cards (D7s) | M |
| E14-S15 | Service requests + 48-hour SLA (D8s, D9s, B38) | L |
| E14-S16 | **DPDP: export, correct, withdraw, erase (D10s)** | L |
| E14-S17 | Grievance officer block | S |
| E14-S18 | Credit notes | M |

## E15 · Super Admin & stock · W22 · **D14, D15**

| ID | Story | Size |
|---|---|---|
| E15-S01 | Dashboard KPI row (B26) | M |
| E15-S02 | Leads by source with cost per lead / per won job | M |
| E15-S03 | Care executive + surveyor performance tables | M |
| E15-S04 | **Every figure drills through to records** | M |
| E15-S05 | **Free-survey cost per won job** | M |
| E15-S06 | Migrations §13 + stock screens (B31, B32) | M |
| E15-S07 | Never-negative + once-per-crossing alert | M |
| E15-S08 | Stock consumption linked to jobs | S |

## E16 · Admin controls & reports · W23 · **D16, D17, D18**

| ID | Story | Size |
|---|---|---|
| E16-S01 | Master lists editor (B28) | M |
| E16-S02 | Users & roles (B29), cities & assignment (B30) | M |
| E16-S03 | Notification rules editor (B35) | M |
| E16-S04 | Audit log viewer (B37) | S |
| E16-S05 | Privacy / consent ledger + DSR queue (B39) | M |
| E16-S06 | Reports (B36): 6 report types, any range, CSV + PDF | L |
| E16-S07 | Scheduled weekly email | S |
| E16-S08 | CN12–CN18, TN12–TN15 | M |
| E16-S09 | **"No developer needed" test with a REDUX admin** | S |

## E17 · Phase 3 QA, go-live, handover · W24–W26

| ID | Story | Size |
|---|---|---|
| E17-S01 | Full-platform regression, all three phases | L |
| E17-S02 | **Real ₹1 payment + real refund** | S |
| E17-S03 | GST invoice verified by REDUX's CA | M |
| E17-S04 | **FY2027-28 invoice series configured and reset verified** | S |
| E17-S05 | UAT, fixes, go-live | L |
| E17-S06 | Role-wise training + written user guides | L |
| E17-S07 | Account and repo transfers to REDUX | M |
| E17-S08 | Blueprint updated to as-built | M |
| E17-S09 | Hypercare + support handover | — |

---

## Coverage check

| Deliverable | Epics |
|---|---|
| D1 | E2 |
| D2 | E3 |
| D3 | E4 |
| D4 | E6 |
| D5 | E5 |
| D6 | E1 |
| D7 | E8, E9 |
| D8, D9 | E10 |
| D10 | E11 |
| D11, D12 | E12 |
| D13 | E14 |
| D14, D15 | E15 |
| D16, D17, D18 | E16 |
| D19 | E0-S10 |
| D20 | E1-S07 + design sprints |
| D21 | E7, E13, E17 |
| D22 | E7-S09, E13-S06, E17-S05 |
| D23 | E7-S08, E13-S05, E17-S06/S07 |

**All 23 deliverables covered.**
