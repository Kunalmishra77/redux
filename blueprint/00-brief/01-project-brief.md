# 01 — Project Brief

## 1. The client

**REDUX — Bath Restorations by Eurobrass.** A bath-fittings *restoration* brand backed by
Eurobrass, a manufacturer with ~50 years of experience, based at D 8/7, Okhla Phase 1,
New Delhi 110020. Website: reduxbath.com.

REDUX's proposition, in its own words from the technical pitch deck:

> *"Your existing fittings may have more service life ahead. Assess restoration before
> specifying replacement."*

Instead of replacing bathroom hardware, REDUX repairs the mechanism and restores the finish,
so a property keeps its premium fittings. Because Eurobrass manufactures, REDUX can
**re-machine parts that are no longer available** — which is the whole moat.

## 2. Who REDUX sells to

| Segment | Who | Typical job | Why they buy |
|---|---|---|---|
| **Hotels** (primary) | Chief Engineer / Maintenance Head / GM | 10–200 bathrooms, batched by floor or wing | Recurring faults, discontinued parts, finishes below brand standard, capex avoidance |
| **Homeowners** (secondary) | Individual | 1–3 bathrooms | A leaking or scaled premium tap they don't want to replace |
| **Dealers / architects** | Trade | Refers or resells | Wants a restoration option to offer clients |

The pitch deck names hotel engagements including Vivanta, Hyatt, The LaLiT, Ananda,
Jaypee Greens and The Umrao — so the platform must look credible to a branded-hotel
engineering team, not like a local service app.

## 3. The three problems REDUX names (from the deck)

1. **Recurring faults** — leaks, stiff controls and inconsistent flow cause repeat visits.
2. **Unavailable parts** — discontinued models force a choice between expensive spares and
   substitutes of uncertain fit.
3. **Worn finishes** — scaling and wear leave repaired fittings below the property's
   appearance standard.

## 4. The three services REDUX sells

1. **Restore function** — leaks, worn internal parts, operation.
2. **Restore the finish** — recoat in chrome or coloured PVD.
3. **Improve efficiency** — add compatible water-saving components.

*(The deck footnotes that available repairs and finishes depend on each fitting's condition.
The platform must carry that caveat everywhere a recommendation is shown.)*

## 5. How REDUX sells (the process the platform must encode)

From the deck, REDUX already has a defined commercial process. **The software does not invent
a process — it digitises this one:**

1. **Property assessment** — REDUX audits the fittings and identifies a suitable restoration scope.
2. **Selected pilot** — REDUX may propose a trial bathroom with agreed work, cost and timing.
3. **Wider project** — the hotel reviews the pilot's function, finish, downtime and cost before
   approving more bathrooms.

And the downtime protocol:

1. **Schedule around availability** — the hotel provides available work dates; REDUX schedules
   restoration in batches.
2. **Define the downtime** — confirm removal, factory restoration, refitting, transport and testing.
3. **Check before reopening** — check for leaks, test operation, inspect finish before the room
   returns to service.

The deck also mentions a **"Redux Hub app"** used to record room, fitting type and condition with
photographs. **That app is D7 in this scope.** We are building the real thing the deck promises.

Note also: the hotel's **onboarded maintenance panel** handles civil work (walls, tiles), agreed
with REDUX before work begins. The platform must be able to record that a unit is blocked on
third-party civil work — it is a real cause of delay and must not look like a REDUX delay.

## 6. The business problem the platform solves

| Today | After |
|---|---|
| Leads arrive on Meta, WhatsApp, Google Ads, the website and the phone, into different inboxes | One CRM inbox, source-tagged, de-duplicated, auto-assigned |
| Survey photos and notes sit on surveyors' personal phones and paper | Structured audit per fitting, 4 mandatory photos, synced to one record |
| Quotes are made manually and inconsistently | Quote generated from the audit against an admin-controlled rate card |
| Nobody can see conversion, team performance or stock in real time | One Super Admin dashboard over the same records |
| Customers call to ask "what's the status?" and "what did we pay for?" | Customer portal with live job status, invoices and warranty |

## 7. What "done" looks like commercially

The platform is successful when REDUX can answer, from one screen and without asking anyone:

- How many leads came in this month, from which channel, and what did each channel cost per won job?
- How many free surveys converted to orders?
- Where is every fitting right now — on site, at the Eurobrass factory, refitted?
- Which rooms are back in service and which are blocked, and on whom?
- What is our stock of cartridges, spares and finishes, and what needs reordering?

## 8. Scope boundary — what this platform is NOT

- **Not an ERP.** No purchase orders, vendor management, payroll or general ledger. It computes
  and issues GST invoices; the accountant files returns.
- **Not a factory MES.** Job tracking records *stages* at Eurobrass, not machine-level production.
- **Not an e-commerce store.** Nothing is sold self-service; every job passes through a survey.
- **Not a civil-works manager.** It records that civil work blocks a unit; it does not schedule
  the hotel's contractors.

## 9. Related documents

- Deliverables in contract form: `02-deliverables-D1-D23.md`
- Terms used throughout: `03-domain-glossary.md`
- What we still need from REDUX: `04-assumptions-open-questions.md`
- The product spec that turns this brief into features: `../02-product/PRD.md`
