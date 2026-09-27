# 03 — Website Screen Specs · D1

Screen IDs match `../02-product/03-screen-inventory.md` §A. Copy is in
`../05-content/01-website-copy.md`.

---

## A1 — Home

The section order **is** REDUX's own pitch argument. Do not reorder it — it moves from the reader's
problem to REDUX's proof to the ask, which is why the deck works.

| # | Section | Content | Notes |
|---|---|---|---|
| 1 | Hero | Headline, sub, **Book free assessment** (lime) + **Dealer enquiry** (ghost) | Full-bleed blue with the "R" watermark. Fitting photograph or illustration right |
| 2 | Problem strip | Three cards: recurring faults · unavailable parts · worn finishes | Icon in circle, numbered 01–03 |
| 3 | Services | Three cards: restore function · restore the finish · improve efficiency | Each links to its own page |
| 4 | Why REDUX | Parts made to fit · function & finish · a planned alternative | Blue panel, lime icons. **"50 years of Eurobrass manufacturing" goes here** — it is the credibility line |
| 5 | Before / after | 3–6 pairs, filterable by fitting type | Side by side, labelled. Never a slider |
| 6 | Hotel engagements | Logo or name strip | **Only names REDUX has cleared** (input A7) |
| 7 | Process | Property assessment → selected pilot → wider project | Numbered, horizontal on desktop |
| 8 | Downtime | Schedule around availability → define the downtime → check before reopening | Reassurance, not sales — this is the objection a chief engineer actually has |
| 9 | Enquiry | Tabbed form: **Home · Hotel · Dealer** | Tab choice sets the lead source |
| 10 | Footer | Address, contact, grievance officer, policy links | Grievance block is a legal requirement |

**Global:** sticky "Book free assessment" on mobile; floating WhatsApp button whose pre-filled
message names the page it came from (so the CRM knows which page converted).

---

## A5 — For Hotels (the main B2B page)

The buyer is a Chief Engineer or Maintenance Head. They care about downtime, warranty and whether
this is a real process or a man with a van.

1. Hero — "Restore your bathroom fittings without taking the floor offline for a month"
2. The three problems, framed in hotel terms (guest complaints, brand standard audits, capex)
3. How a hotel engagement runs — assessment → pilot bathroom → wider project
4. **Downtime and work planning** — batches, approved dates, checks before reopening
5. What Eurobrass manufacturing means — re-machined parts for discontinued models
6. Hotel engagements + before/after
7. Warranty: mechanical and finish, separate periods
8. Hotel enquiry form: property name, city, room count, role, preferred contact time

---

## A13 — Book free assessment (form)

Also opens as a modal from every CTA, so it must work in both contexts.

| Field | Type | Required |
|---|---|---|
| I am a | Home / Hotel / Dealer | ✓ (sets source) |
| Name | text | ✓ |
| Phone | tel, E.164 normalised | ✓ |
| City | select | ✓ |
| Property name | text | Hotel only |
| Rooms / bathrooms | number | Hotel only |
| Your role | select | Hotel only |
| Message | textarea | — |
| **Consent — service contact** | checkbox | ✓ |
| **Consent — marketing** | checkbox, **unticked by default** | — |

**Rules.** Honeypot + Cloudflare rate limit; no CAPTCHA unless abuse appears — a CAPTCHA on a B2B
lead form costs more conversions than the spam it blocks. Inline validation on blur. Both
consents write `consent_records` against the active notice version. On success → A18 with
"We'll call you within 2 hours" and a WhatsApp button.

---

## A9 / A10 — Gallery and case study

**Only photos with `marketing_use_consented = true` may appear here** (BR-P3). Site photographs
are collected as quotation evidence, and DPDP purpose limitation means they cannot be reused for
marketing without separate consent. Enforced in the query, not in a policy document.

Case study structure: property type and scale → the problem → what was restored → downtime →
before/after → an outcome line. **No client quote without written permission.**

---

## A15–A17 — Terms, Privacy, Refunds

Not boilerplate: **Razorpay KYC will not approve without these live**, and the E-Commerce Rules
require them. They ship in Phase 1.

Privacy page must carry the DPDP notice: what data, what purpose, how to withdraw, how to
complain, grievance officer contact, and a download link for the notice in Eighth Schedule
languages on request.

---

## Performance & SEO

| Target | Value |
|---|---|
| LCP | <2.0 s on 4G |
| CLS | <0.1 |
| INP | <200 ms |
| Lighthouse | ≥90 across the board |

Static-rendered with `cacheComponents: true` — the marketing site is the **only** part of the
platform where caching is on. Images via `next/image` (WebP/AVIF), hero preloaded with `priority`.
Schema.org `LocalBusiness` + `Service`. Full SEO plan: `../05-content/04-seo-plan.md`.
