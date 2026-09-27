# 05 — India Compliance

Verified 26 Sep 2026. This is a **build checklist**, not legal advice — REDUX's CA and counsel own
the final positions. Everything here is "what the software must do".

---

## 1. DPDP Act 2023 + DPDP Rules 2025

### Status and timeline (verified)
Rules notified **13–14 Nov 2025**, phased:

| Date | What commences |
|---|---|
| Immediate (Nov 2025) | Data Protection Board constitution |
| **13 Nov 2026** | Rule 4 — Consent Manager framework |
| **13 May 2027** | Rules 3, 5–16, 22, 23 + core substantive obligations — **the real deadline** |

**Consent Managers are optional** for an ordinary data fiduciary. REDUX is **not** required to
register as or integrate with one. Do not let a vendor sell that.

REDUX is an **ordinary (non-Significant) Data Fiduciary** — SDF thresholds (5 M+ data principals /
₹250 Cr turnover) don't apply. So: no mandatory DPO, no independent audit, no DPIA.

### Why we build consent in Phase 1 even though enforcement is May 2027
Retrofitting consent onto leads already collected is the hardest part of DPDP. Every lead captured
between Dec 2026 and May 2027 without a consent record is a problem we'd have to solve later by
re-contacting people. **Consent ledger ships with D2.**

### The build checklist

| # | Requirement | What we build |
|---|---|---|
| 1 | **Notice** at every collection point | Itemised notice on lead forms and portal signup: what data, what purpose, how to withdraw, how to complain to the Board. Available in English + Eighth Schedule languages **on request** → a downloadable translated notice, not a translated UI |
| 2 | **Consent** — granular, unbundled | Separate checkboxes: service delivery ≠ marketing ≠ call recording. `consent_records` stores purpose, **notice text version**, timestamp, IP, user agent, method, withdrawal timestamp |
| 3 | **Purpose limitation** | Site photographs collected for quotation/workmanship evidence **may not be reused in marketing** without separate consent. Enforced in code via a `marketing_use_consented` flag on the photo, not in a policy document |
| 4 | **Data principal rights** | Portal endpoints for access (export their data + who it was shared with), correction, erasure, nomination. Published grievance contact. Every request logged with an SLA clock |
| 5 | **Erasure / retention** | Scheduled job purging site photos and call recordings past retention, and on consent withdrawal |
| 6 | **Breach notification (Rule 7)** | To affected principals **without delay** (nature, extent, timing, consequences, mitigation, what they should do, contact person); to the Board **without delay** plus a **detailed report within 72 hours**. Build an `incidents` register now, not after the first breach |
| 7 | **Children's data** | Verifiable parental consent, no behavioural tracking/ads to minors. Practically: declare the service 18+ in T&C |
| 8 | **Security** | Encryption at rest, RLS on every table, **short-lived signed URLs for photos — never a public bucket**, access logs retained 1 year |

**Penalties:** up to ₹250 Cr; security failures up to ₹250 Cr; breach-notification failure up to ₹200 Cr.

---

## 2. Call recording

Legal in India, but "this call may be recorded" is **no longer sufficient** under DPDP.

**What we build:**
1. Automated announcement in the **first 15 seconds** stating the **specific** purpose
   ("recorded for quality and training") — not a generic one.
2. A genuine, functional opt-out that still lets the call proceed.
3. Timestamped consent log per call, linked to `call_id`.
4. Role-based access to recordings (not every care executive hears every call).
5. **Auto-delete at 90 days** for QA/training; longer only for a live dispute (resolution + 30 days).
6. **The agent's own consent is also required** — their voice is personal data too. Capture it at
   onboarding.

Exposure if ignored: IT Act s.72 and s.66E; TRAI penalties ₹2 L–₹10 L per violation for commercial
calling breaches.

→ Client decision D-e in `../00-brief/04-assumptions-open-questions.md`.

---

## 3. SMS / TRAI DLT

**DLT is still mandatory in 2026** for all domestic commercial SMS, transactional included.

### Registration path
1. **Principal Entity → PE ID** — PAN, GST, incorporation proof, signatory KYC, authorisation
   letter. ~₹5,900 incl. GST, one-time, 24–72 hrs.
   ⚠ **Biometric authentication required since the Feb 2025 TRAI amendment.**
