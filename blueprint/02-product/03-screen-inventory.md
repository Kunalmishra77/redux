# 03 — Screen Inventory

Every screen, its route, its role, its deliverable and the phase it ships in.
Design specs: `../04-design/`. This is the checklist D20 (UI designs) is signed off against.

**Count: 61 screens** — 18 website, 21 CRM/admin, 12 surveyor app, 10 customer portal.

---

## A. Website — reduxbath.com · D1 · Phase 1

| # | Screen | Route | Notes |
|---|---|---|---|
| A1 | Home | `/` | Hero → problems → services → why REDUX → gallery → process → downtime → enquiry |
| A2 | Services — Restore function | `/services/restore-function` | |
| A3 | Services — Restore the finish | `/services/restore-finish` | Chrome + coloured PVD |
| A4 | Services — Improve efficiency | `/services/water-efficiency` | |
| A5 | For Hotels | `/hotels` | The main B2B landing page; assessment & pilot process |
| A6 | For Homes | `/homes` | |
| A7 | For Dealers | `/dealers` | |
| A8 | Why REDUX / About Eurobrass | `/why-redux` | 50 years of manufacturing; parts made to fit |
| A9 | Before & after gallery | `/work` | Filterable by fitting type and finish |
| A10 | Case study detail | `/work/[slug]` | Hotel engagement stories |
| A11 | The assessment & pilot process | `/process` | Straight from the deck |
| A12 | Contact | `/contact` | **Required for Razorpay KYC** |
| A13 | Book free assessment (form) | `/book-assessment` | Also a modal from every CTA |
| A14 | Dealer enquiry (form) | `/dealer-enquiry` | |
| A15 | Terms of Service | `/terms` | **Required for Razorpay KYC** |
| A16 | Privacy Policy + DPDP notice | `/privacy` | **Required.** Downloadable in Eighth Schedule languages on request |
| A17 | Refund & Cancellation | `/refunds` | **Required for Razorpay KYC** |
| A18 | Thank you / next steps | `/thank-you` | Sets the expectation: we call within X hours |

**Global:** floating WhatsApp button; sticky "Book free assessment" CTA on mobile; grievance-officer
block in the footer.

---

## B. CRM & Admin · Phase 1 unless noted

### B1. Shared

| # | Screen | Route | Role | D |
|---|---|---|---|---|
| B1 | Login | `/login` | all staff | D6 |
| B2 | Forgot / reset password | `/login/reset` | all staff | D6 |
| B3 | App shell + nav | — | all staff | D6 |
| B4 | My profile & notification prefs | `/me` | all staff | D6 |

### B2. Lead CRM · D2, D3

| # | Screen | Route | Role |
|---|---|---|---|
| B5 | Lead list (all sources, filters, bulk actions) | `/leads` | admin, cc_exec |
| B6 | **My leads** queue (SLA-sorted) | `/leads/mine` | cc_exec |
| B7 | Lead detail — timeline, call, book survey | `/leads/[id]` | admin, cc_exec |
| B8 | Pipeline board (New → Won, drag) | `/leads/board` | admin, cc_exec |
| B9 | New lead (manual — calls & walk-ins) | `/leads/new` | admin, cc_exec |
| B10 | **Integration health** (last received per source) | `/admin/integrations` | admin |

### B3. Care Executive Portal · D4

| # | Screen | Route | Role |
|---|---|---|---|
| B11 | WhatsApp inbox (conversations + templates) | `/inbox` | admin, cc_exec |
| B12 | Follow-ups due | `/follow-ups` | cc_exec |
| B13 | Survey booking (date · slot · surveyor) | modal on B7 | cc_exec |
| B14 | Call log & recordings | `/calls` | admin, cc_exec (own) |
| B15 | My performance | `/me/stats` | cc_exec |

### B4. Surveys, quotes & jobs (web side) · D7–D12 · **Phase 2**

| # | Screen | Route | Role |
|---|---|---|---|
| B16 | Survey schedule / calendar | `/surveys` | admin, cc_exec |
| B17 | Survey detail — audit record, photos, map | `/surveys/[id]` | admin, cc_exec, surveyor (own) |
| B18 | Quotation list | `/quotes` | admin, surveyor (own) |
| B19 | Quotation builder / editor | `/quotes/[id]` | admin, surveyor |
| B20 | Quotation preview (the PDF source) | `/quotes/[id]/preview` | admin, surveyor |
| B21 | Discount approval queue | `/admin/discounts` | admin |
| B22 | Job list | `/jobs` | admin, cc_exec |
| B23 | Job detail — stages, batches, delays | `/jobs/[id]` | admin, cc_exec |
| B24 | **Room status board** (per property) | `/jobs/[id]/board` | admin, cc_exec |
| B25 | Handover & sign-off | `/jobs/[id]/handover` | admin, surveyor |

