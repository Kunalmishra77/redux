# CR-001 — B2B Customer Lifecycle Platform

**Status:** Approved to start (8 Oct 2026) — decisions in §9; change-order paperwork runs in parallel (§10).
Work proceeds phase by phase; each phase is shown on staging and approved before the next starts.
**Raised:** 8 Oct 2026, after the client demo
**Scope:** new work beyond D1–D23. Nothing here is built until it has an approved CR deliverable
number (CLAUDE.md rule 10).

The client wants the platform to run the whole B2B relationship, not just capture leads:

**Website → Lead → Business profile → Scoring → Assessment decision (on-site / self) → Demo decision
(room / single fitting / none) → Proposal → Order → Work → Report → History → Repeat → Referral →
Rewards → Follow-up campaigns**

This document compares that ask with what exists, flags where it contradicts decided blueprint, and
lays out the build phase by phase: schema, rules, APIs, screens, integrations, and rollout.

---

## 1. Where we start from — the existing platform

Nothing here is in production yet. All data is demo data on staging, so schema changes are cheap now
and get expensive after go-live. That is the strongest argument for deciding §9 quickly.

| Area | What exists (built and tested) | Verdict |
|---|---|---|
| Stack | Next.js 16 App Router, Supabase Postgres + RLS + Storage, pgmq/pg_cron queue, Expo surveyor app, Vercel demo host | **Reuse**: no change |
| Auth | Staff email/password with role claim (hook); customer phone OTP (demo-simulated, production via Supabase phone auth); role-filtered RLS on every table | **Reuse**: extend to self-registration (§3.2) |
| Business accounts | `customers` (name, type, GSTIN, billing), `customer_contacts` (many contacts, one phone each), `properties` (sites), `property_units` (rooms) | **Reuse as the B2B account**: add group/chain, segment, owner, tier (§3.1) |
| Leads | `leads` with source, campaign, UTM, click ids, `previous_lead_id`, assignment, SLA, status machine, `lead_touches`, `lead_status_history`, notes, follow-ups | **Extend**: score, tier, business fields, referral, link to an existing account |
| Survey | `surveys`, check-ins with geofence, `fittings`, 4-slot `fitting_photos`, `fitting_conditions`, `assessments` (3 prices), `submit_survey` | **Reuse as the one assessment pipeline**: add a *remote/self* mode (§3.4) |
| Pricing | Versioned `rate_cards`, `market_prices`, BR-A* in `upsert_assessment` | **Reuse**: catalog products map onto it |
| Proposal | `quotations` + lines, discount gate, frozen terms, OTP approval with legal evidence, versions | **Reuse**: add referral/offer discounts (§3.6) |
| Execution | `jobs` (+ `is_pilot`, `parent_job_id`), units, batches, stages, blocks, handover, warranties | **Extend**: job kind `demo` (§3.5) |
| Money | Invoices (GST, gapless), payments, credit notes | **Reuse** |
| After-care | Service requests with SLA | **Reuse** |
| Messaging | Notification rules + 18 templates, WhatsApp inbox, outbox, quiet hours, consent ledger (DPDP) | **Extend**: marketing campaigns (§3.8) |
| Customer portal | Home, job progress, fittings before/after, quote approval, invoices + pay, warranty, service requests, My data | **Extend**: account history, reports, repeat request, branches, colleagues (§3.2) |
| Admin | Settings, masters, users, rate card, notifications, integrations, audit, privacy, reports | **Extend**: rules screens for scoring, assessment policy, demos, referrals, catalog, campaigns |
| Website | 18 pages, enquiry forms → lead + consent | **Rework**: B2B-only positioning, catalog, process story, premium design pass (§3.7) |

**Rule kept throughout:** business rules stay in Postgres functions and `lib/services/` with BR-IDs and
tests; every rule threshold lives in a table or `settings`, never in code (CLAUDE.md).

---

## 2. Conflicts with decided blueprint — need a decision before build

