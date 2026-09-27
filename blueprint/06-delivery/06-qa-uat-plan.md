# 06 — QA & UAT Plan · D21

Two layers: **internal QA** on every deliverable, and **UAT with REDUX** at the end of each phase.
UAT sign-off per phase is the contractual acceptance.

---

## 1. Test levels

| Level | Tool | Runs | Covers |
|---|---|---|---|
| Unit | Vitest | Every PR | Pure logic: pricing, tax, dedup, SLA, invoice numbering |
| Integration | Vitest + Supabase local | Every PR | Server actions, RPCs, webhook handlers |
| **RLS / permission** | SQL test suite | Every PR, **blocking** | The 8 permission tests |
| E2E | Playwright | Nightly + pre-release | The critical journeys |
| Mobile | Manual matrix + Maestro | Per sprint | Offline behaviour on real devices |
| Performance | k6 + seeded data | Pre-release | List views, dashboard, webhook throughput |
| Accessibility | axe + manual keyboard | Pre-release | WCAG 2.2 AA |
| Security | Checklist + automated scans | Pre-release | `../03-architecture/04-auth-security-rls.md` §9 |

---

## 2. Always-on CI gates (a PR cannot merge if any fails)

1. `tsc --noEmit`
2. ESLint (run directly — `next lint` was removed in Next 16)
3. Unit + integration tests
4. Migrations apply cleanly to a fresh database
5. **Every public table has `relrowsecurity = true`**
6. **No `SERVICE_ROLE` or `*_SECRET` string in any client bundle**
7. **₹ renders in a Gotenberg PDF, with Indian digit grouping**

Gates 5, 6 and 7 exist because each one has a failure mode that is invisible in review and
expensive in production.

---

## 3. The eight permission tests (blocking, every PR)

From `../02-product/01-roles-permissions.md`:

| # | Test | Expected |
|---|---|---|
| P1 | Customer A queries customer B's properties, jobs, quotes, invoices, photos | 0 rows |
| P2 | Surveyor queries a survey not assigned to them | 0 rows |
| P3 | Care executive queries another executive's leads | 0 rows |
| P4 | Non-admin writes `rate_card_items` / `user_roles` / masters | denied |
| P5 | Client bundle contains the service-role key | not found |
| P6 | Signed photo URL fetched after TTL | 403 |
| P7 | Update an approved quotation | denied |
| P8 | Concurrent invoice issue | no gaps, no duplicates |

---

## 4. Business-rule tests

Every rule in `../02-product/05-business-rules.md` has a test. The ones that matter most:

| Rule | Test |
|---|---|
| BR-L1 | Same phone from two sources → 1 lead, 2 touches |
| BR-L3 | Update `ctwa_clid` → rejected |
| BR-S5 | Save a fitting with 3 photos → rejected in app **and** server |
| BR-S6 | Submit with one unsynced photo → blocked |
| BR-A3 | Edit the rate card → existing quotes unchanged |
| BR-A4 | market < total → "You save" is 0, not negative |
| BR-Q1 | Approve on day 16 → rejected |
| BR-Q6 | Fail mid-approval → nothing created |
| BR-Q7 | Edit an approved quote → denied |
| BR-I1 | 50 concurrent invoices → sequential, gap-free |
| BR-I5 | Redirect without webhook → invoice still unpaid |
| BR-I7 | Duplicate payment webhook → paid once |
| BR-J2 | Block a unit 5 days → delay metric excludes them |
| BR-ST1 | Issue beyond stock → rejected |
| BR-P2 | Withdraw marketing → service messages continue |

*(Six of these are already verified by execution against PostgreSQL 16 — see the header of
`../03-architecture/schema.sql`.)*

---

## 5. Critical E2E journeys

| # | Journey | Phase |
|---|---|---|
| J-A | Website enquiry → CRM → assigned → WhatsApp sent | 1 |
| J-B | Meta lead → webhook → CRM, tagged and de-duplicated | 1 |
| J-C | Call → outcome → survey booked → confirmation sent | 1 |
| J-D | Offline audit → sync → quote → OTP approval → job created | 2 |
| J-E | Job stages → handover → warranty generated | 2 |
| J-F | Customer OTP login → view job → pay invoice → warranty visible | 3 |
| J-G | Service request → acknowledged within 48 h | 3 |
| J-H | **Full lifecycle, all three phases, once, before final go-live** | 3 |

---

## 6. Mobile test matrix

**Three OEMs minimum** — they kill background work differently, and this is the number-one cause
of field sync failures in India.

