# 02 — User Journeys

Five journeys. Each is the sequence the product must make easy; screens that serve them are in
`03-screen-inventory.md`.

---

## J1 — Hotel enquiry to warrantied handover (the main journey)

The full A-to-Z. This is what the demo deck walks through.

| # | Step | Actor | System does |
|---|---|---|---|
| 1 | Chief Engineer searches "chrome tap refinishing Delhi", clicks a Google ad, fills the lead form | Customer | Google Ads webhook → lead created, source `google_ads`, campaign captured |
| 2 | — | System | Duplicate check by phone; auto-assign by city; instant WhatsApp: *enquiry received*; SLA timer starts |
| 3 | Care executive calls within SLA | `cc_exec` | Call logged; outcome recorded |
| 4 | Executive explains the **free assessment** and books it | `cc_exec` | Survey created; nearest available surveyor assigned; WhatsApp: *survey booked* with date, slot, surveyor name. **CAPI `survey_booked` fired to Meta** |
| 5 | Surveyor sees the visit in tomorrow's list | `surveyor` | App pre-loads property and unit data while on WiFi |
| 6 | Surveyor arrives, checks in | `surveyor` | GPS + timestamp; accuracy stored; geofence checked server-side |
| 7 | Room by room: each fitting recorded — type, brand, model, finish, 4 photos, condition flags | `surveyor` | Everything written to the local outbox. **Works with no signal** |
| 8 | Surveyor sets a recommendation per fitting | `surveyor` | Restore / repair / replace, priced from the active rate card version |
| 9 | Surveyor builds the quote on site and shows the three options side by side | `surveyor` | Totals incl. GST, market price, "You save" |
| 10 | Surveyor leaves; app syncs on the drive back | System | Foreground drain with progress; **Submit blocked until every photo is synced** |
| 11 | Quote shared on WhatsApp as a branded PDF | System | Utility template + document; 15-day validity |
| 12 | Chief Engineer reviews, approves by OTP | Customer | Full audit trail stored: PDF hash, OTP lifecycle, IP, terms text |
| 13 | — | System | **Customer account + job created automatically.** CAPI `job_won` fired. Signed PDF + audit trail emailed |
| 14 | Hotel shares available dates; rooms planned in batches | `super_admin` | Batches created; downtime windows set per unit |
| 15 | Removal & pickup → at Eurobrass → quality check → refit & test | REDUX ops | Each stage logged; customer sees it live in the portal |
| 16 | Civil work needed on Room 207 | — | Unit marked `blocked_reason = civil_work`; **delay clock stops** |
| 17 | Handover: after-photos, leak/operation/finish check, sign-off | `surveyor` | Warranty cards generated — mechanical and finish, separate validities |
| 18 | Invoice raised; hotel pays by NEFT | System | Invoice > ₹50,000 → **virtual account**; payment webhook marks it paid and auto-reconciles |
| 19 | 30 days later | System | Feedback and review request |

**Pilot variant.** Steps 12–19 may run first for a single **pilot bathroom** at agreed cost and
timing. The hotel reviews function, finish, downtime and cost, then approves the wider project,
which is created as a child job linked to the pilot. This is REDUX's actual sales process from the
deck — it must be a first-class flow, not a workaround.

---

## J2 — Homeowner, single bathroom

Same spine, compressed. Differences that matter:

- Source is usually **Meta lead ad** or **Click-to-WhatsApp**, not Google search.
- The `referral` object and `ctwa_clid` are captured so the ad can be optimised on outcomes.
- One unit, 2–5 fittings. The survey is ~30 minutes.
- Quote is typically ₹15,000–₹60,000 → **Payment Link**, not a virtual account.
- No batching, no civil-work dependency.
- Price sensitivity is higher — **"You save" vs market replacement is the deciding number.**

---

## J3 — Care executive's working day

The screen they live in for eight hours. Every extra click costs REDUX real money.

1. Open **My leads** — sorted by SLA timer, reddest first.
2. Top lead: click-to-call. Announcement plays if recording is on.
3. Log the outcome from the dropdown while still on the call.
4. If interested → **Book free survey** inline: date, slot, nearest surveyor. Confirm.
5. WhatsApp confirmation fires automatically. Lead moves to Survey booked.
6. If "call back later" → set a follow-up; it reappears in the queue at that time.
7. If not interested → Lost + reason (required).
8. Between calls: answer WhatsApp messages from the inbox using approved templates.
9. End of day: their own stats — calls made, surveys booked, conversion.

**Design consequence:** steps 2–5 must be completable **without leaving the lead detail screen.**
This is the single most important UX constraint in the CRM.

---

## J4 — Surveyor on site, no signal

The constraint that shapes the whole mobile app.

1. Morning, on WiFi: app syncs today's visits and master lists.
2. Drives to the hotel. **No signal in the service corridor.**
3. Checks in — GPS captured and queued locally. Works offline.
4. Opens Room 204. Adds "Basin mixer".
5. Camera: front, side, top, close-up. Each compressed at capture and written to the local outbox
   **in the same transaction as the fitting row** — before the preview closes.
6. Ticks conditions: *leak*, *scaling*. Sets recommendation: *restore finish + cartridge repair*.
7. Repeats for 40 more fittings. ~160 photos, ~55 MB on device.
8. Builds the quote on site; shows the customer three options and "You save".
9. Leaves. On mobile data, the foreground drain starts with a visible counter.
10. Signal drops in the lift. Uploads retry with backoff; nothing is lost.
11. Back at the office on WiFi: last photos go up. **Submit Visit** unlocks.
12. If anything failed permanently → a "needs attention" screen lists exactly which fitting and slot.

**The promise:** a surveyor should never have to think about sync, and should never be able to lose
a photo by doing something reasonable.

---

## J5 — Customer checks their portal

1. Goes to my.reduxbath.com, enters their mobile number.
2. OTP arrives on WhatsApp (SMS fallback if no WhatsApp).
3. Lands on **Active job**: "Batch 2 · Rooms 204–207 · Step 5 of 7 · Refit & test".
4. Scrolls: restored fittings with before/after, room by room.
5. Opens **Invoices**: one paid, one due. Taps **Pay now** → Payment Link or virtual account details.
6. Checks **Warranty**: mechanical valid till X, restored finish valid till Y.
7. Room 206 tap is dripping two months later → **Raise a service request**.
8. Request lands in the care executive queue with a 48-hour acknowledgement SLA.
9. Under **My data**: download everything held about them, request correction, withdraw marketing
   consent (DPDP).

---

## Journey-level failure cases the build must handle

| Failure | Where | Required behaviour |
|---|---|---|
| Meta webhook silent for 8 hours | J1 step 1 | Reconciliation poll recovers the leads; integration health screen alerts admin |
| Two executives open the same lead | J3 | Optimistic lock — second save warns and shows the change |
| Surveyor's phone dies mid-visit | J4 | Everything committed to SQLite survives; resume on relaunch |
| Surveyor leaves the company with unsynced data | J4 | Offboarding checklist blocks access revocation until the device reports empty |
| Customer approves a quote that has expired | J1 step 12 | Blocked; re-quote required; nothing silently re-priced |
| Payment webhook arrives twice | J5 step 5 | Idempotent on `payment.id`; invoice paid once |
| Hotel's civil work delays a room by 3 weeks | J1 step 16 | `blocked_reason` stops the delay clock; REDUX's SLA metrics stay honest |
| Customer withdraws consent mid-job | J5 step 9 | Marketing stops immediately; service messages continue (legitimate purpose); erasure queued for after job closure and statutory retention |
