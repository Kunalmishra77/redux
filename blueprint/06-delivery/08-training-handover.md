# 08 — Training & Handover · D23

**Accepted when:** training is delivered and a written guide exists per role.

Training happens **per phase, before go-live** — not once at the end. People learn what they are
about to use.

---

## Sessions

| Session | Phase | Audience | Duration | Format |
|---|---|---|---|---|
| Super Admin — Phase 1 | W9 | Management | 90 min | Live, screen share, hands-on |
| Care executives | W9 | Care team | 90 min | Live, each on their own login |
| **Surveyors** | W19 | Field team | 2 h | **In the field, on a real property** |
| Admin — quotes & jobs | W19 | Management + ops | 60 min | Live |
| Customer portal walkthrough | W24 | Management | 45 min | Live — so REDUX can support customers |
| Finance & invoicing | W24 | Accounts | 60 min | Live |
| Super Admin — full platform | W25 | Management | 2 h | Live |

---

## What each session covers

### Care executives (the most important session)
They live in this product eight hours a day; 20 minutes of training saves hours a week.
1. My leads queue and what the SLA timer means
2. Calling, logging an outcome, and why the outcome matters (it drives reporting)
3. **Booking a survey without leaving the screen**
4. Follow-ups and what happens when one is missed
5. WhatsApp inbox and the 24-hour window — *why a free-text message sometimes won't send*
6. Marking a lead lost, with a reason
7. Their own stats

### Surveyors (deliver in the field, never in a room)
The app is used standing in a bathroom with wet hands; training in a conference room teaches the
wrong thing.
1. Device onboarding and **battery settings — done together, verified on each phone**
2. Today's visits and check-in
3. **Capturing a fitting: four photos, conditions, recommendation**
4. Why a photo cannot be skipped
5. **The sync screen — the most important screen in the app.** What each state means
6. Needs-attention and how to retry
7. Showing the three-price comparison to a customer
8. **What to do if something looks wrong — and never to reinstall the app**

Point 8 is the one that prevents the single most damaging support mistake available:
reinstalling destroys the outbox and any unsynced photos, permanently.

### Super Admin
Dashboard and what each figure means · reading leads by source and cost per won job ·
**rate card versioning — why editing creates a new version and old quotes never change** ·
users, roles and cities · masters · stock and alerts · discount approvals · reports and exports ·
audit log · DPDP tools and the 48-hour / 72-hour clocks.

### Finance
Invoice numbering and the FY reset · GST fields and who owns what (software vs CA) ·
payment reconciliation, Payment Links vs virtual accounts · credit notes — **never delete an
invoice** · exports for the CA.

---

## User guides

One short, screenshot-led, printable PDF per role. Nobody reads a 40-page manual.

| Guide | Pages | Contents |
|---|---|---|
| Care Executive | 6–8 | The daily loop, plus a troubleshooting page |
| Surveyor | 6–8 | Capture flow, sync states, what to do when something fails |
| Super Admin | 12–15 | Every admin screen, plus the monthly routine |
| Finance | 6–8 | Invoices, payments, exports |
| Customer (public) | 2 | How to log in, see progress, pay, claim warranty |

Plus a **one-page laminated card** for surveyors: the four photo slots, what the sync states mean,
and "never reinstall the app".

---

## Handover checklist (W26)

### Accounts — all in REDUX's own name
- [ ] Meta app + WABA (created under REDUX's Business Manager from day one, so this is
      administrative rather than impossible)
- [ ] Google Ads webhook configuration
- [ ] Razorpay
- [ ] MSG91 + DLT registration
- [ ] Google Play Console
- [ ] Domain and DNS

### Infrastructure
- [ ] Supabase project ownership
- [ ] VPS + Coolify access
- [ ] Cloudflare
- [ ] Sentry
- [ ] Encrypted secrets vault, shared with **at least two** REDUX people

### Code and documentation
- [ ] `redux-platform` and `redux-surveyor-app` transferred
- [ ] Blueprint updated to **as-built**
- [ ] User guides delivered
- [ ] Runbooks: webhooks stopped, photos not syncing, invoice wrong, database restore

### Knowledge
- [ ] Walkthrough of the codebase with whoever will maintain it
- [ ] Walkthrough of the runbooks
- [ ] The open-questions list reviewed — what is still assumed
- [ ] Known limitations and the change-request list

---

## Support after handover

**30 days hypercare included** (to 9 May 2027): P1 within 2 hours, P2 same day, weekly check-in.

After that, an agreed arrangement. Options to discuss with REDUX before handover, not after:

| Option | Covers |
|---|---|
| Break-fix, hourly | Bugs only, best-effort |
| Monthly retainer | Defined response times, monitoring, minor changes, updates |
| Retainer + roadmap | The above plus agreed monthly development |

**Raise this in W20, not W26.** A support conversation started after handover starts from a worse
position for everyone.

---

## The things REDUX must own from day one

Not our decisions to make, and they should know that early:

1. **The rate card.** Prices change; nobody should need us to change one.
2. **Master lists.** New fitting types, brands and finishes will appear.
3. **Users.** People join and leave.
4. **WhatsApp template content.** Meta approval is theirs; we can advise on category.
5. **Ad spend figures.** The dashboard computes cost per won job only if someone enters spend.
6. **The privacy notice and grievance officer.** Legal accountability sits with REDUX.
