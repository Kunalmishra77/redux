# Product Requirements Document — REDUX Platform

**Version** 1.0 · 26 September 2026
**Scope** D1–D23 (`../00-brief/02-deliverables-D1-D23.md`)
**Status** For REDUX sign-off (D19)

---

## 1. Product in one paragraph

One connected platform that follows a bath-fitting restoration enquiry from the first click to a
warrantied, back-in-service room. A public website captures enquiries from six channels into a
single source-tagged CRM. A care executive calls, qualifies and books a **free on-site survey**.
A surveyor audits each fitting on a mobile app that works with no signal, capturing four mandatory
photos per fitting and a condition checklist, and builds a quotation that prices **restore, repair
and replace** side by side against market replacement. The customer approves by OTP, which
automatically creates their account and the job. The job is tracked through seven stages —
including restoration at the Eurobrass factory — to handover, after-photos and an active warranty
the customer can see in their own portal. Above all of it, a Super Admin sees leads by source,
team performance, job status and stock in real time.

## 2. Goals and non-goals

### Product goals
| # | Goal | Measured by |
|---|---|---|
| G1 | No lead is lost or worked twice | 0 leads without a source tag; 0 duplicate phone numbers worked by two executives |
| G2 | Every survey produces a structured, evidence-backed record | 100% of audited fittings have 4 photos and a condition checklist |
| G3 | Quotes are consistent and priced from one controlled rate card | 0 quotes priced off-card without a logged discount approval |
| G4 | The customer never has to ask "what's the status?" | Job status visible in the portal within seconds of a stage change |
| G5 | REDUX can see the whole operation without asking anyone | Dashboard figures reconcile to the underlying records |

### Non-goals (see `../00-brief/04-assumptions-open-questions.md` §C)
Not an ERP. Not a factory MES. Not e-commerce. Not a civil-works manager. No iOS app,
no regional-language UI, no accounting sync in v1.

## 3. Users

| Role | Where they work | What they need most |
|---|---|---|
| **Care Executive** | Desktop, all day in the CRM | Call the next lead and book a survey in as few clicks as possible |
| **Surveyor** | Android phone, on site, often no signal | Record a fitting fast and never lose a photo |
| **Super Admin** | Desktop, reviews daily | Truth about leads, team, jobs and stock without asking |
| **Customer** | Phone or desktop, occasional | See what was done, what it cost, and that the warranty is live |

## 4. Feature specification

Each feature names its deliverable ID. Nothing is built without one.

---

### 4.1 Website — reduxbath.com · **D1**

A marketing site that explains, proves and converts, following the argument order of REDUX's own
pitch deck.

**Sections** (copy in `../05-content/01-website-copy.md`, layout in `../04-design/03-screens-website.md`):
1. Hero — "Your existing fittings may have more service life ahead" + **Book free assessment** CTA
2. Problems we solve — recurring faults, unavailable parts, worn finishes
3. Services — restore function, restore the finish, improve efficiency
4. Why REDUX — parts made to fit, function & finish, a planned alternative (50 years of Eurobrass)
5. Before/after gallery + hotel engagements
6. Assessment & pilot process, step by step
7. Downtime & work planning
8. Enquiry forms — **three separate forms: Home, Hotel, Dealer**
9. Floating WhatsApp button

**Required by Razorpay KYC and the E-Commerce Rules, so in Phase 1 scope:**
Terms, Privacy Policy, Refund/Cancellation policy, Contact, and a grievance-officer block.

**Functional requirements**
| ID | Requirement |
|---|---|
| D1-01 | Mobile-responsive; Core Web Vitals green on 4G |
| D1-02 | Every form submission creates a lead in the CRM with its source, campaign and UTM parameters |
| D1-03 | Hotel form captures property name, city, room count, role of enquirer |
| D1-04 | Dealer form captures firm name, city, GSTIN (optional) |
| D1-05 | WhatsApp button opens a chat with a pre-filled message that identifies the page it came from |
| D1-06 | DPDP consent checkboxes: service contact (required) and marketing (optional, unticked) |
| D1-07 | Honeypot + rate limiting on forms; no CAPTCHA unless abuse is observed |
| D1-08 | All outbound links used in SMS must be on the reduxbath.com domain (DLT whitelisting) |

