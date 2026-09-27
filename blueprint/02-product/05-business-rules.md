# 05 — Business Rules

The logic that has to be exactly right. Each rule has an ID, a statement and a test.
If a rule here conflicts with a screen mock or a convenient shortcut, **this file wins.**

---

## Leads

| ID | Rule | Test |
|---|---|---|
| BR-L1 | A lead is identified by **phone number normalised to E.164**. A repeat enquiry from the same number attaches to the existing lead as a new *touch* — it never creates a second lead row | Submit the same number twice from different sources → 1 lead, 2 touches, both sources recorded |
| BR-L2 | Source attribution is **first-touch for the lead**, and every touch keeps its own source | Google Ads then WhatsApp → lead source `google_ads`, touches show both |
| BR-L3 | `ctwa_clid`, `ad_id`, `form_id`, `campaign_id` are written at creation and are **immutable** | Attempt to update → denied |
| BR-L4 | Auto-assignment: by city if a `cc_exec` covers it, else round-robin across active executives. Inactive executives are skipped | Deactivate an executive → their next turn is skipped, open leads reassign |
| BR-L5 | The SLA clock starts at lead creation, **not** at assignment | Delay assignment by 10 min → SLA already 10 min elapsed |
| BR-L6 | A lead cannot move to `survey_booked` without a survey record existing | Force the status → rejected |
| BR-L7 | `lost` requires a reason from the controlled list | Save without reason → rejected |
| BR-L8 | A lost lead can be reopened; the reason and reopen are both kept in history | Reopen → timeline shows both events |

## Surveys

| ID | Rule | Test |
|---|---|---|
| BR-S1 | **The survey is free. It never generates a charge.** No survey record can carry a price | Schema has no price column on `surveys` |
| BR-S2 | A surveyor can hold only one survey per time slot | Double-book → rejected with the clash shown |
| BR-S3 | Check-in requires GPS. Accuracy >50 m is recorded and **flagged**, not blocked — a basement with no GPS must not stop work | Check in at 120 m accuracy → allowed, flagged |
| BR-S4 | Server-side integrity: check-in outside a 500 m geofence of the property, or implying impossible travel from the previous check-in, is flagged for admin review | Both cases → flag raised, work continues |
| BR-S5 | **A fitting cannot be saved without all four photo slots filled** | Save with 3 → rejected in the app, and rejected server-side |
| BR-S6 | A survey cannot be submitted while any attachment is unsynced | Submit with 1 pending → blocked, "needs attention" shown |
| BR-S7 | Photos are immutable once synced. A correction adds a new photo; it never overwrites | Re-upload same slot → new row, old retained |

## Assessment & pricing

| ID | Rule | Test |
|---|---|---|
| BR-A1 | Every audited fitting must have a recommendation before it can go on a quote | Quote with an unassessed fitting → rejected |
| BR-A2 | **All three options are always priced**: recommended work, Eurobrass replacement, market replacement | Any line missing one → rejected |
| BR-A3 | Prices come from the **active rate card version**, and that `rate_card_version_id` is stored on every quote line | Change the rate card → existing quotes unchanged |
| BR-A4 | "You save" = market replacement − recommended option. Never negative; if it would be, it is hidden | Construct a case → field hidden, no negative shown |
| BR-A5 | A price not on the rate card requires a **manual override with a reason**, and is logged | Override → `audit_log` entry with actor and reason |
| BR-A6 | Discount above the configured threshold (default 5%) blocks sending until Super Admin approves | Apply 10% → quote stuck in `pending_approval` |

## Quotations

| ID | Rule | Test |
|---|---|---|
| BR-Q1 | Validity is **15 days** from issue. An expired quote cannot be approved | Approve on day 16 → rejected, re-quote required |
| BR-Q2 | A quote is **immutable once sent**. A change creates a new version that supersedes it | Edit a sent quote → v2 created, v1 marked superseded |
| BR-Q3 | Warranty terms are **snapshotted onto the quote** at issue. Later edits to the master terms never change an issued quote | Edit master terms → existing quote unchanged |
| BR-Q4 | OTP approval writes the full audit trail (PDF SHA-256, OTP lifecycle timestamps, gateway message ID, IP, user agent, terms text). All timestamps are **server-side** | Approve → every field populated; client clock ignored |
| BR-Q5 | OTP expires in 10 minutes; max 5 attempts; then a new OTP must be requested | 6th attempt → locked out |
| BR-Q6 | On approval, the customer account and job are created **in the same transaction** as the approval | Simulate failure mid-way → nothing is created, approval not recorded |
| BR-Q7 | An approved quote can never be edited or deleted — only superseded by a change order | Update → denied by RLS policy |