| # | Decided today | Client now asks | Proposal |
|---|---|---|---|
| C1 | Glossary: the survey is **free, for everyone**; "the word *free* is the offer"; website CTA "Book free assessment" | Survey only where the lead qualifies; self-assessment elsewhere | Keep the assessment free, but offer it by **mode**: on-site for qualified, self-assessment for the rest. CTA becomes "Request an assessment". New BR-S9 |
| C2 | Prospects have **no portal access** (`my_customer_ids()` excludes them); the quote-approval workaround reads one quote with the service role | Every business has an account from first contact | Prospects get a **limited account**: their requests, self-assessment, quotes. RLS by account membership instead of conversion status; workaround removed. ADR-016 |
| C3 | **Pilot** = a paid trial bathroom, a commercial stage (BR-J6) | Free one-room demo (high value) or single-fitting demo (medium) | Keep *Pilot* (paid). Add **Demo** (free, internal investment, approval-gated) as a separate concept. Glossary updated |
| C4 | Segments: hotels (primary), **homeowners (secondary)**, dealers | B2B only for now, B2C later | Keep the data model able to hold individuals (`customers.kind`), switch B2C **off** with a setting. Hide /homes and home-type forms. No rebuild needed later |
| C5 | Lead attribution locked to first touch (BR-L3) | "Referred by" must be tracked | Referral is a **separate dimension**, not a source overwrite. BR-L3 stays intact |
| C6 | Scope = D1–D23 on the contracted timeline | ~10 new capability areas | Contract change: new deliverables **D24–D33** (§10) with their own estimate and timeline |

---

## 3. Target design, module by module

### 3.1 B2B account model

```
customer_groups (brand/chain: "Radisson Hotel Group")
  └─ customers (the account: one legal business / branch that buys)        [exists, extended]
       ├─ customer_contacts (people; role: owner / engineering / accounts / purchase)  [exists, + role, + invited_by]
       ├─ properties (sites/branches; address, lat/lng, rooms)              [exists]
       │    └─ property_units (rooms/bathrooms)                              [exists]
       ├─ leads (every enquiry, including repeat ones: leads.customer_id)   [extended]
       └─ everything downstream (surveys, quotes, jobs, invoices, SRs, referrals, rewards)
```

New / changed columns:

| Table | Change |
|---|---|
| `customer_groups` (new) | `id, name, segment, hq_city_id, notes` — a chain whose branches refer each other and roll up in reports |
| `customers` | + `group_id`, `kind` (`business` \| `individual`, default business), `segment_id` (hotel, hospital, office, residential society, restaurant, club, …: master table), `legal_name`, `size_units`, `account_owner_id` (salesperson), `tier` (A/B/C, current), `lifetime_value` (derived), `source_lead_id` |
| `customer_contacts` | + `role_code`, `is_admin` (may invite colleagues), `invited_by`, `last_login_at` |
| `leads` | + `customer_id` (repeat business links here), `business_name`, `segment_id`, `estimated_units`, `estimated_value`, `pincode`, `score`, `tier`, `assessment_mode`, `demo_offer`, `referral_id` |
| `segments` (new master) | admin-editable list; B2C segments flagged `is_b2c` and hidden while `b2c_enabled = false` |

**One timeline for both sides.** `v_account_timeline`, a security-invoker **view**: a union over
the event tables that already exist (lead status history, calls, notes, touches, surveys,
quotations, approvals, job stage events, handovers, invoices, payments, service requests, messages)
plus the new ones (scores, demos, referrals, rewards, campaign touches), keyed by `customer_id` and
`lead_id`. No duplicate event store; RLS on each underlying table decides what staff and customers
see. A small `account_activities` table holds manual entries (meetings, visits) only.
*ADR-017: timeline as a view, not a copy.*

### 3.2 Customer accounts & portal (registration, history, repeat)

