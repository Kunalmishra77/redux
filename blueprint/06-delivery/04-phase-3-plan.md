# 04 — Phase 3 Plan · Retain & Control

**W20–W24 · 22 Feb – 26 Mar 2027 · Go-live Thu 25 Mar 2027**
**Deliverables: D13 Customer portal · D14 Super Admin dashboard · D15 Stock · D16 Admin controls ·
D17 Reports · D18 Notifications**

**The goal:** the customer can see and pay for everything themselves, and REDUX can run the
operation — prices, people, stock, reports — without calling a developer.

**Why this phase is short:** by now the data model, auth, notifications and PDF pipeline all
exist. Phase 3 is mostly new views over data that is already there, plus payments.

---

## W20–W21 · Customer portal + payments (22 Feb – 5 Mar) — **D13**

### Design (D20)
DS3 covers the **10 portal screens + 14 admin screens**. Approval by **Fri 5 Mar**.
The portal is mobile-first — a chief engineer checks it on a phone between rounds.

### W20 — portal core
| Task | Detail |
|---|---|
| **OTP login** | WhatsApp primary, SMS fallback; 30-day session; `customer_contacts.user_id` linked on first login |
| Dashboard | Active job card with the 7-stage tracker; warranty summary |
| Job progress | Same stage data REDUX sees, including the room board |
| Restored fittings | Unit by unit, before/after, signed URLs at an explicit thumbnail width |
| Quote approval | The D10 flow, now in the portal |
| **RLS proof** | A customer sees only their own properties — tested, not assumed |

### W21 — payments and after-sales
| Task | Detail |
|---|---|
| Invoices | GST-compliant, all Rule 46 fields **stored on the row**; gap-free numbering per FY |
| **Razorpay** | Payment Link ≤ ₹50,000; **per-invoice virtual account (NEFT/RTGS) above** |
| Webhook | Signature-verified, idempotent on `payment.id`. **Paid only from the webhook, never a redirect** |
| Warranty cards | Mechanical and finish, separate validities, downloadable |
| Service requests | Raised in the portal → care queue, **48-hour acknowledgement SLA** |
| **DPDP tools** | Export my data · correction · withdraw consent · erasure, stating what is retained and why |
| Grievance block | Name, contact, ID in the footer (E-Commerce Rules) |

⚠ **Razorpay KYC must be approved by now.** Started W0; if it is still pending, the portal ships
with invoices and bank details and payment links follow — do not hold the phase.

⚠ **Confirm before building invoices:** REDUX's AATO, which decides whether e-invoicing (IRP) is
mandatory (assumption B6). If it is, add ~2 weeks for GSP integration — this must be settled with
their CA by **W14**, not discovered here.

---

## W22 · Super Admin dashboard + stock (8–12 Mar) — **D14, D15**

### D14 — dashboard
| Row | Content |
|---|---|
| KPIs | Leads this month · free surveys done · **survey-to-order conversion** · quoted value · jobs at factory |
| Charts | Leads by source, with cost per lead and **cost per won job** where ad spend is known |
| Tables | Care executive performance · surveyor performance |
| Alerts | Stock below minimum |

**Every number links through to its records.** A figure you cannot click is a figure nobody trusts
by month three.

**Build the metric REDUX will not ask for: free-survey cost per won job.** REDUX gives away field
time as a sales tool; this is the number that says whether it still pays. If conversion falls
below ~20%, the free survey stops earning.

### D15 — stock
Items with quantity and minimum level · movements (in/out/consumed/adjusted) with actor and
optional job · **never negative** · alert fires **once per crossing** and re-arms above minimum.

---

## W23 · Admin controls + reports (15–19 Mar) — **D16, D17, D18**

### D16 — the acceptance criterion is "no developer needed"
Rate card editor with versioning · users, roles, cities, assignment rules · master lists
(fitting types, brands, finishes, work types, condition flags, lost reasons) · discount approvals ·
notification rules toggleable without a deploy.

