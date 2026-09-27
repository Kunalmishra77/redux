# 02 — WhatsApp Templates

Submit to Meta for approval. Matrix of triggers: `../02-product/04-notifications-matrix.md`.

---

## ⚠ The rule that governs every template on this page

| Category | India rate | Multiplier |
|---|---|---|
| Utility | **₹0.115** | 1× |
| Marketing | **₹0.8631** | **7.5×** |

A template is **utility** only if it is non-promotional **and** follows a user action or is
essential. Everything below is written to stay utility.

**One upsell line turns a ₹0.115 message into ₹0.8631.** Since Apr 2025 `allow_category_change`
defaults on, so Meta reclassifies **silently**, and repeat misclassification is reclassified with
no advance notice at all.

**Therefore: no offer, no discount, no "book another service", no "limited time" in any template
below.** Promotional content gets its own explicitly-marketing template with its own opt-in.

---

## Phase 1 — submit in Week 4

### `enquiry_received` · Utility
```
Hello {{1}},

Thank you for your enquiry to REDUX — Bath Restorations by Eurobrass.

One of our team will call you within 2 working hours to understand your fittings
and arrange a free assessment.

Your reference: {{2}}
```
`{{1}}` name · `{{2}}` lead reference

---

### `survey_booked` · Utility
```
Hello {{1}},

Your free assessment is confirmed.

Date: {{2}}
Time: {{3}}
Surveyor: {{4}}

Our surveyor will audit each fitting and share a written scope with pricing.
The assessment is free and carries no obligation.

To reschedule, reply to this message.
```
`{{1}}` name · `{{2}}` date · `{{3}}` slot · `{{4}}` surveyor name

---

### `approval_otp` · Authentication
```
{{1}} is your REDUX verification code to approve quotation {{2}}.

Valid for 10 minutes. Do not share this code with anyone.
```

---

### `login_otp` · Authentication
```
{{1}} is your REDUX portal login code.

Valid for 10 minutes. Do not share this code with anyone.
```

---

## Phase 2 — submit in Week 10

### `survey_reminder` · Utility
```
Hello {{1}},

A reminder that your free REDUX assessment is tomorrow.

Date: {{2}}
Time: {{3}}
Surveyor: {{4}}

Please ensure the bathrooms are accessible during this window.
```

### `surveyor_on_way` · Utility
```
Hello {{1}},

{{2}} from REDUX is on the way for your assessment and should arrive by {{3}}.
```

### `quote_shared` · Utility
```
Hello {{1}},

Your REDUX quotation {{2}} is ready.

{{3}} fittings assessed
Total (incl. GST): {{4}}
Valid until: {{5}}

The quotation compares restoration, Eurobrass replacement and market replacement
for each fitting. Open the attached document to review and approve.
```
*(Sent with the PDF as a document attachment.)*

### `quote_approved` · Utility
```
Hello {{1}},

Thank you — quotation {{2}} is approved.

Job number: {{3}}

We will contact you to confirm work dates. You can follow progress any time at
my.reduxbath.com using your registered mobile number.

A signed copy of the approved quotation has been emailed to you.
```

### `quote_expiring` · Utility
```
Hello {{1}},

Quotation {{2}} is valid until {{3}} — three days from today.

After that date the quotation will need to be reissued, as pricing is based on
the rate card current at the time of assessment.
```
*(Note: a statement of fact about validity is utility. "Approve now and save 10%" would be
marketing.)*

### `dates_confirmed` · Utility
```
Hello {{1}},

Work dates are confirmed for job {{2}}.

{{3}}
From: {{4}}
To: {{5}}

Rooms will be returned to service after leak, operation and finish checks.
```

### `job_update` · Utility
```
Hello {{1}},

Update on job {{2}}.

{{3}}: {{4}}

Follow live progress at my.reduxbath.com.
```
`{{3}}` unit/batch label · `{{4}}` stage in plain words

### `handover_complete` · Utility
```
Hello {{1}},

{{2}} is complete and back in service.

Restored fittings: {{3}}
Warranty: {{4}}

Before-and-after photographs, your invoice and your warranty card are in your
portal at my.reduxbath.com.
```

---

## Phase 3 — submit in Week 18

### `invoice_raised` · Utility
```
Hello {{1}},

Invoice {{2}} for job {{3}} is ready.

Amount: {{4}}
Due: {{5}}

View and pay at my.reduxbath.com, or use the bank details on the invoice.
```

### `payment_received` · Utility
```
Hello {{1}},

We've received your payment of {{2}} against invoice {{3}}.

Thank you.
```

### `payment_overdue` · Utility
```
Hello {{1}},

Invoice {{2}} for {{3}} was due on {{4}}.

If payment has already been made, please ignore this message.
You can view the invoice at my.reduxbath.com.
```

### `service_ack` · Utility
```
Hello {{1}},

We've received your service request {{2}}.

{{3}}

Our team will contact you within 48 hours.
```

### `feedback_request` · Utility
```
Hello {{1}},

It's been a month since we completed work at {{2}}.

How are the restored fittings performing? Reply to this message with any
observations — it helps us improve, and any issue within warranty is covered.
```
**Note:** this stays utility because it is a service follow-up. Adding *"and get 10% off your next
restoration"* makes it marketing at 7.5× **and** requires marketing opt-in. If REDUX wants both,
send two messages.

### `warranty_expiring` · Utility
```
Hello {{1}},

The {{2}} warranty on your restored fittings at {{3}} expires on {{4}}.

Your warranty card and full details are at my.reduxbath.com.
```

---

## Marketing templates (separate, opt-in only)

Any campaign REDUX runs goes here, **never** into a transactional template above.

| Template | Category | Requires |
|---|---|---|
| `campaign_seasonal` | Marketing | Logged marketing opt-in (`consent_records`) |
| `campaign_hotel_offer` | Marketing | Same |

**Before sending any marketing template:** check `consent_records` for an active `marketing`
consent for that phone number. Withdrawal is honoured immediately. Keep opt-in evidence ≥2 years.

---

## Submission checklist

- [ ] Correct category selected — utility for everything except the two campaign templates
- [ ] No promotional language anywhere in a utility template
- [ ] Variables numbered sequentially from `{{1}}` with no gaps
- [ ] Sample values supplied for every variable (Meta rejects templates without them)
- [ ] URLs point to reduxbath.com / my.reduxbath.com — never a shortener
- [ ] Display name approved before submitting templates
- [ ] Quality rating monitored after go-live; a low rating pauses the template