| Capability | How |
|---|---|
| Register | Website "Create business account": business name, segment, city/pincode, contact name, mobile (OTP), email, GSTIN (optional), how they heard + **referred by**. Creates `customers` (prospect) + contact + lead in one transaction (`register_business()`), with consent |
| Login / logout | Phone OTP (existing). Email magic link as a second option. Session per contact |
| Colleagues | Account admin invites colleagues by phone. Each branch is its own account; there is no cross-branch view for customers (Q3) |
| Dashboard | Active work, quotes to approve, invoices due, demos, assessments in progress |
| History | Tabs: Enquiries · Assessments (on-site and self) · Demos · Proposals · Orders/Jobs · Work done (rooms × fittings, before/after) · Invoices & payments · Warranty · Service · Referrals & rewards. All from `v_account_timeline` + existing tables |
| Reports | Downloadable PDFs: assessment report, demo report, completion/handover report (before/after per room), warranty certificate, invoice. Rendered by **Gotenberg** from the same React document components (ADR-010) |
| Repeat request | "Request again" on any past job or property: creates a lead with `customer_id`, `previous_lead_id`, the property and the fitting list prefilled. Scoring (§3.3) then decides whether a re-survey is needed, e.g. not if the same property was surveyed in the last N months (setting) |
| Access rules | RLS moves from "converted customers only" to **account membership** (`my_customer_ids()` includes prospects); each table's policy limits what a prospect sees (no draft quotes, no internal notes, no prices before a quote is sent) |

### 3.3 Lead scoring & categorisation (configurable rules engine)

Rules are **data**, evaluated in Postgres so the website, CRM, mobile app and cron all get the same
answer. *ADR-018: rules as data, evaluated by a SQL function, explained with a breakdown.*

| Table | Purpose |
|---|---|
| `scoring_rules` | `factor` (segment, estimated_units, estimated_value, distance_band, source, referral, repeat_customer, group_member, …), `operator`, `value`, `points`, `is_active`, `version` |
| `tier_thresholds` | in `settings`: A ≥ X points, B ≥ Y, else C |
| `lead_scores` | append-only history: `lead_id, score, tier, breakdown jsonb, rules_version, scored_by (system/user), override_reason` |
| `service_areas` | hubs with lat/lng + radius bands (near / regional / far) |
| `pincodes` (master) | pincode → lat/lng/district/state, for distance without a paid geocoder |

- `score_lead(lead_id)` runs on lead create/update (trigger → queue) and nightly (pg_cron). It writes
  `lead_scores` and sets `leads.score/tier`.
- **Manual override** of tier by a manager, with a reason, goes to the audit log and history.
- Admin screen: rules list with live **"test against lead…"** preview, version history, thresholds.

### 3.4 Assessment decision & self-assessment (three levels)

`assessment_policies` (admin-editable): **tier × distance band → assessment mode, demo offer,
follow-up cadence, owner role**. Seeded from the client's example:

| Tier | Near | Far |
|---|---|---|
| **A** (high value) | On-site survey · offer **room demo** · dedicated sales owner | On-site if value ≥ threshold, else self-assessment + video call · room demo |
| **B** (medium) | Self-assessment or selective on-site · offer **single-fitting demo** | Self-assessment · fitting demo (ship-in) |
| **C** (low) | Self-assessment on request · no demo · nurture cadence | Same |

`decide_assessment(lead_id)` returns the mode and offer, stored on the lead; a care executive can
override with a reason.

**Self-assessment reuses the survey pipeline (ADR-015).** A remote assessment is a `surveys` row with
`mode = 'self'`:

| Change | Detail |
|---|---|
| `surveys.mode` | `onsite` (today) · `self` · `video` |
| `surveyor_id` | nullable for `self`; new `reviewer_id` (the staff member who prices it) |
| Check-in / geofence | not applicable to `self` (constraint by mode) |
| Who writes fittings & photos | for `self`: the customer contact, through RLS on their own open self-survey; upload via **signed upload URLs** to `survey-photos` (same path scheme) |
| Photo slots | all four slots, same as the surveyor (Q7); `self_photo_slots_required` stays a setting |
| Catalog-guided capture | the wizard asks "which product is this?" from the catalog (§3.7) with pictures, then quantity, finish, condition, photos |
| Review | staff reviewer sees submitted items, may ask for more photos (status `needs_info` + WhatsApp), then prices with the same `upsert_assessment` |
| Output | **Assessment report** (PDF) to the customer + the normal `create_quote_from_survey` |

Result: one quotation, job, warranty and reporting path for every assessment mode, and nothing in
D8–D11 is rewritten.

### 3.5 Demo management (free room demo / single-fitting demo)