2. **Header** — 6-character alphanumeric, ~₹590/yr, 1–3 days.
3. **Content templates** — free, 1–3 days.
4. **PE–TM binding** with the SMS provider (MSG91).

### 2024–25 changes we must design around
- **All CTAs/URLs must be pre-whitelisted. Public URL shorteners (bit.ly, tinyurl) are silently
  blocked.** Our quote/invoice/payment links must use REDUX's own domain, whitelisted on DLT.
- From 6 May 2025, headers carry an operator-appended category suffix (`-T`, `-S`, `-P`, `-G`).
- Since 1 Oct 2024, template variables must be **pre-tagged by purpose** (OTP, amount, date);
  max ~5–6 `{#var#}` per template.
- "Service Explicit" category discontinued → merged into Promotional.
- **Promotional SMS only 10:00–21:00 IST, and out-of-window messages are dropped, not queued.**
  Transactional/Service-Implicit deliver 24/7 and bypass DND.

### Decision
**WhatsApp primary, SMS for OTP only.** WhatsApp is outside DLT entirely — no PE ID, no header, no
scrubbing, no time window, no URL whitelisting. We still register DLT, but for ~3 OTP templates
instead of ~20.

---

## 4. GST invoicing

### Mandatory fields (Rule 46) — all of these are columns on `invoices`
Supplier name/address/GSTIN · consecutive invoice number · date · recipient name/address/GSTIN
(or, if unregistered and value > ₹50,000: name, address, state + code) · **HSN/SAC** · description ·
quantity/UOM · taxable value · rate and amount of CGST/SGST/IGST/cess · **place of supply with
state code** for inter-state · delivery address if different · **"reverse charge: Yes/No"** ·
signature or digital signature.

### Numbering — get this right in the schema, it is not fixable later
Max **16 characters**, alphanumerics plus `-` and `/` only, **unique and consecutive within each
financial year**, reset on 1 April. Separate series per branch/document type is fine if each is
sequential.

**Build:** a DB-level sequence per series per FY, **gap-free**. No soft-deletes that leave holes.
A cancelled invoice becomes a credit note, never a deleted row.

### HSN / SAC — CA must confirm
- **Services** (restoration, repair, polishing, refinishing): heading **9987**, "Maintenance,
  repair and installation (except construction)". **SAC 998719** is the usual fit. **@18% GST.**
  9987 has several sub-heads and misclassification is a real ITC risk — confirm the 6-digit SAC.
- **Goods** (fittings supplied): sanitary ware / brass fittings fall in **Chapter 74** or
  7418/6910/3922 depending on material. **UNVERIFIED for REDUX's exact SKUs — the CA must map these.**
- Digits: turnover ≤ ₹5 Cr → 4-digit on B2B; > ₹5 Cr → 6-digit on both.

### e-Invoicing (IRP)
Threshold is **₹5 Cr AATO**, unchanged since 1 Aug 2023 and still ₹5 Cr in 2026. Once crossed in
**any** FY from 2017-18 onward the obligation is **permanent**. Applies to B2B, exports, SEZ,
deemed exports and related CDNs — **not B2C**.

The **30-day IRP reporting limit** applies only at **₹10 Cr+ AATO** (effective 1 Apr 2025);
₹5–10 Cr is not yet subject to the hard deadline. Late reporting blocks IRN generation, which makes
the invoice legally invalid.

**→ Assumption B6: we assume REDUX is below ₹5 Cr. This must be confirmed with their CA before
Week 14.** If it's wrong, add ~2 weeks for GSP integration.

### Other
- **Invoice timing for services: within 30 days of supply.**
- **e-Way bill** only when moving goods over ₹50,000 — relevant when fittings travel to the
  Eurobrass workshop and back. Job-work movement needs a **delivery challan** plus an e-way bill
  above threshold. Pure on-site service needs neither.

### Software vs accountant
| Software generates | Accountant owns |
|---|---|
| Invoice number series, all Rule 46 fields, tax computation, place-of-supply logic, PDF, and (if ₹5 Cr+) the IRP JSON + QR/IRN via a GSP | HSN/SAC mapping, GSTR-1/3B filing, ITC reconciliation, turnover determination |

---

## 5. Consumer Protection (the customer portal)

