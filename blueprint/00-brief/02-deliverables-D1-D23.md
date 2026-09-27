# 02 — Deliverables D1–D23 (contract scope)

Source of truth: `REDUX_Client_Deliverables.xlsx`, prepared by Vimlendra Tiwari, 22 September 2026.
Machine-readable copy: `../data/deliverables.csv`.

**REDUX receives 23 deliverables: 18 platform deliverables across three phases, plus 5 project
services that take each phase from design to go-live.**

> Every story in `../06-delivery/05-backlog.md` carries the deliverable ID it serves.
> Nothing gets built that does not trace to a D-number. If a good idea has no D-number,
> it goes to `04-assumptions-open-questions.md` as a change request — not into the sprint.

---

## Phase 1 — Capture & convert

### D1 · Website — reduxbath.com

**What REDUX gets** — Mobile-responsive website: hero with "Book free assessment", problems we solve, services (function, finish, water efficiency), Why REDUX, before/after gallery with hotel references, assessment & pilot process; Home, Hotel and Dealer enquiry forms; WhatsApp chat button

**Accepted when** — Site is live and every form submission reaches the CRM with its source

### D2 · Lead CRM

**What REDUX gets** — One inbox for all leads; source tagging (channel, campaign, ad set, WhatsApp template); duplicate check by phone number; auto-assignment to care executives by city or in turn; instant WhatsApp reply; call-back timer; pipeline board from New to Won, with lost reasons

**Accepted when** — A test lead is tagged, de-duplicated, assigned and auto-replied without manual work

### D3 · Lead source integrations

**What REDUX gets** — Live connections for website forms, dealer enquiries, Meta lead ads, Google Ads lead forms, WhatsApp chats and WhatsApp campaigns; manual entry for calls and walk-ins

**Accepted when** — A sample lead from each of the 7 sources lands in the CRM

### D4 · Care Executive Portal

**What REDUX gets** — Lead list with source filters; click-to-call with call log; call outcomes with reasons; free-survey booking (date, slot, nearest surveyor); follow-up reminders; WhatsApp inbox with templates; own performance stats

**Accepted when** — A care executive can call, log the outcome and book a survey from one screen

### D5 · Phase 1 notifications

**What REDUX gets** — Customer WhatsApp: enquiry received, survey booked. Team alerts: new lead, follow-up due or missed

**Accepted when** — Each message fires on its trigger; WhatsApp templates approved by Meta

### D6 · Admin setup

**What REDUX gets** — Logins for admin and care executives; roles, cities and lead-assignment rules

**Accepted when** — REDUX team logs in and sees only what its role allows

---

## Phase 2 — Survey & quote

### D7 · Surveyor mobile app

**What REDUX gets** — Daily visit list; navigation; GPS check-in with timestamp; room-by-room fitting record (type, brand, model, finish); 4 mandatory photos per fitting (front, side, top, close-up); condition checklist (leak, stiff control, scaling, worn finish, part unavailable); works offline and syncs later

**Accepted when** — A full audit done without network syncs completely once back online

### D8 · Restore / repair / replace assessment

**What REDUX gets** — Recommended treatment per fitting; side-by-side price of restore or repair vs Eurobrass replacement vs market replacement

**Accepted when** — Every audited fitting shows all three options with prices

### D9 · Rate card setup

**What REDUX gets** — REDUX prices per fitting type, work type and finish, plus market replacement prices, loaded into the platform

**Accepted when** — Quotes price correctly from the loaded rates

### D10 · Quotation & OTP approval

**What REDUX gets** — Quote built from the audit; before/after visuals; total incl. GST; market price and "You save" amount; 15-day validity and warranty terms; branded PDF; share on WhatsApp; customer approval by OTP; admin approval for discounts; customer account and job created automatically on approval

**Accepted when** — An OTP-approved quote creates the customer account and job with no manual step

### D11 · Job tracking

**What REDUX gets** — 7 tracked stages (dates confirmed, removal & pickup, at Eurobrass, quality check, refit & test, handover, warranty active); room batches; live room status board; delay alerts; handover with after photos and customer sign-off; warranty cards generated

**Accepted when** — A multi-room hotel job is tracked room by room through to handover