## Jobs

| ID | Rule | Test |
|---|---|---|
| BR-J1 | Stages move forward in order. A backward move requires a reason and is logged | Skip a stage → rejected. Move back → reason required |
| BR-J2 | A unit's **downtime clock stops** while `blocked_reason` is set (e.g. `civil_work`) | Block for 5 days → delay metric excludes those days |
| BR-J3 | A job is `completed` only when **every** unit has reached `handover` | Force → rejected while any unit is open |
| BR-J4 | **Warranty cards are generated at handover**, not at invoice — the warranty starts when the fitting is back in service | Handover → cards created with validity from that date |
| BR-J5 | Mechanical and finish warranties have **separate periods** and are tracked separately | Both cards exist with independent expiry |
| BR-J6 | A pilot job links to its wider project via `parent_job_id`; the wider project inherits the pilot's agreed rates unless re-quoted | Create wider project from pilot → rates carried, flagged as inherited |

## Invoicing & payments

| ID | Rule | Test |
|---|---|---|
| BR-I1 | Invoice numbers are **gap-free and sequential within a financial year**, max 16 characters, reset 1 April | Concurrent inserts → no gaps, no duplicates |
| BR-I2 | An invoice is **never deleted**. A cancellation is a credit note | Delete → denied |
| BR-I3 | GST fields are **stored on the invoice row**, never recomputed at render. A 3-year-old invoice must reproduce byte-identically | Change the tax rate → old invoice PDF unchanged |
| BR-I4 | Place of supply decides CGST+SGST vs IGST, from the recipient's state | Delhi → CGST+SGST; Haryana → IGST |
| BR-I5 | An invoice is marked paid **only** from a signature-verified webhook. Never from a browser redirect | Simulate redirect without webhook → invoice stays unpaid |
| BR-I6 | Payment routing: ≤ ₹50,000 → Payment Link; > ₹50,000 → virtual account shown first | ₹75,000 invoice → virtual account primary |
| BR-I7 | Payment webhooks are idempotent on `payment.id` | Deliver twice → paid once |
| BR-I8 | Invoice for a service must be issued within 30 days of supply — the system warns at day 25 | Day 25 → admin alert |

## Stock

| ID | Rule | Test |
|---|---|---|
| BR-ST1 | Stock can go to zero but **never negative**. An issue beyond available quantity is rejected | Issue 10 from 5 → rejected |
| BR-ST2 | Every movement records type, quantity, actor, timestamp and optionally the job | Movement without actor → rejected |
| BR-ST3 | The low-stock alert fires **once per crossing**, not repeatedly, and re-arms when stock goes back above minimum | Hover at the boundary → 1 alert per crossing |

## Consent & privacy

| ID | Rule | Test |
|---|---|---|
| BR-P1 | Consent is captured at every collection point, versioned against the **notice text version** shown | Change the notice → new version; old records keep the old version |
| BR-P2 | Service/marketing/call-recording consents are **separate and independently withdrawable** | Withdraw marketing → service messages continue |
| BR-P3 | Site photographs may not be used for marketing without a separate `marketing_use_consented` flag on the photo | Try to publish without it → blocked |
| BR-P4 | Call recordings auto-delete at 90 days unless flagged for a live dispute | Day 91 → deleted, deletion logged |
| BR-P5 | An erasure request is honoured after job closure and statutory retention (GST records: 6 years+). What is retained and why is shown to the customer | Request during a live job → queued with a stated reason |
| BR-P6 | A DPDP breach opens an `incidents` record with the 72-hour report clock running | Create incident → deadline computed and surfaced |

## Access

| ID | Rule | Test |
|---|---|---|
| BR-X1 | Every table has RLS enabled. A table without a policy denies by default | Migration test asserts RLS on all public tables |
| BR-X2 | The service-role key is used only in server code and never reaches any client bundle | Build check greps client bundles |
| BR-X3 | Photo access is via short-lived signed URLs (5–15 min). Buckets are never public | Public URL fetch → 403 |
| BR-X4 | Every privileged action writes `audit_log` with actor, entity, before, after, timestamp | Change a price → audit row |