Consumer Protection Act 2019 + **E-Commerce Rules 2020** apply because services are sold online.
Must be displayed **before purchase**:
- Total price with breakup
- **All mandatory disclosures on guarantees/warranties**
- Return / refund / cancellation terms
- Delivery / completion timelines
- Seller identity and address
- **A grievance officer with name, contact and ID**, who must **acknowledge within 48 hours and
  resolve within 1 month**

**What we build:** warranty terms **versioned and snapshotted into the accepted quotation**, so the
customer always sees exactly the terms they accepted — not a later edit. Plus a warranty-claim flow
with a 48 h acknowledgement SLA, and a visible grievance-officer block in the portal footer.
A misleading warranty claim is an "unfair trade practice" and the CCPA can act.

---

## 6. OTP approval — is it legally meaningful?

**Yes, with an important nuance.**

- **IT Act s.10A**: a contract is not unenforceable merely because it was formed electronically.
  An OTP-verified click-accept is a valid e-contract, and Indian courts have consistently upheld
  click-wrap agreements.
- **But s.3A**: a statutory "electronic signature" means only techniques in the **Second Schedule**
  — Aadhaar eSign or a digital signature certificate. **OTP-on-mobile is not one**, so it does
  **not** get s.85B's presumption of authenticity.
- It remains admissible under **s.65B Evidence Act / s.63 BSA 2023** — but **we carry the burden of
  proving it**, via the audit trail.

### The audit trail — this is what makes the approval defensible
Store on `quote_approvals`:

```
quotation_id, quotation_version
pdf_sha256            -- SHA-256 of the EXACT approved PDF
approver_name, approver_mobile
otp_hash              -- never plaintext
otp_generated_at, otp_delivered_at, otp_verified_at   -- server-side, NTP-synced
delivery_channel, gateway_message_id, dlt_template_id
attempt_count, failed_attempts
ip_address, user_agent, geolocation (if consented)
terms_text            -- the exact terms shown at approval
```

Append-only. Plus a **s.65B / s.63 certificate generator** producing a signed statement about the
computer system that produced the record. **Email the signed PDF + audit trail to the customer
immediately** — contemporaneous delivery is strong corroboration.

### Should we add Aadhaar eSign?
**Not for the default flow.** OTP plus a strong audit trail is proportionate for ₹20 k–₹5 L quotes,
and Aadhaar eSign adds friction that kills conversion.

**Offer it as an escalation** above ~₹5 L or where a hotel's legal team demands it. That means an
ASP (Leegality, Digio, SignDesk, eMudhra) fronting a licensed ESP/CA; the signer needs an
Aadhaar-linked mobile. Indicative ~₹20–₹50 per signature plus platform fees —
**2026 pricing UNVERIFIED, all providers quote on request.**

**DigiLocker** is for document *fetch/verification* (GST certificate, PAN, ID) — useful for
onboarding hotel clients, not a signature mechanism.

---

## Unverified items — confirm before they become commitments

1. **"Small merchant" turnover definition** for continued zero UPI MDR after 15 Oct 2026.
2. **Per-mode MDR for Cashfree and PhonePe PG** — quote-on-request.
3. **Exact 6-digit SAC** for bath-fitting restoration; **HSN chapters** for the fittings supplied.
4. **Aadhaar eSign 2026 per-signature pricing.**
5. **No NPCI circular number located** for the UPI MDR change — secondary reporting only.
6. **REDUX's AATO** — determines whether e-invoicing is mandatory (assumption B6).

---

## Sources
- India DPDP Compliance Timeline 2026-27 · india-briefing.com
- DPDP Act and Rules 2025: 2026 Compliance Milestones · mondaq.com
- DPDP Rules 2025 — Rule 7, Intimation of Personal Data Breach · dpdpa.com/dpdparules/rule7.html
- Call Recording Compliance India (2026) · frejun.com/call-recording-compliance-india/
- India SMS Regulations, DLT & TRAI Compliance Guide 2026 · messagecentral.com/sms-guideline/india
- E-Invoice Limit in India 2026 · xflowpay.com/blog/e-invoice-limit
- GST Invoice Rules, Mandatory Fields, E-Invoice (2026) · taxgarden.in
- SAC 998719 · findgst.in/saclist/9987/sac-998719
- Consumer Protection (E-Commerce) Rules 2020 · consumeraffairs.nic.in
- Aadhaar eSign legality (IT Act 2000) · leegality.com/blog/law-around-aadhaar-esign
- E-Contracts in India: IT Act Section 10A · apnilaw.com