### D12 · Phase 2 notifications

**What REDUX gets** — Customer: surveyor on the way, quote shared, job updates, handover with invoice and warranty card. Team: survey booked, quote approved, job running late

**Accepted when** — Each message fires on its trigger

---

## Phase 3 — Retain & control

### D13 · Customer Portal — my.reduxbath.com

**What REDUX gets** — OTP login; live job progress; restored fittings with before/after photos; quotes and invoices; online payment; warranty cards (mechanical and finish, with validity dates); service requests routed to the care team

**Accepted when** — A customer logs in, pays a due invoice online and sees active warranties

### D14 · Super Admin dashboard

**What REDUX gets** — Leads this month, free surveys done, survey-to-order conversion, quoted value, jobs at factory; leads by source; care executive and surveyor performance; stock alerts

**Accepted when** — Dashboard figures match the underlying records

### D15 · Stock & parts management

**What REDUX gets** — Cartridges, spares, finishes and replacement stock; minimum levels; low-stock alerts

**Accepted when** — Alert fires when an item falls below its minimum

### D16 · Admin controls

**What REDUX gets** — Rate card editor; users, roles, cities and permissions; master lists for fitting types, brands and finishes; discount approvals

**Accepted when** — Admin changes prices and users without developer help

### D17 · Reports & exports

**What REDUX gets** — Daily, weekly and monthly reports on leads, care team, surveys, quotes, jobs and stock; exportable

**Accepted when** — Each report runs for any period and exports

### D18 · Phase 3 notifications

**What REDUX gets** — Customer: feedback and review request 30 days after handover. Team: service request raised, stock below minimum

**Accepted when** — Each message fires on its trigger

---

## Project services

### D19 · Detailed blueprint & delivery timeline

**What REDUX gets** — Final scope, screen list, workflows and phase-wise timeline, for REDUX sign-off before build

**Accepted when** — Signed off by REDUX

### D20 · UI designs

**What REDUX gets** — Screen designs for the website, portals and surveyor app, approved by REDUX before development

**Accepted when** — Approved by REDUX

### D21 · Testing & UAT

**What REDUX gets** — Internal QA of every deliverable; user acceptance testing with the REDUX team at the end of each phase

**Accepted when** — UAT signed off per phase

### D22 · Deployment & go-live

**What REDUX gets** — Production setup and launch of each phase

**Accepted when** — Phase live in production

### D23 · Training & user guides

**What REDUX gets** — Role-wise training for admin, care executives and surveyors; short user guide per role

**Accepted when** — Training delivered; guides handed over

---

## Delivery dependency stated in the contract

> *Delivery depends on REDUX sharing its rate card, fitting types, finishes, lead channels, and
> access to its Meta, Google Ads and WhatsApp Business accounts.*

This is not boilerplate. Three of those items are on the critical path and are tracked as
blockers in `../06-delivery/09-risk-register.md`:

| Needed from REDUX | Blocks | Needed by |
|---|---|---|
| Meta Business Manager + Page admin access | D3 (Meta lead ads), Meta App Review | Week 0 |
| WhatsApp Business number + Business Verification | D3, D5 (WhatsApp notifications) | Week 0 |
| Google Ads account access | D3 (Google Ads lead forms) | Week 2 |
| Rate card (prices per fitting type / work type / finish) | D9, and therefore D10 quotations | Week 10 |
| Fitting types, brands, finishes master lists | D7 surveyor app dropdowns | Week 9 |
| Warranty periods (mechanical, finish) | D11 warranty cards, D10 quote terms | Week 13 |

---

## Deliverable → phase → go-live map

| Phase | Deliverables | Go-live |
|---|---|---|
| Phase 1 — Capture & convert | D1, D2, D3, D4, D5, D6 | Thu 10 Dec 2026 |
| Phase 2 — Survey & quote | D7, D8, D9, D10, D11, D12 | Thu 18 Feb 2027 |
| Phase 3 — Retain & control | D13, D14, D15, D16, D17, D18 | Thu 25 Mar 2027 |
| Project services (run across all phases) | D19, D20, D21, D22, D23 | Continuous; final handover Thu 9 Apr 2027 |