Separate from the paid **Pilot** (C3).

| Table | Purpose |
|---|---|
| `demo_types` (master) | `code` (room_demo, fitting_demo, …), name, scope limits (max units/fittings), internal **cost cap**, approval role, warranty yes/no, eligible tiers |
| `demos` | `lead_id, customer_id, property_id, type, status, requested_by, approved_by, approved_at, scheduled_for, team, internal_cost, job_id, result (pass/needs_work), customer_rating, feedback, converted_quote_id, converted_at` |

- Status machine: `proposed → approved/rejected → scheduled → in_progress → completed → feedback →
  converted | not_converted` (SQL function, BR-D1…).
- **Execution reuses jobs:** `jobs.kind` = `project` (today) · `pilot` · `demo`. A demo job may have
  no quotation (`quotation_id` nullable only when `kind = 'demo'`, enforced by check), and uses the
  same units, stages, blocks, handover, before/after photos and portal tracking.
- **Investment tracking:** internal cost per demo; reports show demo cost per converted job and
  conversion rate by demo type and tier.
- Approval goes to the role configured on the demo type (e.g. Super Admin above the cost cap).

### 3.6 Referral & reward system

| Table | Purpose |
|---|---|
| `referral_codes` | one per account (and optionally per contact); shareable link `/r/{code}` |
| `referrals` | `referrer_customer_id, referrer_contact_id, referred_lead_id, referred_customer_id, channel (code/link/manual), status (pending → qualified → converted → rewarded \| rejected), first_order_value, attributed_revenue, created_by` |
| `referral_benefits` | config for the **referred** business: discount %/flat, special price list, priority, which demo offers they forgo/keep |
| `reward_rules` | config for the **referrer**: trigger (each conversion / every N conversions / revenue ≥ ₹X / per group), reward type (discount %, flat credit, free fitting / **extra fit**, priority service, custom), validity, cap |
| `rewards` | ledger: issued → available → redeemed (against a quotation or invoice) / expired; append-only |

- Capture: "Referred by" on registration and every enquiry form (search existing accounts by name
  or code), the `/r/{code}` link, or staff entry. Self-referral and same-group conflicts are
  flagged for review.
- A referral **converts** when the referred business's first quotation is approved; revenue
  accrues on payment (`record_payment`). `evaluate_rewards(customer_id)` runs on those events.
- Benefits apply through the existing quote discount path. A referral discount up to its configured
  value is **pre-approved** (no BR-A6 approval round-trip); anything above still needs approval.
- Referrer's portal: referral code/link, counts (total, converted, pending), revenue generated,
  rewards available. Group roll-up for chains (Radisson Branch A → group total).
- Attribution stays separate from source (C5). Reports show both.

### 3.7 Catalog, process content & premium website

**Catalog (data, because it links to leads, quotes, demos and stock):**

| Table | Purpose |
|---|---|
| `product_categories` | tree: mixers, showers, diverters, accessories, … |
| `products` | `sku, slug, name, category_id, fitting_type_id` (maps onto the rate card), `brand_id`, description, `specs jsonb`, applications, benefits, `restore_info`, `finishes[]`, `is_published`, `sort` |
| `product_media` | images (brand bucket, public CDN), before/after pairs, documents |
| Links | `quotation_lines.product_id`, `fittings.product_id` (optional), `demos` items, self-assessment items, `stock_items.product_id` |

- Admin: catalog CRUD + CSV/Excel import for the client's catalog, image upload, publish toggle.
- Website: `/products`, `/products/[category]`, `/products/[slug]`, statically generated and
  revalidated on publish (`updateTag`). "Assess this product" leads into the self-assessment wizard
  or the enquiry form with the product preselected.

**Re-chroming & refurbishment process (content, rarely changes):** kept as typed content in the repo
(`lib/content/process.ts`), not in the database. Fastest pages, versioned with the site, reviewed
like code. Sections: what we do, inspection, strip & prep, layer build-up (materials and layer
order as the client supplies), plating/PVD, cartridge & mechanism rebuild, QC gates, before/after,
warranty. Presented as a scroll-driven step story with diagrams and real process photography.

