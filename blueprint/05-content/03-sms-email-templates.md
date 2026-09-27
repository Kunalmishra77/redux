# 03 — SMS & Email Templates

---

## SMS — DLT-registered, OTP only

**Why so few:** WhatsApp sits outside TRAI DLT entirely. Keeping SMS to OTP means registering
3 templates instead of 20, and avoids the promotional 10:00–21:00 window where out-of-window
messages are **dropped, not queued**.

**DLT rules these templates obey**
- 6-character header (`REDUXB`), approved separately
- Variables pre-tagged by purpose; max ~5–6 `{#var#}` per template
- **URLs must be on reduxbath.com and whitelisted.** Public shorteners are silently blocked
- OTP/transactional deliver 24/7 and bypass DND

### `approval_otp_sms` · Transactional
```
{#var#} is your REDUX code to approve quotation {#var#}. Valid 10 minutes. Do not share. - REDUXB
```

### `login_otp_sms` · Transactional
```
{#var#} is your REDUX portal login code. Valid 10 minutes. Do not share. - REDUXB
```

### `survey_booked_sms` · Transactional *(fallback when WhatsApp fails)*
```
REDUX free assessment confirmed for {#var#} at {#var#}. Surveyor: {#var#}. Reply or call {#var#} to reschedule. - REDUXB
```

---

## Email

Used **in addition to** WhatsApp where a document must be retained, and as the audit trail
for approvals. Plain, single-column, 600 px, no heavy imagery — hotel mail servers are strict and
engineering teams read on phones.

### `quote_issued`
**Subject:** `REDUX Quotation {{quote_no}} — {{property_name}}`
```
Dear {{name}},

Please find attached quotation {{quote_no}} for {{property_name}}, prepared from the
free assessment carried out on {{survey_date}} by {{surveyor_name}}.

  Fittings assessed : {{count}}
  Total (incl. GST) : {{total}}
  Market replacement: {{market_total}}
  You save          : {{you_save}}
  Valid until       : {{valid_until}}

The quotation prices restoration, Eurobrass replacement and market replacement for
each fitting, so your team can compare them directly.

To approve, open the link below and confirm with the code sent to your registered
mobile number.

  {{approval_link}}

Warranty terms are included in the attached document.

Regards,
REDUX — Bath Restorations by Eurobrass
```

### `quote_approved_receipt` — **the legal one**
**Subject:** `Approved — REDUX Quotation {{quote_no}}`
```
Dear {{name}},

Quotation {{quote_no}} was approved on {{approved_at}} IST.

  Approved by      : {{approver_name}} ({{approver_phone}})
  Document checksum: {{pdf_sha256}}
  Approval ref     : {{approval_id}}
  Job number       : {{job_no}}

The approved quotation and the terms accepted are attached exactly as presented at
the time of approval.

We will contact you to confirm work dates. Progress is visible at any time at
my.reduxbath.com.

Regards,
REDUX — Bath Restorations by Eurobrass
```
**Send immediately on approval, every time.** Contemporaneous delivery of the signed document and
its checksum to the other party is strong corroboration under s.65B / s.63 — and it costs nothing.

### `invoice_issued`
**Subject:** `Invoice {{invoice_no}} — {{property_name}}`
```
Dear {{name}},

Invoice {{invoice_no}} dated {{issue_date}} is attached.

  Job            : {{job_no}}
  Taxable value  : {{taxable}}
  GST            : {{gst}}
  Total          : {{total}}
  Due date       : {{due_date}}

Payment options
  Bank transfer (NEFT/RTGS) — details on the invoice
  Online — {{payment_link}}

GSTIN: {{supplier_gstin}}

Regards,
REDUX — Bath Restorations by Eurobrass
```

### `warranty_card`
**Subject:** `Warranty — {{property_name}} · {{job_no}}`
```
Dear {{name}},

Work at {{property_name}} is complete. Warranty cards are attached.

  Mechanical work   : valid to {{mech_until}}
  Restored finishes : valid to {{finish_until}}
  Units covered     : {{unit_count}}

Before-and-after photographs and full details are in your portal at
my.reduxbath.com.

To raise a warranty claim, use the portal or reply to this email. We acknowledge
within 48 hours.

Regards,
REDUX — Bath Restorations by Eurobrass
```

### `weekly_summary` *(internal, to Super Admin)*
**Subject:** `REDUX weekly — {{week_start}} to {{week_end}}`
```
Leads                    {{leads}}   ({{leads_delta}} vs last week)
Free surveys completed   {{surveys}}
Survey-to-order          {{conversion}}%
Quoted value             {{quoted}}
Won value                {{won}}
Jobs at factory          {{at_factory}}
Units back in service    {{back_in_service}}

Needs attention
  Leads past SLA         {{sla_breached}}
  Quotes expiring in 7d  {{expiring}}
  Jobs running late      {{late_jobs}}
  Stock below minimum    {{low_stock}}
  Unsynced surveyor data {{unsynced}}

Full reports: {{reports_link}}
```

---

## Sending rules

| Rule | Detail |
|---|---|
| Channel order | WhatsApp → SMS only on failure or no WhatsApp → email in addition for documents |
| From | `REDUX <noreply@reduxbath.com>`, reply-to a monitored address |
| SPF / DKIM / DMARC | All three configured before the first send — hotel mail servers are strict |
| Attachments | PDFs only, generated server-side, ≤5 MB |
| Quiet hours | No customer WhatsApp 21:00–09:00 IST except OTP |
| Idempotency | `dedup_key` on every message; a retried job never double-sends |
| Unsubscribe | Marketing email carries a one-click unsubscribe. Transactional does not — it is essential to a job in progress |
