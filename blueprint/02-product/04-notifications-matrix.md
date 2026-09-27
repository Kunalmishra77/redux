# 04 — Notifications Matrix

Deliverables **D5** (Phase 1), **D12** (Phase 2), **D18** (Phase 3).
Template copy: `../05-content/02-whatsapp-templates.md`.

---

## The cost rule that governs every template

| Category | India rate | When it applies |
|---|---|---|
| **Utility** | **₹0.115** | Non-promotional **and** follows a user action or is essential |
| **Marketing** | **₹0.8631** | Anything promotional — **7.5× the cost** |
| Authentication | ₹0.115 | OTP only |
| Service | ₹0.115 (billable from 1 Oct 2026) | Free-text replies inside the 24-h window |

**Since Apr 2025, Meta reclassifies silently.** A utility template that picks up a "book another
service" line becomes a marketing template at 7.5× — with no warning, and repeat offences are
reclassified with no notice at all.

**Therefore, the hard rule:** a transactional template contains the fact and nothing else.
No offer. No discount. No cross-sell. No "while we're here…". Promotional messages live in
separate, explicitly-marketing templates with their own opt-in.

---

## Customer notifications

| # | Trigger | Channel | Category | Template | Phase / D |
|---|---|---|---|---|---|
| CN1 | Lead created (any source) | WhatsApp | Utility | `enquiry_received` | P1 · D5 |
| CN2 | Free survey booked | WhatsApp | Utility | `survey_booked` | P1 · D5 |
| CN3 | Survey reminder, 1 day before | WhatsApp | Utility | `survey_reminder` | P2 · D12 |
| CN4 | Surveyor checked in / on the way | WhatsApp | Utility | `surveyor_on_way` | P2 · D12 |
| CN5 | Quotation shared | WhatsApp + doc | Utility | `quote_shared` | P2 · D12 |
| CN6 | OTP for quote approval | WhatsApp → SMS fallback | Authentication | `approval_otp` | P2 · D12 |
| CN7 | Quote approved — confirmation + signed PDF | WhatsApp + email | Utility | `quote_approved` | P2 · D12 |
| CN8 | Quote expiring in 3 days | WhatsApp | Utility | `quote_expiring` | P2 · D12 |
| CN9 | Work dates confirmed | WhatsApp | Utility | `dates_confirmed` | P2 · D12 |
| CN10 | Stage change: removal / at factory / refit | WhatsApp | Utility | `job_update` | P2 · D12 |
| CN11 | Handover complete — invoice + warranty | WhatsApp + email | Utility | `handover_complete` | P2 · D12 |
| CN12 | Invoice raised | WhatsApp + email | Utility | `invoice_raised` | P3 · D18 |
| CN13 | Payment received | WhatsApp | Utility | `payment_received` | P3 · D18 |
| CN14 | Payment overdue (7 days) | WhatsApp | Utility | `payment_overdue` | P3 · D18 |
| CN15 | Portal login OTP | WhatsApp → SMS fallback | Authentication | `login_otp` | P3 · D18 |
| CN16 | Service request acknowledged (<48 h SLA) | WhatsApp | Utility | `service_ack` | P3 · D18 |
| CN17 | **Feedback & review request, 30 days after handover** | WhatsApp | Utility | `feedback_request` | P3 · D18 |
| CN18 | Warranty expiring in 30 days | WhatsApp | Utility | `warranty_expiring` | P3 · D18 |

**CN17 is the boundary case.** A feedback request following a completed job is utility. Adding
"and get 10% off your next restoration" makes it marketing at 7.5× — and needs marketing opt-in.
Keep them as two separate messages if REDUX wants both.

---

## Team notifications

In-app + email; WhatsApp only where the person is away from a desk.

| # | Trigger | To | Channel | Phase / D |
|---|---|---|---|---|
| TN1 | New lead assigned | Assigned `cc_exec` | In-app + push | P1 · D5 |
| TN2 | Call-back SLA due | Assigned `cc_exec` | In-app | P1 · D5 |
| TN3 | Call-back SLA **breached** | `cc_exec` + `super_admin` | In-app + email | P1 · D5 |
| TN4 | Follow-up due | Assigned `cc_exec` | In-app | P1 · D5 |
| TN5 | **Integration silent >6 h** | `super_admin` | Email | P1 · D3 |
| TN6 | Survey booked | Assigned `surveyor` | Push to app | P2 · D12 |
| TN7 | Survey cancelled / rescheduled | Assigned `surveyor` | Push | P2 · D12 |
| TN8 | Quote needs discount approval | `super_admin` | In-app + email | P2 · D12 |
| TN9 | Quote approved by customer | `super_admin` + surveyor | In-app | P2 · D12 |
| TN10 | **Job running late** (unit past planned downtime, not blocked on civil work) | `super_admin` | In-app + email | P2 · D12 |
| TN11 | **Unsynced surveyor data >24 h** | `super_admin` | Email | P2 · D7 |
| TN12 | Service request raised | `cc_exec` queue | In-app | P3 · D18 |
| TN13 | **Stock below minimum** | `super_admin` | In-app + email | P3 · D18 |
| TN14 | Payment received / failed | `super_admin` | In-app | P3 · D18 |
| TN15 | Weekly summary report | `super_admin` | Email (scheduled) | P3 · D17 |

---

## Delivery rules

| Rule | Detail |
|---|---|
| **Channel order** | WhatsApp first. SMS only if the customer has no WhatsApp or WhatsApp delivery fails. Email in addition for documents (quote, invoice, warranty) |
| **Quiet hours** | No customer WhatsApp between 21:00 and 09:00 IST except OTP. Queue and send at 09:00 |
| **SMS constraint** | Promotional SMS is legally limited to 10:00–21:00 IST and out-of-window messages are **dropped, not queued**. Another reason SMS is OTP-only |
| **Links in SMS** | Must be on the reduxbath.com domain and DLT-whitelisted. **Public shorteners are silently blocked** |
| **Opt-out** | Marketing opt-out honoured immediately. Utility/service messages continue — they are essential to a job in progress |
| **Idempotency** | Every notification has a dedup key (`trigger + entity_id + attempt_window`). A retried job never double-sends |
| **Failure** | 3 attempts with backoff → mark failed → surface on the entity, do not fail silently |
| **Admin control** | Every rule in this matrix is toggleable from `/admin/notifications` (D16) without a deploy |
| **Audit** | Every sent message is stored with template, category, cost, status and provider message ID — so REDUX can see exactly what messaging costs per job |

---

## Templates needing Meta approval before Phase 1 go-live

Submit in Week 4 — approval takes days and rejections happen.

`enquiry_received` · `survey_booked` · `approval_otp` · `login_otp`

Remaining templates submit at the start of their phase.

## DLT templates (SMS — OTP only)

`approval_otp_sms` · `login_otp_sms` · `survey_booked_sms` (fallback)

Register at the same time as the DLT header in Week 0–1.