**Premium website pass (design, after content arrives):** B2B-only IA (Hotels · Hospitality chains ·
Commercial buildings · Facility managers), credentials (clients, case studies with numbers), process
story, catalog, assessment & demo explanation, referral programme page, "Create business account".
Design direction to be agreed on 2–3 key pages before rollout.

### 3.8 Follow-up & campaign system

Existing `campaigns` holds ad campaigns (Meta/Google spend). The new tables are named
**outreach** to avoid confusion.

| Table | Purpose |
|---|---|
| `offers` | code, title, discount/benefit, validity, eligibility (tiers, segments, cities), max redemptions |
| `followup_cadences` | per tier/status: steps (day offset, channel, template, task for executive) |
| `outreach_campaigns` | name, audience **segment definition** (jsonb filter: tier, status incl. lost reason, segment, city, last activity, past customer, referrer), template, offer, schedule, status |
| `outreach_recipients` | per lead/customer: consent check result, message id, delivered/read/clicked, replied, converted lead id |

- Audiences resolve with a SQL function, so the preview count equals the send count.
- **Compliance gate:** only contacts with live **marketing consent** (DPDP, consent ledger) and an
  approved WhatsApp **marketing** template. Utility templates are never used for offers (Meta
  reclassifies them; 7.5× cost). Opt-out on reply "STOP" withdraws consent automatically.
- Sending: through the existing queue + quiet hours, throttled to Meta tier limits.
- Reactivation: a lost lead that responds is reopened (BR-L8) with the campaign as a touch.
- Executive cadences create `follow_ups` (existing) automatically per tier.

### 3.9 Reporting & analytics

New report tabs over the same data (SQL views; materialised for heavy ones, refreshed by pg_cron):

- Leads by tier / segment / source / referral; tier drift.
- Assessment mode mix; self-assessment turnaround; on-site vs self conversion.
- Demo funnel: proposed → approved → done → converted; **demo cost per won job**.
- Conversion and revenue by tier, segment, salesperson, surveyor.
- Repeat customers and repeat revenue; account lifetime value; group roll-ups.
- Referrals: count, conversion, revenue, rewards issued and redeemed, top referrers.
- Campaigns: sent, delivered, read, replied, reactivated, revenue; cost per reactivation.
- Product performance from catalog-linked lines.
- Export: CSV for every table (D17 pattern).

---

## 4. API & backend surface

Patterns stay as they are: **Server Actions** for UI writes, **Postgres functions** for rules,
**route handlers** only for public, mobile, webhook and cron entry points.

| Area | Postgres functions (new) | Server actions (new) | Route handlers (new) |
|---|---|---|---|
| Accounts | `register_business`, `invite_contact`, `accept_invite`, `link_lead_to_customer` | registerBusiness, inviteColleague, updateAccountProfile | `POST /api/public/register` (rate-limited) |
| Scoring | `score_lead`, `decide_assessment`, `override_tier` | overrideTier, saveScoringRule, testRuleAgainstLead | cron `/api/cron/rescore` (nightly) |
| Self-assessment | `start_self_assessment`, `add_self_item`, `submit_self_assessment`, `request_more_info` | startSelfAssessment, addItem, submit, requestInfo | `POST /api/public/upload-url` (signed upload, per open self-survey) |
| Demos | `propose_demo`, `decide_demo`, `schedule_demo`, `complete_demo`, `record_demo_feedback`, `convert_demo` | one per step | — |
| Referrals | `create_referral`, `qualify_referral`, `evaluate_rewards`, `redeem_reward` | recordReferral, redeemReward, saveRewardRule | `GET /r/[code]` (landing + cookie) |
| Catalog | `publish_product` (+ revalidate) | product CRUD, importCatalog | — |
| Campaigns | `resolve_audience`, `enqueue_campaign` | createCampaign, previewAudience, launch, pause | cron `/api/cron/campaigns`, `/api/cron/cadences` |
| Reports | `render_report_pdf` (via worker → Gotenberg) | downloadReport | `GET /api/reports/[id]` (signed) |

Every function: SECURITY DEFINER where it crosses RLS, identity from JWT claims
(`is_system_caller()` pattern), pgTAP tests, BR-IDs in comments.

