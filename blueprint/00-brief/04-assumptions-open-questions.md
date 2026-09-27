# 04 — Assumptions, Open Questions and Client Inputs

Everything the blueprint had to decide without REDUX in the room. Three sections:
**(A)** what we need FROM REDUX and by when, **(B)** assumptions we made and will build on
unless corrected, **(C)** things explicitly out of scope.

Anything marked `[CLIENT INPUT NEEDED]` anywhere in this blueprint appears in section A.

---

## A. Client inputs needed (blocking)

| # | What we need | Blocks | Needed by | Owner |
|---|---|---|---|---|
| A1 | Meta Business Manager access + admin on the REDUX Page; Business Verification completed | D3, Meta App Review (the long pole) | **Week 0** | REDUX |
| A2 | WhatsApp Business phone number, not active on the consumer WhatsApp app; display name decision | D3, D5 | **Week 0** | REDUX |
| A3 | Company KYC pack: PAN, CIN/partnership deed, GST certificate, cancelled cheque, signatory PAN+Aadhaar | Razorpay KYC, DLT registration | **Week 0** | REDUX |
| A4 | Google Ads account access (or confirmation there is no Google Ads yet) | D3 | Week 2 | REDUX |
| A5 | Domain control for reduxbath.com + my.reduxbath.com (DNS) | D1, D13 | Week 1 | REDUX |
| A6 | Brand assets: logo files (SVG/PNG), any brand guide, photography for before/after gallery | D1, D20 | Week 1 | REDUX |
| A7 | Hotel reference list cleared for public use on the website | D1 | Week 3 | REDUX |
| A8 | **Master lists**: fitting types, brands, finishes, work types | D7, D9 | Week 9 | REDUX |
| A9 | **Rate card**: price per fitting type × work type × finish, plus market replacement prices | D9, D10 | **Week 10** | REDUX |
| A10 | Warranty periods: mechanical work, restored finish — and the exact warranty text | D10, D11 | Week 13 | REDUX |
| A11 | GST details: GSTIN, invoice series preference, HSN/SAC codes confirmed by their CA | D10, D13 | Week 14 | REDUX + CA |
| A12 | Bank account for Razorpay settlement | D13 | Week 17 | REDUX |
| A13 | Team list with roles and cities (care executives, surveyors, admins) | D6 | Week 6 | REDUX |
| A14 | Decision on call recording (yes/no) and the announcement script | D4 | Week 6 | REDUX |

---

## B. Assumptions we are building on

Each has a **default** we will implement and the **trigger** that would change it.

### B1 — Volume
**Assumption:** ~300–500 leads/month, ~100 surveys/month, ~50 internal users, ~300 GB of photos
in year one.
**Why it matters:** sizes the Supabase plan, the VPS and the cost model in
`../01-research/06-cost-model.md`.
**Trigger to revisit:** sustained >1,500 leads/month or >1 TB photos.

### B2 — Surveyors are Android-only
**Assumption:** field surveyors use Android phones (budget to mid-range). No iOS build in scope.
**Why:** halves mobile effort and removes the App Store review cycle.
**Trigger:** REDUX issues iPhones to surveyors. Expo makes an iOS build possible later, but it is
a change request (≈2 weeks + Apple account).

### B3 — One surveyor owns a visit
**Assumption:** a survey is assigned to exactly one surveyor, who is the only person editing it
offline. No two surveyors edit the same audit simultaneously.
**Why:** this is what lets us use a simple outbox queue instead of a full sync engine
(see ADR-006). It is the single most important assumption in the mobile architecture.
**Trigger:** if REDUX wants two surveyors on one large property simultaneously, we partition by
*unit* (room), not by survey — a small change. Only true concurrent editing of the same fitting
would force PowerSync.

### B4 — WhatsApp is the primary customer channel, SMS is only OTP fallback
**Assumption:** all customer notifications go over WhatsApp. SMS is used only for login OTP when
the customer has no WhatsApp, which keeps DLT registration down to ~3 templates.
**Why:** WhatsApp is outside TRAI DLT, richer, and cheaper at volume.
**Trigger:** REDUX wants SMS campaigns — then full DLT template registration applies.

### B5 — Quotes are approved by OTP, not Aadhaar eSign
**Assumption:** OTP + a full audit trail (see `../03-architecture/04-auth-security-rls.md`) is the
standard approval. Legally this is a valid e-contract under IT Act s.10A but does **not** carry
s.85B's presumption — our audit trail is what makes it defensible.
**Trigger:** a hotel's legal team demands a certified signature, or job value routinely exceeds
₹5 L. Then we add Aadhaar eSign via an ASP (Leegality/Digio) as a phase-2 option.

