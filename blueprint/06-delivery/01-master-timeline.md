# 01 — Master Timeline

**Kickoff Mon 5 October 2026 · Final handover Thu 9 April 2027 · 27 weeks**

Machine-readable: `../data/timeline.csv`.

---

## Milestones

| Milestone | Date | Deliverables |
|---|---|---|
| Blueprint signed off (D19) | **Fri 9 Oct 2026** | D19 |
| Design sprint 1 approved (D20) | Fri 23 Oct 2026 | D20 |
| **Phase 1 LIVE** | **Thu 10 Dec 2026** | D1–D6 |
| Design sprint 2 approved | Fri 25 Dec 2026 | D20 |
| **Phase 2 LIVE** | **Thu 18 Feb 2027** | D7–D12 |
| Design sprint 3 approved | Fri 5 Mar 2027 | D20 |
| **Phase 3 LIVE** | **Thu 25 Mar 2027** | D13–D18 |
| **Final handover** | **Thu 9 Apr 2027** | D23 |

Go-lives are on **Thursdays**, deliberately — it leaves Friday for issues with the whole team
available, rather than discovering a problem on Saturday morning.

---

## Week by week

| Week | Dates | Phase | Focus |
|---|---|---|---|
| **W0** | 05 Oct – 09 Oct 2026 | Phase 0 | **Mobilisation** — Accounts, access, App Review, DLT, KYC, repo + Supabase bootstrap |
| **W1** | 12 Oct – 16 Oct 2026 | Phase 1 | **Design sprint 1 + foundation** — DS1 designs; schema core, auth, RLS, CI/CD, seed |
| **W2** | 19 Oct – 23 Oct 2026 | Phase 1 | **Design sprint 1 + foundation** — DS1 sign-off; app shell, roles, admin users (D6) |
| **W3** | 26 Oct – 30 Oct 2026 | Phase 1 | **Website build** — Pages, forms, consent, policy pages (D1) |
| **W4** | 02 Nov – 06 Nov 2026 | Phase 1 | **Website + CRM core** — Website done; lead model, list, detail, pipeline (D1, D2) |
| **W5** | 09 Nov – 13 Nov 2026 | Phase 1 | **CRM + integrations** — Webhooks, source tagging, dedup, assignment (D2, D3) — Diwali week, reduced capacity |
| **W6** | 16 Nov – 20 Nov 2026 | Phase 1 | **Integrations + notifications** — All 7 sources live; WhatsApp templates, CAPI (D3, D5) |
| **W7** | 23 Nov – 27 Nov 2026 | Phase 1 | **Care Executive Portal** — Click-to-call, outcomes, survey booking, inbox (D4) |
| **W8** | 30 Nov – 04 Dec 2026 | Phase 1 | **QA + fixes** — Internal QA, RLS tests, performance, security checklist (D21) |
| **W9** | 07 Dec – 11 Dec 2026 | Phase 1 | **UAT + GO-LIVE** — REDUX UAT, training, deploy — LIVE Thu 10 Dec (D22, D23) |
| **W10** | 14 Dec – 18 Dec 2026 | Phase 2 | **Design sprint 2 + app foundation** — DS2 designs; Expo project, SQLite outbox, auth |
| **W11** | 21 Dec – 25 Dec 2026 | Phase 2 | **Surveyor app core** — Visits, check-in, units, fittings (D7) — year-end, reduced capacity |
| **W12** | 28 Dec – 01 Jan 2027 | Phase 2 | **Photo pipeline** — 4-slot capture, compression, upload, sync UI (D7) — year-end, reduced capacity |
| **W13** | 04 Jan – 08 Jan 2027 | Phase 2 | **Offline hardening** — Outbox drain, retries, needs-attention, field test (D7) |
| **W14** | 11 Jan – 15 Jan 2027 | Phase 2 | **Rate card + assessment** — Rate card versions, CSV import, 3-price assessment (D8, D9) |
| **W15** | 18 Jan – 22 Jan 2027 | Phase 2 | **Quotation build** — Builder, PDF via Gotenberg, WhatsApp share (D10) |
| **W16** | 25 Jan – 29 Jan 2027 | Phase 2 | **OTP approval + job creation** — OTP, audit trail, auto customer+job, discounts (D10) |
| **W17** | 01 Feb – 05 Feb 2027 | Phase 2 | **Job tracking** — 7 stages, batches, room board, blocked clock, handover, warranty (D11, D12) |
| **W18** | 08 Feb – 12 Feb 2027 | Phase 2 | **QA + field trial** — Real hotel pilot audit end to end; fixes (D21) |
| **W19** | 15 Feb – 19 Feb 2027 | Phase 2 | **UAT + GO-LIVE** — REDUX UAT, surveyor training, Play release — LIVE Thu 18 Feb (D22, D23) |
| **W20** | 22 Feb – 26 Feb 2027 | Phase 3 | **Design sprint 3 + portal** — DS3 designs; customer portal, OTP login, job view (D13) |
| **W21** | 01 Mar – 05 Mar 2027 | Phase 3 | **Portal + payments** — Invoices, Razorpay links, virtual accounts, warranty, service requests (D13) |
| **W22** | 08 Mar – 12 Mar 2027 | Phase 3 | **Super Admin + stock** — Dashboard, KPIs, team performance, stock and alerts (D14, D15) |
| **W23** | 15 Mar – 19 Mar 2027 | Phase 3 | **Admin controls + reports** — Masters, users, notification rules, reports, exports, DPDP tools (D16, D17, D18) |
| **W24** | 22 Mar – 26 Mar 2027 | Phase 3 | **QA + UAT + GO-LIVE** — QA, UAT, deploy — LIVE Thu 25 Mar (D21, D22) |
| **W25** | 29 Mar – 02 Apr 2027 | Handover | **Training + hypercare** — Role-wise training, user guides, monitoring (D23) |
| **W26** | 05 Apr – 09 Apr 2027 | Handover | **Hypercare + handover** — Account transfers, as-built docs — HANDOVER Thu 9 Apr (D23) |
---