**Test it properly:** hand the admin screens to someone from REDUX and have them change a price,
add a finish and deactivate a user — with nobody helping. If they need us, it is not done.

### D17 — reports
Leads · care team · surveys · quotes · jobs · stock. Daily, weekly, monthly and **any custom
range**. CSV export on everything, PDF for summaries. Scheduled weekly email to Super Admin.
Reports read the same records as the dashboard — one source of truth, or the two will disagree
and both will be distrusted.

### D18 — notifications
CN12–CN18 (invoice, payment, login OTP, service ack, **feedback at 30 days**, warranty expiring)
and TN12–TN15 (service request, stock, payment, weekly summary).

**CN17 stays utility.** A feedback request after a completed job is a service follow-up. Add
"10% off your next restoration" and it becomes marketing at 7.5× **and** needs marketing opt-in.
If REDUX wants both, send two messages.

---

## W24 · QA + UAT + go-live (22–26 Mar) — **D21, D22**

| Day | Activity |
|---|---|
| Mon–Tue | Full-platform QA: all three phases together, end to end |
| Wed | REDUX UAT + admin training |
| **Thu 25 Mar** | **Go-live** |
| Fri | Hypercare |

### Full-platform regression (the whole journey, once, for real)
Lead from each of 7 sources → call → survey booked → offline audit → quote → OTP approval →
job → batches → handover → warranty → invoice → payment → service request → feedback at 30 days.

### Go-live checklist
- [ ] D13–D18 acceptance criteria signed
- [ ] **Payment tested with a real ₹1 transaction and a real refund**
- [ ] Virtual account routing verified above ₹50,000
- [ ] Invoice numbering verified gap-free under concurrent issue
- [ ] GST fields verified against a real invoice by REDUX's CA
- [ ] Customer RLS verified: customer A cannot see customer B
- [ ] DPDP tools working: export, correction, withdrawal, erasure
- [ ] Grievance officer details live in the footer
- [ ] Dashboard figures reconcile to the underlying records at three date ranges
- [ ] Admin changes a price and a user **with no developer involved**
- [ ] All Phase 3 templates approved

⚠ **Invoice series timing.** Go-live is 25 March, six days before the new financial year.
Configure the **FY2027-28 series to start on 1 April** at go-live, and verify the reset. Getting
this wrong on 1 April creates a numbering gap that cannot be fixed retrospectively.

---

## W25–W26 · Training & handover (29 Mar – 9 Apr) — **D23**

### W25 — training
| Session | Audience | Content |
|---|---|---|
| Super Admin | REDUX management | Dashboard, rate card, users, stock, reports, DPDP tools |
| Care executives | Care team | Lead queue, calling, booking, WhatsApp inbox |
| Surveyors | Field team | Refresher, sync screen, needs-attention, battery settings |
| Finance | Accounts | Invoices, payments, reconciliation, exports for the CA |

**Written user guide per role** — short, screenshot-led, printable. Nobody reads a 40-page manual.

### W26 — handover
- [ ] Repositories transferred
- [ ] Supabase project ownership transferred
- [ ] VPS and Coolify access transferred
- [ ] **All third-party accounts in REDUX's name** — Meta app, WABA, Razorpay, MSG91, Play Console.
      (They were created under REDUX's Business Manager from day one precisely so this step is
      administrative rather than impossible.)
- [ ] Encrypted secrets vault, shared with two REDUX people minimum
- [ ] Blueprint updated to as-built
- [ ] User guides delivered
- [ ] Support arrangement agreed
- [ ] **Thu 9 Apr — final handover**

---

## Definition of done for Phase 3

1. A customer logs in with OTP, sees their job live, pays an invoice online and reads their warranty.
2. A customer raises a service request and gets acknowledged within 48 hours.
3. Super Admin sees leads by source, team performance, jobs and stock on one screen, and every
   figure reconciles.
4. An admin changes a price, adds a finish and deactivates a user without calling us.
5. Every report runs for any period and exports.
6. A customer can export, correct or withdraw their data from the portal.