**Acceptance (contract)** — *Site is live and every form submission reaches the CRM with its source.*

---

### 4.2 Lead CRM · **D2**

One inbox. Everything else in Phase 1 hangs off this.

| ID | Requirement |
|---|---|
| D2-01 | Single lead list across all sources, with filters by source, status, city, executive, date |
| D2-02 | **Source tagging**: channel, campaign, ad set / ad ID, form ID, WhatsApp template, `ctwa_clid` — stored at creation, never backfillable |
| D2-03 | **Duplicate check by phone number** (normalised to E.164). A repeat enquiry attaches to the existing lead as a new *touch*, and does not create a second row |
| D2-04 | **Auto-assignment** to a care executive by city, else round-robin. Reassignment is logged |
| D2-05 | **Instant WhatsApp reply** on lead creation (utility template) |
| D2-06 | **Call-back timer** per lead with an SLA; breach alerts the executive and the admin |
| D2-07 | **Pipeline board**: New → Contacted → Survey booked → Surveyed → Quoted → Won, plus Lost |
| D2-08 | **Lost requires a reason** from a controlled list (price, timing, not restorable, no response, competitor, other + note) |
| D2-09 | Full activity timeline per lead: calls, messages, status changes, notes, who and when |
| D2-10 | A Won lead automatically creates the customer account and the job (see D10) |
| D2-11 | Consent record captured at lead creation and visible on the lead |

**Statuses after Won** are job statuses, not lead statuses: In restoration → Completed →
Warranty active.

**Acceptance (contract)** — *A test lead is tagged, de-duplicated, assigned and auto-replied
without manual work.*

---

### 4.3 Lead source integrations · **D3**

Seven sources. Integration detail in `../03-architecture/06-integrations-runbook.md`.

| Source | Mechanism | Notes |
|---|---|---|
| Website forms | Direct server action | Three forms, each tagged |
| Dealer enquiry | Direct server action | Separate form + source |
| **Meta lead ads** | `leadgen` webhook + retrieval + **15-min reconciliation poll** | 90-day retention makes the poll mandatory |
| **WhatsApp chats** | `messages` webhook | Capture the `referral` object for CTWA |
| **WhatsApp campaigns** | Outbound template + inbound reply | Attribute by template + campaign |
| **Google Ads lead forms** | Webhook with `google_key` | **Never 4XX** — Google does not retry |
| Calls & walk-ins | Manual entry | With source and who took it |

| ID | Requirement |
|---|---|
| D3-01 | Every webhook verifies its signature on the raw body and returns 200 in <200 ms |
| D3-02 | Raw payload stored before processing; idempotent on the provider's ID |
| D3-03 | Failed processing retries with backoff and dead-letters with an admin alert |
| D3-04 | Meta reconciliation poll runs every 15 minutes and closes any webhook gap |
| D3-05 | `ctwa_clid`, `ad_id`, `form_id`, `campaign_id` persisted on the lead at creation |
| D3-06 | **CAPI events fired to Meta on `survey_booked` and `job_won`** so ads optimise on outcomes |
| D3-07 | An integration health screen shows last-received time per source; silence >6 h alerts admin |

**Acceptance (contract)** — *A sample lead from each of the 7 sources lands in the CRM.*

---

### 4.4 Care Executive Portal · **D4**

Built around one question: *who do I call next, and can I book their survey in this call?*

