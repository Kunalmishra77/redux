# REDUX Platform — Project Blueprint

**Client:** REDUX — Bath Restorations by Eurobrass (D 8/7, Okhla Phase 1, New Delhi 110020)
**Scope:** Website + Lead CRM + Care Executive Portal + Surveyor Mobile App + Customer Portal + Super Admin
**Contract basis:** 23 deliverables (D1–D23) across three phases — see `00-brief/02-deliverables-D1-D23.md`
**Blueprint version:** 1.0 · 26 September 2026

---

## What this folder is

This is the complete build specification for the REDUX platform. It is written to be read by
**both a human developer and Claude Code**. Every technology choice, database table, API route,
screen, message template and delivery date is decided here, so the build phase is execution,
not discovery.

**If you are Claude Code and you are reading this for the first time, open `START-HERE.md` next.**

---

## Folder map

| Folder | What's inside | Read it when |
|---|---|---|
| `00-brief/` | The business problem, the 23 contracted deliverables, domain glossary, open questions | Always — first |
| `01-research/` | Verified R&D: stack decisions (ADRs), Meta/WhatsApp, Google Ads/payments, offline mobile, India compliance, cost model | Before any technical choice |
| `02-product/` | PRD, roles & permissions, user journeys, screen inventory, notification matrix, business rules | Before building any feature |
| `03-architecture/` | System architecture, **`schema.sql`** (full DDL), API spec, auth/RLS, storage, integrations runbook, DevOps | Before writing code |
| `04-design/` | Design system (tokens), UX principles, screen specs for website, portals, surveyor app | Before building UI |
| `05-content/` | Website copy, WhatsApp templates, SMS/email templates, SEO plan | When filling screens or wiring notifications |
| `06-delivery/` | Master timeline with real dates, three phase plans, backlog (story IDs), QA/UAT, deployment runbook, training, risks | For planning, status and sign-off |
| `07-build/` | **Build order**, coding standards, definition of done, repo structure, live task tracker | Every build session |
| `data/` | CSVs: deliverables, rate card template, timeline | For import and client sign-off |

---

## The decided stack (one-line version)

**Next.js 16.3 App Router + React 19.3 + Tailwind v4 + shadcn/ui** on a **Mumbai VPS**,
**Supabase Cloud (ap-south-1)** for Postgres/Auth/Storage/Queues,
**Expo SDK 57 (React Native, Android-first)** for the offline surveyor app,
**Gotenberg** for PDFs, **Razorpay** for payments, **Meta Cloud API direct** for WhatsApp.

Full reasoning and rejected alternatives: `01-research/01-stack-decisions-adr.md`.

---

## Timeline (one-line version)

Mobilisation **5 Oct 2026** → Phase 1 live **10 Dec 2026** → Phase 2 live **18 Feb 2027** →
Phase 3 live **25 Mar 2027** → handover **9 Apr 2027**.

Full week-by-week: `06-delivery/01-master-timeline.md`.

---

## Three things that must start on Day 1 (they gate everything)

1. **Meta App Review** for `leads_retrieval` + `ads_management` — expect rejection rounds. Weeks, not days.
2. **TRAI DLT registration** (entity → header → templates) — biometric auth required since Feb 2025.
3. **Razorpay KYC** — needs live Terms, Privacy, Refund and Contact pages before approval.

If these three slip, Phase 1 slips. They are tracked as blockers in `06-delivery/09-risk-register.md`.

---

## Status of the numbers in this blueprint

Prices, warranty periods and rate-card values are **placeholders (`₹ —`)** until REDUX shares
its rate card. Everything marked `[CLIENT INPUT NEEDED]` is listed in
`00-brief/04-assumptions-open-questions.md`. Do not invent these values.
