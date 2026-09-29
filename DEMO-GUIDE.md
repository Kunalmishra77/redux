# REDUX Platform — Client Demo Guide (A to Z)

Live link: **https://redux-demo-iota.vercel.app**
Everything runs on demo data. WhatsApp, OTP and payments are **simulated** — every message the
customer would receive appears in the **Demo outbox** (`/demo/outbox`), with its buttons.

---

## 0. Before the demo

| When | Do this |
|---|---|
| Morning of the demo | In the repo: `pnpm demo:refresh` — moves every demo date to today (SLA timers, today's survey visits, follow-ups, quote validity). Safe to run any time; it does nothing if already current. |
| 15 min before | Open the tabs below once each (the first load after a quiet spell takes a few seconds — do it before the client is watching). |
| Phone (for the surveyor app) | Android phone with **Expo Go** installed, on **mobile data** (home Wi-Fi ISPs may block Supabase), or set Private DNS to `dns.google`. On the laptop: `cd mobile && npx expo start`, scan the QR in Expo Go, sign in as Ankit. |
| Pick a fresh phone number | For the live enquiry, use a mobile number that has **never** been used in the demo (each number can hold only one open lead). Keep a list: 98112 04518, 98112 04519, 98112 04520 … |

**Tabs to keep open** (one browser profile per role, or use a private window for the customer):

1. Website — `/`
2. Care Executive (Priya) — `/staff/login` → Priya
3. Super Admin (Vikram) — `/staff/login` → Vikram
4. Customer portal — `/portal/login` (phone-sized window, or open on the phone)
5. Demo outbox — `/demo/outbox`

---

## 1. Logins

| Who | Where | How |
|---|---|---|
| Vikram Sethi — Super Admin | `/staff/login` | One click on his card |
| Priya Nair — Care Executive (Delhi) | `/staff/login` | One click |
| Arjun Malhotra — Care Executive (Gurugram) | `/staff/login` | Email `arjun@redux.demo` + demo password |
| Ankit Verma — Surveyor | `/staff/login` (web) · surveyor app (phone) | One click on web · app: `ankit@redux.demo` + demo password |
| Sunil Rawat — Surveyor | same | `sunil@redux.demo` + demo password |
| Anita Sharma — The Grand Orchid (hotel, job in progress) | `/portal/login` | Mobile **98100 11001** → the 6-digit code shows on screen |
| Rohit Mehra — home owner (job complete, warranty, invoices) | `/portal/login` | Mobile **98100 11002** |
| Any new customer you create live | `/portal/login` | The phone number they enquired with |

The demo password is the `DEMO_PASSWORD` value in `.env.local` (not written here — the repository is public).

---

## 2. The story — one hotel, enquiry to payment (35–45 min)

Tell it as one customer's journey. Each act shows a different person's screen; the data flows
between them live.

### Act 1 — The website (3 min) · *Website tab*
- Home: the promise ("Your existing fittings may have more service life ahead"), before/after, the
  three services, the assessment → pilot → wider-project process.
- `/hotels` (the page a hotel GM lands on) · `/work` (before/after gallery, filter by fitting).
- Floating WhatsApp button and the sticky "Book free assessment" on mobile.

### Act 2 — A new enquiry arrives (5 min) · *Website → Priya*
1. On `/book-assessment` choose **Hotel**, fill a name, the **fresh phone number**, city **Delhi**,
   property name, rooms, a line of message. Tick the consent box (marketing stays unticked — DPDP).
   Submit → thank-you page.
2. Switch to **Priya → My leads**. The enquiry is at the top with a **1-hour call-back SLA timer**
   running, source "Website", consent recorded.
3. **Outbox**: the customer already has the "we received your enquiry" WhatsApp.
4. Back in Priya's lead: **Call now** → outcome **Interested** → **Log call** (status becomes Contacted).
5. **Book free survey**: date today/tomorrow, a slot, address → **Find a free surveyor** (same city
   first, least busy) → pick **Ankit Verma** → **Confirm & send WhatsApp**.
6. **Outbox**: the survey confirmation with date, slot and surveyor.

*Say:* nothing is typed twice; the lead, the property and the survey are one record from here on.

### Act 3 — The surveyor on site (7 min) · *Phone — surveyor app*
1. Pull down to refresh: the new visit appears under Today.
2. **Check in** (GPS accuracy shown; poor accuracy is flagged, never blocked).
3. **Add room** (e.g. 101) → **Add fitting**: type, brand, finish, condition chips.
4. Take the **four photos** (front, side, top, close-up) — Save stays disabled until all four exist.
5. Pick the recommendation — the three prices appear live: **REDUX price · new Eurobrass · market
   replacement**, and "Customer saves ₹…".
6. Add one or two more fittings, then **Submit**. Show the Sync screen: photos upload, and the
   phone keeps its copy until the server confirms each one.
7. *Optional:* airplane mode → add a fitting → it waits in the outbox → airplane mode off → it syncs.

*No phone?* Use a survey that is already submitted: **Ankit (web) → Surveys** → any "Submitted" visit.

### Act 4 — The quotation (5 min) · *Ankit on web (or Vikram)*
1. **Surveys** → the visit just submitted → review fittings, photos, assessments → **Create quotation**.
2. The quote builder: every line comes from the survey, never re-typed; tax split, market total, **You save**.
3. *Discount rule:* type **10%** with a reason → it goes to Vikram for approval (above 5%). Switch to
   **Vikram → Admin → Discount approvals** → Approve. (Or skip: keep 0%.)
4. **Preview** — the A4 quotation exactly as the PDF will look. **Print / save PDF** works.
5. **Issue & send** — validity and terms are frozen, the document is fingerprinted.
6. **Outbox**: the "Your quotation is ready" WhatsApp with a **View & approve quotation** button.

### Act 5 — The customer approves (4 min) · *Customer portal (phone size)*
1. In the outbox, click **View & approve quotation** (or go to `/portal/login`), sign in with the
   customer's phone — the code shows on screen (in production it arrives on WhatsApp).
2. The quotation: REDUX price vs buying new, **You save**, validity, the full document and terms.
3. **Approve — send me a code** → enter the code → **Approved**, with the audit reference.
4. *Say:* this one step records the legal evidence (who, when, which document, which OTP), converts
   the prospect into a customer, marks the lead **Won** and opens the **job** — in one transaction.

### Act 6 — The job (7 min) · *Vikram → Jobs*
1. The new job is there, rooms from the quotation. Move rooms through the stages: **Removal & pickup
   → At Eurobrass → Quality check → Refit & test**. Each step sends the customer a WhatsApp (outbox).
2. **Block a room** (⋯ menu → Mark blocked → *Civil work (property)*): the room board shows who it is
   waiting on, and the delay clock stops. Unblock it.
3. **Room board** — the view to put on a screen in a meeting with the hotel.
4. **Handover** → the three checks (no leaks, operates smoothly, finish as promised) → sign off →
   **warranty cards** are generated from the quotation's terms.
5. For a richer job, open **J-2026-0090 · The Grand Orchid** (seeded): blocked room, delay alert, timeline.

### Act 7 — Money (4 min) · *Vikram → Invoices, then the customer*
1. **Invoices**: the finished job waits under "Finished jobs waiting for an invoice" → **Raise invoice**
   → **Issue invoice** (gap-free GST number, CGST/SGST or IGST by place of supply).
   Above ₹50,000 it routes to a bank transfer account (no 2% card fee); below, a payment link.
2. Customer portal → **Invoices** → **Pay now** → payment received.
3. Vikram → **Payments**: the payment reconciled against its invoice. Outbox: receipt WhatsApp.

### Act 8 — After-care (3 min)
1. Customer portal → **Warranty**: one card per fitting (mechanical / finish), valid dates.
2. **Help → Raise a service request** (pick the room, the warranty).
3. Priya → **Service requests**: acknowledge-by and resolve-by clocks → Acknowledge → Start → Resolve.

### Act 9 — The owner's view (5 min) · *Vikram*
- **Dashboard**: leads this month, survey → order conversion, quoted value, rooms at the factory,
  **free-survey cost per won job**, leads by source with cost per lead and per win, team tables.
- **Reports**: the funnel, sources, quotations, money in.
- **Rate card**: versions — an active version is frozen; changing a price makes a new version, and
  old quotations never re-price.
- **Stock**: low-stock alerts, the movement ledger. **Audit log**: every change, who and when.
  **Privacy (DPDP)**: the consent ledger and data requests. **Integrations**: Meta, WhatsApp, Google Ads,
  Razorpay health.

---

## 3. Ready-made data to show (no live steps needed)

| Show | Where |
|---|---|
| Job with a blocked room, delay alert and timeline | Vikram → Jobs → **J-2026-0090 The Grand Orchid** |
| Completed job, warranty cards, paid invoice | Portal as **Rohit (98100 11002)** · Vikram → Jobs → J-2026-0091 |
| A full journey already done: website → paid | Lead **Kavita Bhatia · Hotel Crystal Palms** (won, job, invoice paid) |
| Quotes waiting for customer approval | Quotes → **Q-2026-0144 (Meera Iyer)**, **Q-2026-0146 (Nisha Kapoor)** |
| Discount waiting for approval | Vikram → Admin → Discount approvals |
| WhatsApp inbox with a live 24-hour window | Priya → Inbox |
| Part-paid invoice | Vikram → Invoices → RDX/2627/00002 |
| Low stock | Vikram → Stock |
| Open service request | Priya → Service requests |

---

## 4. Good to know

- **One-way steps:** approving a quotation, issuing an invoice and recording a payment cannot be
  undone (that is the product's rule). Use your freshly created customer for these, and keep
  Q-2026-0144 / Q-2026-0146 for another demo.
- **Quote-approval codes:** at most 3 per phone per hour.
- **"That surveyor already has a survey in this slot"** — pick another slot; double-booking is blocked on purpose.
- **Surveyor app needs** the visit booked for **Ankit** (or sign in as Sunil for his visits).
- **After many demos**, the data can be reset completely: `scripts/demo/README.md`.