| ID | Requirement |
|---|---|
| D4-01 | **My leads** queue, prioritised by SLA timer, filterable by source |
| D4-02 | **Click-to-call**; every call logged with duration and outcome against the lead |
| D4-03 | **Call outcome** from a controlled list, with a reason where required |
| D4-04 | **Book free survey** inline: date, slot, nearest available surveyor — without leaving the lead |
| D4-05 | Surveyor availability respects existing bookings and city |
| D4-06 | Confirmation WhatsApp to the customer fires on booking |
| D4-07 | **Follow-up reminders** — set, snooze, and a missed-follow-up alert |
| D4-08 | **WhatsApp inbox** with approved templates; free-text only inside the 24-h service window |
| D4-09 | Own performance stats: calls made, surveys booked, conversion |
| D4-10 | Call recording, where enabled: announcement, consent capture, 90-day retention, role-gated playback |

**Acceptance (contract)** — *A care executive can call, log the outcome and book a survey from one screen.*

---

### 4.5 Surveyor mobile app · **D7**

The deck calls this the *Redux Hub app*. Android, offline-first. Architecture in ADR-005/006.

| ID | Requirement |
|---|---|
| D7-01 | Daily visit list with navigation to the property |
| D7-02 | **GPS check-in** with timestamp; accuracy stored; >50 m accuracy flagged; server-side geofence and impossible-travel checks |
| D7-03 | Room-by-room (unit-by-unit) record; add units on site if the list is wrong |
| D7-04 | Per fitting: type, brand, model, current finish — from admin-controlled master lists |
| D7-05 | **4 mandatory photos per fitting**: front, side, top, close-up. A fitting cannot be saved incomplete |
| D7-06 | **Condition checklist**: leak, stiff control, scaling, worn finish, part unavailable (multi-select) |
| D7-07 | Recommendation per fitting: restore / repair / replace, with a free-text note |
| D7-08 | **Fully offline**: every screen works with no network; all writes queue locally |
| D7-09 | **No photo is ever lost** — attachment row committed in the same transaction as the fitting; local file deleted only after remote existence is confirmed; startup reconciler re-enqueues orphans |
| D7-10 | **Submit Visit blocked** while any attachment is unsynced; a clear "needs attention" screen lists what is pending |
| D7-11 | Photos compressed at capture (1600 px q0.72; close-up 2048 px q0.8) and stamped with date, GPS and visit ID |
| D7-12 | Visible sync progress ("187 / 200 photos uploaded") with a foreground service for the journey back |
| D7-13 | Onboarding screen that deep-links to OEM battery/autostart settings |

**Acceptance (contract)** — *A full audit done without network syncs completely once back online.*

---

### 4.6 Restore / repair / replace assessment · **D8**

REDUX's core commercial argument, encoded.