---

## 5. Frontend surface

| Area | New / changed screens |
|---|---|
| Website | B2B IA, `/products/*`, `/process`, `/assessment` (how it works by mode), `/demo-programme`, `/referral-programme`, `/register`, `/r/[code]`, self-assessment wizard (phone-first, camera capture), premium redesign of home/hotels/case studies |
| Customer portal | Account dashboard, history tabs, reports, "Request again", self-assessment status, demos, referrals & rewards, colleagues |
| Staff CRM | Account 360° page (profile, group, branches, contacts, tier + score breakdown, timeline, money, referrals), lead page with tier/assessment decision/demo offer, self-assessment review queue, demo board, referral queue, campaign builder, cadence tasks |
| Admin | Scoring rules + thresholds, assessment policy matrix, service areas, demo types, referral benefits & reward rules, offers, segments, catalog, B2C switch |
| Surveyor app | Show demo jobs; optional catalog lookup in fitting capture; no change to the outbox or photo pipeline |

---

## 6. Integrations

| Integration | Need | Note |
|---|---|---|
| WhatsApp Cloud API | marketing templates for campaigns; auth template for registration OTP | Meta approval per template; marketing-message cost; frequency caps |
| SMS (MSG91) | OTP fallback | DLT templates for registration |
| Gotenberg | report PDFs (assessment, demo, completion, warranty) | already planned (ADR-010); ₹ font check |
| Geocoding | pincode master (free) first; Google Maps Geocoding optional for exact addresses | cost only if enabled |
| Email | report delivery and account invites | provider as per the integrations runbook |
| Storage | `self-assessment` uploads reuse `survey-photos`; catalog images in public `brand` bucket | egress: thumbnails in lists |

---

## 7. Phases

Each phase ships as vertical slices (migration + RLS + function + action + UI + tests) and is
demoable on staging. Durations assume one full-stack developer with AI pairing, and run after the
CR is approved.

| Phase | Scope | Depends on | Est. |
|---|---|---|---|
| **0 · Decisions & paperwork** | Client answers §9; CR deliverables + estimate signed; ADR-015…018; glossary/BR updates; B2C switch | — | 1 wk |
| **1 · Account foundation** | `customer_groups`, `segments`, customer/lead/contact columns, `v_account_timeline`, account-membership RLS (removes the prospect workaround), B2C off | 0 | 1.5 wk |
| **2 · Accounts & portal** | Registration (open + verify), colleagues, history tabs, repeat request, reports (Gotenberg) | 1 | 2 wk |
| **3 · Profiling CRM** | Account 360°, lead page upgrades, assignment of salesperson/account owner, follow-up history | 1 | 1.5 wk |
| **4 · Scoring & assessment engine** | Scoring rules, pincodes/service areas, `score_lead`, policy matrix, `decide_assessment`, self-assessment wizard + review queue | 1, 3 (catalog-guided capture waits for 6) | 2.5 wk |
| **5 · Demos** | Demo types, demo workflow, demo jobs, costs, feedback, conversion | 4 | 1.5 wk |
| **6 · Referrals & rewards** | Codes/links, referral capture, benefits, reward rules, ledger, redemption, portal + reports | 2 | 2 wk |
| **7 · Catalog** | Tables, admin + import, website catalog, links to quotes/fittings/demos/stock | client catalog | 1.5 wk |
| **8 · Process content & premium website** | Process story, B2B IA, redesign of key pages, case studies | client content + design sign-off | 2 wk |
| **9 · Follow-up & campaigns** | Offers, cadences, campaign builder, audiences, consent gate, sending, reactivation | 4, WhatsApp marketing templates approved | 2 wk |
| **10 · Reporting** | New report tabs, materialised views, exports | 4–9 | 1 wk |
| **QA & release** | Golden-path tests extended (registration → self-assessment → demo → referral → repeat), UAT, production deploy | all | 1.5 wk |

**Total ≈ 20 weeks** sequentially. Phases 6, 7 and 8 can run in parallel with 4–5 once content
arrives, which brings it to **≈ 14–16 weeks**.

---

## 8. Data, migration & deployment