### B5. Super Admin · D14–D17 · **Phase 3**

| # | Screen | Route | Role |
|---|---|---|---|
| B26 | **Dashboard** (KPIs, leads by source, team perf, stock alerts) | `/admin` | admin |
| B27 | Rate card editor + versions | `/admin/rate-card` | admin |
| B28 | Master lists (fitting types, brands, finishes, work types, reasons) | `/admin/masters` | admin |
| B29 | Users & roles | `/admin/users` | admin |
| B30 | Cities & assignment rules | `/admin/assignment` | admin |
| B31 | Stock & parts | `/admin/stock` | admin |
| B32 | Stock movements | `/admin/stock/movements` | admin |
| B33 | Invoices | `/admin/invoices` | admin |
| B34 | Payments & reconciliation | `/admin/payments` | admin |
| B35 | Notification rules & templates | `/admin/notifications` | admin |
| B36 | Reports | `/admin/reports` | admin |
| B37 | Audit log | `/admin/audit` | admin |
| B38 | Service requests queue | `/service-requests` | admin, cc_exec |
| B39 | DPDP: consent ledger & data-subject requests | `/admin/privacy` | admin |

---

## C. Surveyor mobile app · D7, D8, D10 · **Phase 2** · Android, Expo

| # | Screen | Notes |
|---|---|---|
| C1 | Login (email + password, long-lived session) | Field staff should not be logged out mid-visit |
| C2 | **Device onboarding** — battery/autostart deep-link, permissions | Ships in the first build, not later |
| C3 | Today's visits | Time, property, unit count, Navigate, Check in |
| C4 | Visit detail — unit list, progress | "12 of 18 units done" |
| C5 | **GPS check-in** | Accuracy shown; warns above 50 m |
| C6 | Unit (room) — fitting list | Add unit if the list is wrong |
| C7 | **Fitting capture** — type, brand, model, finish | From synced master lists |
| C8 | **Photo capture — 4 slots** | Front, side, top, close-up. Cannot save incomplete |
| C9 | Condition checklist + recommendation | Multi-select flags; restore/repair/replace |
| C10 | Quote preview on site — three options side by side | The "You save" moment |
| C11 | **Sync status** — progress, retry, needs attention | "187 / 200 photos uploaded" |
| C12 | Handover capture — after-photos + customer sign-off | Used at the end of a job, not the survey |

---

## D. Customer Portal — my.reduxbath.com · D13 · **Phase 3**

| # | Screen | Route |
|---|---|---|
| D1s | OTP login | `/login` |
| D2s | Dashboard — active job, warranty summary | `/` |
| D3s | Job progress (7 stages, batch view) | `/jobs/[id]` |
| D4s | Restored fittings — before/after by unit | `/fittings` |
| D5s | Quotes (view, approve by OTP) | `/quotes/[id]` |
| D6s | Invoices & payment | `/invoices` |
| D7s | Warranty cards | `/warranty` |
| D8s | Raise a service request | `/service-requests/new` |
| D9s | My service requests | `/service-requests` |
| D10s | **My data** — export, correct, withdraw consent, erase | `/privacy` |

---

## Screens by phase

| Phase | Website | CRM/Admin | Surveyor | Customer | Total |
|---|---|---|---|---|---|
| Phase 1 | 18 | 15 (B1–B15) | — | — | **33** |
| Phase 2 | — | 10 (B16–B25) | 12 | — | **22** |
| Phase 3 | — | 14 (B26–B39) | — | 10 | **24** |

*(Phase 2 and 3 also revisit Phase 1 screens where a new capability adds to them — e.g. the lead
detail screen gains a link to its survey in Phase 2.)*

---

## Design sign-off (D20)

UI designs are approved **per phase, before that phase's development starts**:

| Design sprint | Covers | Approved by |
|---|---|---|
| DS1 (Week 1–2) | Website + CRM + Care Executive Portal | Before Week 3 |
| DS2 (Week 9–10) | Surveyor app + quotation + job tracking | Before Week 11 |
| DS3 (Week 18–19) | Customer portal + Super Admin dashboard | Before Week 20 |