| ID | Requirement |
|---|---|
| D8-01 | Every audited fitting gets a recommended treatment |
| D8-02 | **All three options are priced side by side**: restore or repair · Eurobrass replacement · market replacement |
| D8-03 | Prices come from the active rate card version; the version ID is stored on the line |
| D8-04 | The "You save" amount = market replacement − recommended option |
| D8-05 | Suitability caveat shown wherever a recommendation appears (the deck's own footnote: available repairs and finishes depend on the condition of each fitting) |
| D8-06 | Where a part is unavailable, the app states that Eurobrass can re-machine it — this is the differentiator and must be visible to the customer |

**Acceptance (contract)** — *Every audited fitting shows all three options with prices.*

---

### 4.7 Rate card · **D9**

| ID | Requirement |
|---|---|
| D9-01 | Price per **fitting type × work type × finish**; plus market replacement price per fitting type |
| D9-02 | **Versioned.** Editing creates a new version; old quotes keep pricing from their version forever |
| D9-03 | Effective-from date; only one active version at a time |
| D9-04 | CSV import and export (template: `../data/rate-card-template.csv`) |
| D9-05 | Admin-editable without developer help |

**Acceptance (contract)** — *Quotes price correctly from the loaded rates.*

---

### 4.8 Quotation & OTP approval · **D10**

| ID | Requirement |
|---|---|
| D10-01 | Quote generated from the audit — no re-typing |
| D10-02 | Before/after visuals per fitting (site photo + finish reference) |
| D10-03 | Totals incl. GST, tax split itemised, market price and **"You save"** shown |
| D10-04 | **15-day validity**; expiry blocks approval and requires a re-quote |
| D10-05 | Warranty terms **snapshotted onto the quote**, versioned — the customer sees exactly what they accepted |
| D10-06 | Branded PDF via Gotenberg; **₹ glyph must render** (test asserts this) |
| D10-07 | Share on WhatsApp (utility template with a document attachment) |
| D10-08 | **OTP approval** with the full audit trail in `../01-research/05-india-compliance.md` §6 |
| D10-09 | Discounts above the configured threshold route to Super Admin approval before the quote can be sent |
| D10-10 | On approval: customer account + job created automatically, CAPI `job_won` fired, signed PDF + audit trail emailed to the customer |
| D10-11 | Quote versions are immutable; a change creates v2 and supersedes v1 |

**Acceptance (contract)** — *An OTP-approved quote creates the customer account and job with no
manual step.*

---

### 4.9 Job tracking · **D11**

Seven stages, from the deck's own downtime protocol.

`dates_confirmed → removal_pickup → at_eurobrass → quality_check → refit_test → handover → warranty_active`

| ID | Requirement |
|---|---|
| D11-01 | Stage transitions logged with who, when and a note |
| D11-02 | **Room batches** — units grouped around the property's approved work dates |
| D11-03 | **Live room status board** per property, visible to both REDUX and the customer |
| D11-04 | **Delay alerts** when a unit exceeds its planned downtime |
| D11-05 | **Blocked reason** with a `civil_work` value that stops the delay clock — the hotel's maintenance panel is not REDUX's delay |
| D11-06 | Pilot jobs flagged; a wider project can be created from a pilot and linked to it |
| D11-07 | Handover: after-photos, leak/operation/finish check, customer sign-off |
| D11-08 | **Warranty cards generated on handover** — mechanical and finish, each with its own validity |

**Acceptance (contract)** — *A multi-room hotel job is tracked room by room through to handover.*

---

### 4.10 Customer Portal — my.reduxbath.com · **D13**

| ID | Requirement |
|---|---|
| D13-01 | **OTP login** on the registered mobile (WhatsApp primary, SMS fallback) |
| D13-02 | Live job progress — the same stage data REDUX sees |
| D13-03 | Restored fittings, unit by unit, with before/after photos |
| D13-04 | Quotes and invoices, downloadable |
| D13-05 | **Online payment** — Payment Link ≤ ₹50,000; virtual account (NEFT/RTGS) above |
| D13-06 | Warranty cards with validity dates, mechanical and finish separately |
| D13-07 | **Raise a service request**, routed to the care team with a 48 h acknowledgement SLA |
| D13-08 | Grievance-officer block with name, contact and ID (E-Commerce Rules) |
| D13-09 | DPDP rights: download my data, request correction, withdraw consent, request erasure |
| D13-10 | A customer sees only their own properties (RLS-enforced, verified by test) |

**Acceptance (contract)** — *A customer logs in, pays a due invoice online and sees active warranties.*

---

### 4.11 Super Admin dashboard · **D14**

| ID | Requirement |
|---|---|
| D14-01 | KPI row: leads this month, free surveys done, survey-to-order conversion, quoted value, jobs at factory |
| D14-02 | Leads by source, with cost per lead and **cost per won job** where ad spend is available |
| D14-03 | Care executive performance: calls, surveys booked, conversion |
| D14-04 | Surveyor performance: visits, leads qualified, quote value |
| D14-05 | Stock alerts inline |
| D14-06 | Every figure drills through to the underlying records |
| D14-07 | Date-range selector; figures must reconcile to the records at any range |
| D14-08 | **Free-survey cost per won job** — the metric that tells REDUX whether the free survey still pays |

**Acceptance (contract)** — *Dashboard figures match the underlying records.*

---

### 4.12 Stock & parts · **D15**

| ID | Requirement |
|---|---|
| D15-01 | Items: cartridges, spares, finishes, replacement stock — with unit and current quantity |
| D15-02 | Minimum level per item; **alert fires when quantity falls below it** |
| D15-03 | Movements logged: in, out, consumed by job, adjusted (with reason) |
| D15-04 | Consumption can be linked to a job so usage per job is visible |

**Acceptance (contract)** — *Alert fires when an item falls below its minimum.*

---

### 4.13 Admin controls · **D16**

| ID | Requirement |
|---|---|
| D16-01 | Rate card editor with versioning (D9) |
| D16-02 | Users, roles, cities, permissions — invite, deactivate, reassign |
| D16-03 | Master lists: fitting types, brands, finishes, work types, condition flags, lost reasons |
| D16-04 | Discount approvals queue |
| D16-05 | Notification rules: which template fires on which trigger, toggleable |
| D16-06 | **No developer needed for any of the above** — this is the acceptance criterion |

**Acceptance (contract)** — *Admin changes prices and users without developer help.*

---

### 4.14 Reports & exports · **D17**

| ID | Requirement |
|---|---|
| D17-01 | Reports on leads, care team, surveys, quotes, jobs, stock |
| D17-02 | Daily, weekly, monthly, and **any custom date range** |
| D17-03 | CSV export of every report; PDF for the summary |
| D17-04 | Scheduled email of the weekly summary to Super Admin |
| D17-05 | Reports read from the same records as the dashboard — one source of truth |

**Acceptance (contract)** — *Each report runs for any period and exports.*

---

### 4.15 Notifications · **D5, D12, D18**

Full matrix with trigger, channel, template and category: `04-notifications-matrix.md`.

**The rule that governs every template:** transactional messages are **utility** category and carry
**no promotional content** — no offer, no discount, no "book another service". Utility is ₹0.115;
marketing is ₹0.8631. Meta reclassifies silently.

---

## 5. Cross-cutting requirements

| Area | Requirement |
|---|---|
| **Security** | RLS on every table. Private storage buckets with short-lived signed URLs. No service-role key outside server code. |
| **Audit** | Every status change, price change, permission change and approval writes to `audit_log` with actor, before, after, timestamp |
| **Consent** | Captured at every collection point, versioned against the notice text, withdrawable from the portal |
| **Retention** | Call recordings 90 days; photos retained per job, archived 2 years after closure; erasure on request |
| **Performance** | CRM list views <1 s at 50k leads; surveyor app screens usable on a 2 GB RAM Android phone |
| **Availability** | Webhooks must survive an app deploy — Cloudflare + rolling deploy; webhook events are durable before processing |
| **Accessibility** | WCAG 2.2 AA on the website and portals: contrast, focus states, labelled inputs, keyboard navigation |
| **Browser support** | Last 2 versions of Chrome, Edge, Safari, Firefox. Android Chrome for the customer portal |

## 6. Release plan

| Phase | Deliverables | Go-live |
|---|---|---|
| Phase 1 — Capture & convert | D1–D6 | **Thu 10 Dec 2026** |
| Phase 2 — Survey & quote | D7–D12 | **Thu 18 Feb 2027** |
| Phase 3 — Retain & control | D13–D18 | **Thu 25 Mar 2027** |

Week-by-week: `../06-delivery/01-master-timeline.md`.

## 7. Related documents
- Roles and permissions: `01-roles-permissions.md`
- Journeys: `02-user-journeys.md`
- Screens: `03-screen-inventory.md`
- Notifications: `04-notifications-matrix.md`
- Business rules (the logic that has to be exactly right): `05-business-rules.md`
- Data model: `../03-architecture/schema.sql`