| Device class | Example | Why |
|---|---|---|
| Budget Xiaomi | Redmi, HyperOS/MIUI | Most aggressive battery manager |
| Mid Oppo/Vivo | ColorOS / Funtouch | Different autostart model |
| Samsung | Galaxy A-series | Different again; very common |

| Scenario | Pass condition |
|---|---|
| 40-fitting audit in airplane mode | All data and photos survive |
| Force-kill mid-upload | Resumes on relaunch, nothing lost |
| Battery dies mid-visit | Committed data survives |
| Weak signal (lift, basement) | Retries succeed |
| Upload same photo twice | One object, one row |
| Missing photo slot | Save blocked, slot named |
| Storage nearly full | Clear message, no silent failure |
| App updated with pending outbox | Outbox migrates and survives |
| Logout with pending outbox | **Outbox not cleared** |
| 24 h offline | `TN11` alert fires to admin |

---

## 7. Performance targets

| Scenario | Target | Data |
|---|---|---|
| Lead list first paint | <1 s | 50,000 leads |
| Lead detail | <800 ms | 200 timeline entries |
| Pipeline board | <1.5 s | 500 open leads |
| Dashboard | <2 s | 12 months of data |
| Survey detail with 200 photos | <2 s | thumbnails only |
| Webhook handler | **<200 ms** | — |
| PDF render | <5 s | 50-line quote |
| Website LCP | <2 s | 4G |

---

## 8. UAT

### Approach
Run on **staging with seeded data**, never production. REDUX runs scripted scenarios per role,
plus free exploration. Every issue is logged with role, steps, expected, actual and severity.

| Severity | Definition | Blocks go-live? |
|---|---|---|
| S1 | Data loss, security, or a core journey broken | **Yes** |
| S2 | Feature not working as specified | Yes |
| S3 | Workaround exists | No — fixed in hypercare |
| S4 | Cosmetic | No — backlog |

### Phase 1 scenarios (W9)
1. Super Admin: add a care executive, assign a city, verify they see only their leads
2. Care executive: work the queue — call, log, book a survey, verify the WhatsApp arrives
3. Submit a website enquiry as a customer; confirm it appears tagged in the CRM
4. Create a Meta test lead; confirm it arrives tagged and de-duplicated
5. Submit the same phone number twice from different sources; confirm one lead, two touches
6. Mark a lead lost without a reason; confirm it is refused
7. Check the integration health screen

### Phase 2 scenarios (W19)
1. **Surveyor: complete a real audit on a real property in airplane mode**
2. Reconnect; watch the sync screen; confirm every photo arrives
3. Try to submit with a missing photo; confirm it is blocked and the slot is named
4. Build a quote; confirm all three prices and "You save"
5. Approve by OTP as the customer; confirm the job is created and the email arrives
6. Try to approve an expired quote; confirm rejection
7. Move a job through the stages; block a room on civil work; confirm the delay metric excludes it
8. Complete a handover; confirm both warranty cards

### Phase 3 scenarios (W24)
1. Customer: OTP login, view job, view before/after, download warranty
2. **Pay a real ₹1 invoice; confirm the webhook marks it paid**
3. Raise a service request; confirm the 48-hour acknowledgement
4. **Admin: change a price, add a finish, deactivate a user — with nobody helping**
5. Run three reports at three date ranges; export each
6. Reconcile dashboard figures against the underlying records
7. Export my data; withdraw marketing consent; confirm service messages still arrive

### Sign-off
Each phase is accepted when **every S1 and S2 is closed** and REDUX signs the acceptance criteria
in `../00-brief/02-deliverables-D1-D23.md` for that phase's deliverables.

---

## 9. What we test that clients rarely ask for

These are the ones that cause the worst incidents, and nobody puts them in a UAT script:

| Test | Why |
|---|---|
| Integration goes silent for 8 hours | A broken webhook throws no error — leads just stop arriving |
| Meta webhook gap >24 h | Verify the reconciliation poll actually recovers them |
| Surveyor leaves with unsynced data | Offboarding must block access revocation |
| **App reinstalled with a pending outbox** | Confirms why the runbook says never to do this — the data is gone |
| Rate card edited mid-quote | Existing quotes must not move |
| Two executives open one lead | Optimistic lock warns rather than silently overwriting |
| Payment webhook arrives twice | Idempotency |
| Quote approved at the moment of expiry | Boundary condition |
| Invoice issued at 23:59 on 31 March | **Financial-year boundary — the series must reset correctly on 1 April** |
| Customer withdraws consent mid-job | Marketing stops; service messages continue |