- Pre-production, so every change is a forward migration on staging with pgTAP. Existing demo data
  is migrated forward: `kind = business` for hotels and dealers; home customers become `individual`
  and are hidden while B2C is off.
- Backward compatibility: existing flows (on-site survey → quote → job) keep working unchanged. New
  columns are nullable or defaulted; the new survey mode defaults to `onsite`.
- Feature flags in `settings`: `b2c_enabled`, `self_assessment_enabled`, `demos_enabled`,
  `referrals_enabled`, `campaigns_enabled`. Each phase can go live independently.
- Hosting: the demo stays on Vercel; production per ADR-003 (Mumbai VPS) unless the client prefers
  Vercel; decide at Phase 0 (cost/latency note in the ADR).
- Security: new public endpoints (register, upload-url, referral link) get rate limits, honeypots
  and audit entries. Customer-written data (self-assessment) is RLS-scoped to the account.

---

## 9. Decisions (answered 8 Oct 2026)

Every value below is a **seed** for an admin-editable setting or table, never a constant in code.

| # | Topic | Decision |
|---|---|---|
| Q1 | B2C | **Hidden**: homeowner pages, forms and options disappear (`b2c_enabled = false`); the data model keeps `customers.kind = individual` for later |
| Q2 | Registration | **Open + team verify**: anyone may register and immediately enquire or self-assess; full history and reports open once REDUX verifies the account |
| Q3 | Chain view | **No**: each branch sees only its own data. Groups exist for referral roll-ups and internal reports only |
| Q4 | Start | **Start now**: CR treated as approved; contract change order handled in parallel |
| Q5 | Tiers | **A**: 40+ rooms, or ₹5 lakh+ estimated order, or a hotel chain. **B**: 10–39 rooms or ₹1–5 lakh. **C**: below |
| Q6 | On-site area | **Delhi NCR** (Delhi, Gurugram, Noida, Faridabad, Ghaziabad); within 150 km of the Delhi hub = near, beyond = far → self-assessment |
| Q7 | Self-assessment photos | **4 per fitting**: front, side, top, close-up (same slots as the surveyor) |
| Q8 | Self-assessment turnaround | **24 hours** to the assessment report + quotation |
| Q9 | Demo approval | **Every demo approved by the Super Admin**, regardless of cost; internal cost still recorded |
| Q10 | Demo warranty | **Yes, same as paid work** (mechanical + finish) |
| Q11 | Referred business | **5% off the first order**, pre-approved on the quote |
| Q12 | Referrer reward | **Both**: 5% of the referred first order as credit when the referred business **pays**, usable on the next order; **and** one free fitting ("extra fit") for every 3 converted referrals |
| Q13 | Same-chain referral | **Counts** (Radisson A → Radisson B earns the reward) |
| Q14 | Stacking | **No**: referral discount and campaign offer do not add up; the larger single benefit applies |
| Q15 | Campaign channels | **WhatsApp + email** (email provider to be added; no promotional SMS) |
| Q16 | Customer reports | **Assessment report, demo report, completion report, warranty certificate** (+ invoice, existing) |

Still to come from the client (not blocking Phases 1–4): the product catalog (Phase 7), the
process content and photography (Phase 8), case-study permissions, and expected monthly campaign
volume (Phase 9).

## 10. Contract impact

These are new deliverables outside D1–D23. Proposed numbering for the change order:

| New | Deliverable | Phase |
|---|---|---|
| D24 | B2B account model & customer timeline | 1 |
| D25 | Business accounts & extended customer portal (history, reports, repeat) | 2 |
| D26 | Account 360° CRM profiling | 3 |
| D27 | Lead scoring & assessment decision engine, self-assessment | 4 |
| D28 | Demo programme management | 5 |
| D29 | Referral & reward system | 6 |
| D30 | Product catalog | 7 |
| D31 | Process content & premium website redesign | 8 |
| D32 | Follow-up cadences & outreach campaigns | 9 |
| D33 | Lifecycle reporting | 10 |

The D1–D23 timeline and go-live dates need re-baselining once the client confirms priority: build the
CR first, interleave it, or after Phase 3 go-live.
