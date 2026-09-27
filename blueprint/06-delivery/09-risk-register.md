# 09 — Risk Register

Scored **Impact × Likelihood**, both 1–5. Anything ≥12 is actively managed, not just listed.
Reviewed weekly at the status call.

---

## Active risks

| ID | Risk | I | L | Score | Mitigation | Owner |
|---|---|:-:|:-:|:-:|---|---|
| **R1** | **Meta App Review rejected or delayed past W6** | 4 | 4 | **16** | Submit W0 with a full screencast; ship the other 6 sources behind a flag and enable Meta on approval; budget 2 rejection rounds | Lead |
| **R2** | **Surveyor photo loss in the field** | 5 | 3 | **15** | Commit the attachment row in the same SQLite transaction as the fitting; delete local only after confirmed remote existence; startup orphan reconciler; submit blocked while unsynced; `TN11` alert; test on 3 OEM phones | Mobile |
| **R3** | **OEM battery manager kills background sync** | 4 | 4 | **16** | In-app foreground drain is the *primary* path, background is opportunistic only; C2 onboarding with OEM deep-links; verify on each device at training | Mobile |
| **R4** | **Rate card not supplied by W10** | 5 | 3 | **15** | Chase from W6, not W9; build against a seeded card; **Phase 2 quotations cannot be tested without real prices** | Lead + REDUX |
| **R5** | WhatsApp template rejected or silently reclassified to marketing | 3 | 4 | 12 | No promotional language in any transactional template; submit W4 not W6; monitor category and cost per template in `messages` | Lead |
| **R6** | DLT registration delayed (biometric auth) | 3 | 3 | 9 | Start W0; WhatsApp OTP works without DLT, so SMS fallback simply lands later | REDUX |
| **R7** | Razorpay KYC delayed | 3 | 3 | 9 | Start W0; policy pages live in Phase 1; only affects Phase 3 | REDUX |
| **R8** | **REDUX is above ₹5 Cr AATO → e-invoicing mandatory** | 4 | 2 | 8 | **Confirm with their CA by W14.** If yes, +2 weeks for GSP integration — a change request, not absorbed | Lead + CA |
| **R9** | Scope creep from "small" additions | 3 | 4 | 12 | Every story carries a D-number; no D-number → change request with a price and a date | Lead |
| **R10** | UPI MDR change (15 Oct 2026) raises collection cost | 3 | 3 | 9 | Virtual-account routing above ₹50,000 built from the start; confirm the "small merchant" zero-MDR definition with the RM | Lead |
| **R11** | Surveyor leaves with unsynced data on their device | 4 | 2 | 8 | Offboarding blocks access revocation until the device reports empty; `TN11` alerts at 24 h | Lead |
| **R12** | Meta webhook silent gap >90 days → permanent lead loss | 5 | 1 | 5 | 15-minute reconciliation poll; 6-hour silence alert; integration health screen | Lead |
| **R13** | Key person unavailable (illness, exit) | 4 | 2 | 8 | This blueprint is the redundancy; no undocumented decisions; secrets shared with two people | Lead |
| **R14** | Phase 2 field trial finds a fundamental offline flaw | 4 | 2 | 8 | W13 is a dedicated hardening week; trial in W18 leaves a week to react; PowerSync documented as the escape hatch (ADR-006) | Mobile |
| **R15** | Photo storage / egress cost overruns | 3 | 2 | 6 | Compress at capture; thumbnails in list views; photos never proxied; monitor monthly | Lead |
| **R16** | REDUX staff don't adopt the CRM and keep using WhatsApp personally | 4 | 3 | 12 | Training per phase; the CRM's WhatsApp inbox must be *better* than their phone; Super Admin can see who is and isn't using it | Lead + REDUX |
| **R17** | Holiday weeks (Diwali W5, year-end W11–W12) reduce output more than planned | 3 | 3 | 9 | Already in the plan; no critical-path work scheduled in W5 or W11–W12 | Lead |
| **R18** | GST/HSN misclassification creates an ITC problem for REDUX | 4 | 2 | 8 | CA confirms SAC and HSN before W14; rates stored per line so a correction is configuration, not code | REDUX + CA |

---

## The four that need active management

### R1 — Meta App Review (16)
The single most likely cause of a Phase 1 slip, and it is entirely outside our control.
**Signals:** no reviewer response after 10 working days, or a second rejection.
**Response:** ship Phase 1 without Meta lead ads. The other six sources carry the phase, and Meta
switches on the day approval lands. **Do not hold a go-live for an approval queue.**

### R3 — OEM battery managers (16)
Xiaomi, Oppo, Vivo and Samsung kill background work regardless of correct WorkManager use.
The mitigation is architectural, not a setting: **the foreground drain is the primary path, and
the background task is only opportunistic catch-up.** Anything that depends on background
execution to be correct is designed wrong for India.

### R2 — Photo loss (15)
The only truly unrecoverable data in the system — nobody re-visits a hotel to re-photograph 200
fittings. Five independent controls (transactional commit, confirmed-delete, orphan reconciler,
submit block, 24-hour alert) because one is not enough for a failure that cannot be undone.

### R4 — Rate card (15)
A pure dependency risk with no technical mitigation. Quotations cannot be built or tested without
real prices. **Escalate at W8 if it has not been promised, at W10 if it has not arrived** — and
say plainly that Phase 2 acceptance moves with it.

---

## Risks we have already retired

| Risk | How it was retired |
|---|---|
| Wrong offline sync technology | ADR-006 — researched, decided, with PowerSync documented as the escape hatch |
| Wrong hosting cost model | ADR-003 — VPS costed against Vercel; photos routed away from the app host |
| PDF rupee symbol failing silently | Noto Sans baked into the Gotenberg image + a CI test |
| Invoice numbering gaps | `next_invoice_no()` takes a row lock; verified by execution |
| RLS performance collapse at scale | Four rules enforced in review; benchmarks in ADR-004 |
| Not knowing the compliance landscape | Researched and verified 26 Sep 2026 |

---

## Assumptions that would hurt most if wrong

From `../00-brief/04-assumptions-open-questions.md`:

| Assumption | If wrong | Cost |
|---|---|---|
| **B3** — one surveyor owns a visit | The outbox model needs partitioning by unit, or PowerSync | 1–2 weeks |
| **B6** — REDUX below ₹5 Cr AATO | e-invoicing becomes mandatory and permanent | +2 weeks |
| B2 — Android only | iOS build needed | +2 weeks + Apple account |
| B1 — volume estimates | Infrastructure resizing | Cost, not schedule |
| B5 — OTP approval sufficient | Aadhaar eSign integration | +1 week + per-signature cost |

**B3 and B6 are the two to verify early.** B3 in the W18 field trial; B6 with REDUX's CA by W14.
Both get materially more expensive the later they surface.
