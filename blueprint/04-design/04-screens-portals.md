# 04 — Portal Screen Specs · CRM, Admin, Customer

Screen IDs match `../02-product/03-screen-inventory.md`.

---

## Shell

```
┌────────────────────────────────────────────────────────────┐
│ REDUX   [search]                        [alerts] [avatar]  │
├──────────┬─────────────────────────────────────────────────┤
│ Sidebar  │  Page                                           │
│ (collapsible)                                              │
└──────────┴─────────────────────────────────────────────────┘
```

**Sidebar is role-filtered** — a care executive never sees an admin item greyed out; they do not
see it at all. A visible-but-disabled menu tells people what exists and invites requests for it.

| Role | Sidebar |
|---|---|
| `cc_exec` | My leads · Follow-ups · Inbox · Surveys · My stats |
| `surveyor` | (web) My surveys · My quotes |
| `super_admin` | Dashboard · Leads · Pipeline · Surveys · Quotes · Jobs · Invoices · Stock · Reports · Admin |

---

## B6 — My leads (the most-used screen in the product)

```
My leads   32 open                          [All][Meta][WhatsApp][Google][Website]
┌───────────────────────────────┬─────────────────────────────────────────┐
│ ● Hotel Lakeview Residency    │  The Grand Orchid                       │
│   Hotel · 42 rooms · Jaipur   │  Hotel · 80 rooms · Delhi               │
│   Meta            [New]  0:12 │  [Google Ads]                           │
│                               │                                         │
│   Rohit Mehra                 │  ┌───────────────────────────────────┐  │
│   Home · 2 baths · Gurugram   │  │        📞  Call now               │  │
│   WhatsApp   [Follow-up]      │  └───────────────────────────────────┘  │
│                               │  Call outcome    [Interested ▾]         │
│ ▸ The Grand Orchid   SELECTED │  ─── Book free survey ───               │
│   Hotel · 80 rooms · Delhi    │  Date     [24 Sep 2026]                 │
│   Google   [Survey booked]    │  Slot     [11:00 – 13:00]               │
│                               │  Surveyor [Ankit · South Delhi]         │
│   Sharma Sanitation Store     │  ┌───────────────────────────────────┐  │
│   Dealer · Noida [Contacted]  │  │   Confirm & send WhatsApp         │  │
└───────────────────────────────┴──┴───────────────────────────────────┘──┘
```

**Design rules**
- Sorted by **SLA timer**, most overdue first. The timer is visible on every row.
- Source shown as a coloured dot + label — the executive reads channel at a glance.
- **Everything in the right pane happens without navigating.** Call → outcome → book → confirm.
- Keyboard: `j`/`k` move, `c` call, `b` book, `/` search. Executives live here; give them keys.
- Optimistic UI on status change, with a rollback toast on failure.

---

## B7 — Lead detail

Left: identity, source (with campaign and ad, read-only — attribution is immutable), consent
status, assignment.
Centre: **activity timeline** — calls, messages, status changes, notes, each with actor and time.
Right: actions — call, WhatsApp, book survey, follow-up, mark lost (reason required).

Once Phase 2 ships, the timeline gains the survey, the quote and the job as linked entries.
A lead's whole life on one screen.

---

## B8 — Pipeline board

Columns: New · Contacted · Survey booked · Surveyed · Quoted · Won, with Lost accessible
separately. Won column tinted lime. Count chip per column. Drag to move; dropping into Lost opens
the reason dialog. Below the board, the post-Won job states are shown as a legend:
**Won → In restoration → Completed → Warranty active.**

Cards are deliberately minimal — name, one line of context, source. A board that tries to show
everything becomes unreadable at 80 leads.

---

## B11 — WhatsApp inbox

Conversation list (unread first) · message thread · composer.
The composer shows the **24-hour service window countdown**. Inside the window, free text is
allowed. Outside it, only approved templates — and the UI says why, because "my message won't
send" is otherwise a support ticket every week.

---

## B17 — Survey detail (web)

Header: property, surveyor, check-in time and **GPS accuracy** (flagged if >50 m or outside the
geofence). Unit-by-unit accordion; each fitting shows its 4 photos, condition flags, and the
three prices. A map pin of the check-in. **"Create quotation"** as the primary action.

---

## B19 — Quotation builder

Lines pulled from the assessment — never re-typed. Per line: fitting, work, finish, quantity,
rate-card price, market price. Footer: subtotal, discount (with an approval warning above
threshold), tax split, total, market total, **You save**.

`Preview` opens B20, which is the exact HTML Gotenberg renders. `Issue & send` freezes the terms,
sets `valid_until`, renders the PDF, stores its SHA-256, and sends the WhatsApp.

---

## B24 — Room status board

```
Room 201  Back in service   Room 202  Back in service   Room 203  Back in service
Room 204  Refit & test      Room 205  Refit & test      Room 206  At factory
Room 207  ⚠ Blocked — civil work (hotel)                Room 208  Scheduled
```

Colour by status (§ design system). A blocked unit shows **who it is blocked on** — this is the
screen that settles "you're late" conversations with a hotel, so the attribution must be explicit.
The same board is what the customer sees in their portal.

---

## B26 — Super Admin dashboard

Row 1 — KPIs: Leads this month · Free surveys done · **Survey-to-order conversion** · Quoted value ·
Jobs at factory.
Row 2 — Leads by source (horizontal bar, drills through) + Care executive table.
Row 3 — Surveyor table + Stock alerts.

**Every number is a link.** A dashboard figure you cannot click through to its records is a number
nobody trusts by month three.

Add the metric REDUX will not think to ask for: **free-survey cost per won job.** REDUX is giving
away field time as a sales tool; this is the number that says whether it still pays.

---

## B27 — Rate card editor

Version selector with an **Active** badge. Editable grid: fitting type × work type × finish →
price, plus market replacement prices. Import/export CSV.

**Saving creates a new version. It never edits the active one** — existing quotes must keep their
pricing forever. The UI must make that obvious, or an admin will "fix a typo" and expect old
quotes to change.

---

## Customer portal (D1s–D10s)

Same tokens, softer density, fully responsive — customers are usually on a phone.

### D2s — Dashboard
Active job card (batch, stage tracker "Step 5 of 7 · Refit & test") · warranty summary ·
restored fittings with before/after · invoices with **Pay now** · **Raise a service request**.

### D5s — Quote approval (the highest-stakes screen in the product)
The quote, then the three options side by side, then "You save ₹X", then validity, then the terms
in full. **Approve** requests the OTP; a 6-digit input with a resend timer; on success, a
confirmation with the signed PDF and the audit reference.

Before the OTP box: one line stating that approving is acceptance of the quotation and the terms
shown. That sentence is part of the evidence set — it is what `terms_text` records.

### D7s — Warranty
One card per warranty: type (mechanical / finish), unit, fitting, valid from–until, card number,
terms. Expiring within 30 days shows a warning tint.

### D10s — My data (DPDP)
Download my data · request a correction · withdraw marketing consent · request erasure.
Erasure states plainly what must be retained and why (GST records for 6+ years), rather than
silently ignoring the parts it cannot honour.