## Phase shape

| Phase | Weeks | Duration | Deliverables | Go-live |
|---|---|---|---|---|
| Phase 0 — Mobilisation | W0 | 1 week | — | — |
| Phase 1 — Capture & convert | W1–W9 | 9 weeks | D1–D6 | Thu 10 Dec 2026 |
| Phase 2 — Survey & quote | W10–W19 | 10 weeks | D7–D12 | Thu 18 Feb 2027 |
| Phase 3 — Retain & control | W20–W24 | 5 weeks | D13–D18 | Thu 25 Mar 2027 |
| Handover | W25–W26 | 2 weeks | D23 | Thu 9 Apr 2027 |

**Why Phase 2 is the longest:** the offline surveyor app is the only genuinely hard engineering in
this project. Everything else is a well-understood CRUD-and-workflow problem. Phase 2 also carries
the two pieces with legal weight — the OTP approval evidence trail and GST-compliant quotations.

**Why Phase 3 is the shortest:** by then the data model, auth, notifications and PDF pipeline all
exist. Phase 3 is mostly new views over data that is already there.

---

## Capacity assumptions

| Role | Allocation |
|---|---|
| Tech lead / full-stack | Full time throughout |
| Full-stack developer | Full time from W1 |
| Frontend developer | Full time W1–W9, W20–W24 |
| UI/UX designer | Full time in design sprints, part time otherwise |
| QA | Part time from W4, full time in QA and UAT weeks |
| Mobile (Expo) | Full time W10–W19 |

**Reduced-capacity weeks already built into the plan:**
- **W5 (9–13 Nov)** — Diwali week
- **W11–W12 (21 Dec – 1 Jan)** — year-end holidays

These are not buffer. They are weeks where output is genuinely lower, and pretending otherwise is
how a plan starts lying in month two.

---

## The critical path

```
W0  Meta App Review submitted ──────────────────────┐
W0  DLT registration started ──────────────┐        │
W0  Razorpay KYC started ────────┐         │        │
                                 │         │        │
W1  Foundation ─ W3 Website ─ W4 CRM ─ W5 Integrations ◀┘  (needs Meta approval)
                                 │         │
                                 │         └──▶ W6 Notifications (needs DLT + templates)
                                 │
                                 └────────────────────────▶ W21 Payments (needs KYC)
```

**Three things can delay Phase 1, and all three are other people's approval queues, not our code:**

| Blocker | Typical wait | If it slips |
|---|---|---|
| **Meta App Review** (`leads_retrieval`, `ads_management`) | 2–6 weeks, rejections common | Meta lead ads go live after the rest of Phase 1; other 6 sources unaffected |
| **DLT registration** (now needs biometric auth) | 1–2 weeks | OTP falls back to WhatsApp only; SMS fallback comes later |
| **Razorpay KYC** (needs live policy pages) | 1–2 weeks | Only affects Phase 3 — but start it in W0 anyway, it is free to wait |

**This is why Week 0 is a whole week of paperwork and almost no code.** It looks like a slow start
and it is the single highest-leverage week in the schedule.

---

## Dependencies on REDUX

Full list with owners: `../00-brief/04-assumptions-open-questions.md` §A.

| Needed by | What |
|---|---|
| **W0** | Meta Business Manager + Page access, WhatsApp number, KYC documents |
| W1 | Domain/DNS, brand assets |
| W2 | Google Ads access |
| W3 | Cleared hotel reference list |
| W6 | Team list with roles and cities; call-recording decision |
| **W9** | Master lists: fitting types, brands, finishes |
| **W10** | **Rate card** — this one gates the entire quotation deliverable |
| W13 | Warranty periods and text |
| W14 | GSTIN, invoice series, HSN/SAC confirmed by their CA |
| W17 | Bank account for settlement |

**A slip on the rate card (W10) stops Phase 2 dead**, because quotations cannot be built or tested
without real prices. It is flagged as risk R4 and should be chased from W6, not W9.

---

## What happens if a phase slips

Phases are **independently shippable**, which is the point of the structure. If Phase 2 runs two
weeks late, Phase 1 is still live and earning — REDUX is capturing and converting leads while we
build the survey app. That is worth more than a plan that only pays off at the end.

**The one thing we will not do is compress QA and UAT to hold a date.** Those weeks are where the
RLS tests, the permission matrix and the photo-loss scenarios get proved. Shipping a data-leak
bug to hold a Thursday is a bad trade in every direction.