### B6 — REDUX is below the ₹5 Cr e-invoicing threshold
**Assumption:** no IRP/IRN e-invoicing is required; the platform issues GST-compliant invoices
directly.
**Why it matters:** IRP integration via a GSP is ~2 weeks of work we have not budgeted.
**Trigger:** REDUX confirms AATO ≥ ₹5 Cr in any FY since 2017-18 — then it is **permanent** and
must be built. **Must be confirmed with REDUX's CA before Week 14.** `[CLIENT INPUT NEEDED]`

### B7 — Payments are collected, not held in escrow
**Assumption:** the portal shows invoices and takes payment via Razorpay Payment Links; hotel
invoices above ~₹50,000 route to a **per-invoice virtual account (NEFT/RTGS)** to avoid MDR.
**Why:** a 2% card MDR on a ₹3,00,000 hotel invoice is ₹6,000. Virtual accounts cost a small flat fee.
Also note **UPI P2M MDR of 0.4% (capped ₹300) starts 15 Oct 2026** on transactions above ₹2,000.
**Trigger:** REDUX wants advance/part payment schedules — that is a milestone-billing feature,
currently out of scope.

### B8 — English-only UI in v1
**Assumption:** all interfaces in English. Hotel engineering teams and REDUX staff operate in English.
**Trigger:** if surveyors need Hindi, the app strings are already externalised — adding Hindi is
~3 days, not a rewrite. Note DPDP requires *notices* to be available in the Eighth Schedule
languages **on request**, which we handle as a downloadable translated notice, not a full UI translation.

### B9 — Civil work is recorded, not managed
**Assumption:** when a unit is blocked on the hotel's maintenance panel doing civil work, we set
`job_units.blocked_reason = 'civil_work'` and stop the clock, so REDUX's delay metrics stay honest.
We do not schedule or track the hotel's contractors.

### B10 — Stock is at Eurobrass, tracked at item level, not batch/serial
**Assumption:** `stock_items` with quantity and minimum level. No serial-number tracking, no
multi-warehouse, no valuation.
**Trigger:** if REDUX wants stock valuation or serial traceability, that is an ERP feature and
a change request.

### B11 — Pricing shown to customers includes GST
**Assumption:** quotation totals are shown inclusive of GST, with the tax split itemised, as the
demo deck shows. Services assumed at 18%.
**Trigger:** CA advises a different rate or a mixed goods/services split — the schema already
stores per-line tax rate, so this is configuration, not code.

### B12 — No integration with REDUX's accounting software
**Assumption:** invoices are exported as CSV/PDF for the accountant.
**Trigger:** Tally/Zoho Books sync is a change request (~1–2 weeks).

---

## C. Explicitly out of scope for this contract

These are not refusals — they are good ideas that are not in D1–D23. Each is a priced change
request when REDUX wants it.

| Out of scope | Note |
|---|---|
| iOS build of the surveyor app | See B2 |
| Hindi or regional-language UI | See B8 |
| e-Invoicing (IRP/IRN) via GSP | See B6 — becomes mandatory if AATO ≥ ₹5 Cr |
| Aadhaar eSign on quotations | See B5 |
| Accounting-software sync (Tally, Zoho) | See B12 |
| Vendor/purchase-order management, payroll, GL | Not an ERP |
| Machine-level production tracking at the factory | Stage-level only |
| Self-service online ordering without a survey | Every job passes through a survey by design |
| Multi-country or multi-currency | India, INR only |
| AI photo-based damage detection | Interesting; needs a labelled dataset REDUX does not have yet. Revisit after 12 months of audit photos have accumulated — the platform is building that dataset as a by-product. |
| Customer mobile app | The customer portal is a responsive web app |

---

## D. Decisions we need REDUX to make (not just data)

| # | Question | Options | Our recommendation |
|---|---|---|---|
| D-a | Is the free survey genuinely always free, including for a 200-room hotel 200 km away? | Always free / free within NCR / free above N rooms | Always free within Delhi NCR; travel recovered in the quote outside it |
| D-b | Who approves a discount, and above what percentage? | Super Admin only / a threshold | Surveyor can quote rate-card price; any discount >5% routes to Super Admin |
| D-c | Should the customer portal show the *market replacement* price? | Yes / No | Yes — "You save" is REDUX's strongest argument |
| D-d | Can a customer raise a service request under warranty from the portal? | Yes / call only | Yes — it is D13 scope and it captures repeat revenue |
| D-e | Call recording: on or off? | On / off | On, with a compliant announcement and 90-day retention — it is how you coach the care team |
| D-f | Does a dealer get a login? | Yes / no | Not in v1. Dealer enquiries land in the CRM as a source. A dealer portal is a change request. |
