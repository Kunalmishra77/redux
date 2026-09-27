# 00 — Research Summary

All research in this folder was verified against live sources on **26 September 2026**.
Where a source could not be confirmed it is marked **UNVERIFIED** and must be re-checked
before it is relied on commercially.

## The seven findings that changed the design

### 1. Meta App Review is the critical path, not the code
Getting `leads_retrieval` + `ads_management` to Advanced Access needs Business Verification,
a screencast of the working end-to-end flow, and typically at least one rejection round.
**Weeks, not days.** It must be submitted in Week 0, before the CRM that uses it is finished.
→ `02-meta-whatsapp-integration.md` §1, and risk R1 in `../06-delivery/09-risk-register.md`.

### 2. Meta deletes lead data after 90 days
Leads are unretrievable by any method after 90 days. A silent webhook outage is therefore
**permanent data loss**. We build a 15-minute reconciliation poll as a safety net, and our
database — not Meta — is the system of record.
→ `02-meta-whatsapp-integration.md` §1.

### 3. WhatsApp pricing changes on 1 October 2026 — five days from this blueprint
Service messages become billable, and utility templates become billable even inside the
24-hour customer service window. India moved to INR billing on 1 Jan 2026 and all WABAs must
migrate to INR by 31 Dec 2026. Our notification design leans on **utility** templates (₹0.115)
and avoids marketing (₹0.8631) — a 7.5× difference — which means notification copy must never
carry an offer.
→ `02-meta-whatsapp-integration.md` §2 and `../05-content/02-whatsapp-templates.md`.

### 4. UPI stops being free for large invoices on 15 October 2026
NPCI introduces 0.4% MDR on P2M UPI above ₹2,000, capped at ₹300. Combined with ~2% card MDR,
a ₹3,00,000 hotel invoice could cost ₹6,000 to collect. **Decision: per-invoice NEFT/RTGS virtual
accounts (Razorpay Smart Collect) for invoices above ₹50,000**, Payment Links for the rest.
This single choice is worth more than any code optimisation in the project.
→ `03-google-ads-payments.md` §2.

### 5. Buying an offline sync engine would be wrong here
PowerSync is good, but our data is perfectly partitioned (one surveyor owns their visit),
only one role is offline, and writes are append-mostly. A hand-rolled SQLite outbox is ~2–3 days
versus ~1–2 weeks of sync-rules work plus $49+/month forever — and PowerSync's free tier
**deactivates after one week idle**, which is fatal for a client handover.
→ `04-offline-surveyor-app.md` §1 and ADR-006.

### 6. DPDP's real deadline is 13 May 2027, but consent must be captured from day one
The DPDP Rules were notified in Nov 2025 with core obligations commencing 13 May 2027 — after
our go-live. Retrofitting consent onto leads already collected is the hardest part, so the
consent ledger ships in Phase 1 even though enforcement is later.
→ `05-india-compliance.md` §1.

### 7. OTP approval is a valid e-contract, but the audit trail is what defends it
IT Act s.10A makes an OTP-accepted quotation binding, but OTP is not a Second Schedule
"electronic signature", so it does not get s.85B's presumption of authenticity. We must be able
to prove it: SHA-256 of the exact approved PDF, OTP lifecycle timestamps, gateway message ID,
IP, and a s.65B/s.63 certificate generator.
→ `05-india-compliance.md` §4.

---

## Research index

| File | Covers |
|---|---|
| `01-stack-decisions-adr.md` | 12 architecture decision records — what we chose, what we rejected, and what would change our mind |
| `02-meta-whatsapp-integration.md` | Meta Lead Ads webhook, WhatsApp Cloud API, pricing, templates, CTWA attribution, CAPI |
| `03-google-ads-payments.md` | Google Ads lead form webhook, Razorpay vs Cashfree vs PhonePe, virtual accounts |
| `04-offline-surveyor-app.md` | Expo vs Flutter vs PWA, offline sync options, photo pipeline, Android field gotchas |
| `05-india-compliance.md` | DPDP, call recording, TRAI DLT, GST invoicing, consumer protection, OTP evidence |
| `06-cost-model.md` | Monthly run cost, per-lead economics, what scales and what doesn't |

## How to use this folder during the build

Research is **decided**, not advisory. If an implementation choice contradicts an ADR, the ADR
wins unless it is formally superseded — add a new ADR, don't quietly diverge. Every ADR has a
"What would change this decision" line; if that trigger fires during the build, stop and raise it.
