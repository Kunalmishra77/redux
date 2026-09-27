# 06 — Integrations Runbook

Setup steps, in order, for every external system. Research and reasoning:
`../01-research/02-meta-whatsapp-integration.md` and `03-google-ads-payments.md`.

**Start items 1, 2 and 5 in Week 0.** They involve other people's approval queues and they gate
Phase 1.

---

## 1. Meta — Lead Ads  ⏰ CRITICAL PATH

### Setup (Week 0)
1. REDUX completes **Business Verification** in Business Manager. *(Tech Provider verification is
   NOT needed — that gate is for apps accessing other businesses' data.)*
2. Create a Meta app (Business type) under REDUX's Business Manager.
3. Create a **System User** with admin access; generate a **non-expiring token**.
   *(Never use a personal Page token — it dies when that person leaves the Page.)*
4. In Business Suite, assign **Leads Access** on the Page to the System User.
   **Skipping this gives 403s even with correct scopes. It trips everyone.**
5. Subscribe the Page:
   `POST /v25.0/{page-id}/subscribed_apps?subscribed_fields=leadgen`
6. Configure the webhook: `https://app.reduxbath.com/api/webhooks/meta`, verify token from env.
7. **Submit App Review** for `leads_retrieval`, `ads_management`, `pages_manage_metadata`,
   `pages_show_list`, `pages_read_engagement`. Attach a screencast of the end-to-end flow.

### Verify
- Lead Ads Testing Tool → create a test lead → confirm `webhook_events` row → confirm `leads` row.
- Only **one test lead per form at a time** — delete before creating another.
- Test leads arrive on the real webhook: tag and drop them.

### Operate
- Reconciliation poll every 15 minutes. **This is not optional** — Meta deletes lead data after
  90 days and a silent webhook gap is permanent loss.
- Store the raw `field_data` as JSONB plus a `lead_form_field_map` row per form. Custom question
  names are auto-slugged from the question text and **change if the marketer edits the question.**
- Pin Graph API to **v25.0**.
- If webhooks go quiet with no errors: check the TLS chain first (there is an unconfirmed report
  of a CA/mTLS change in Mar 2026), then check whether the subscription was auto-disabled after
  sustained failures.

---

## 2. WhatsApp Business Cloud API  ⏰ CRITICAL PATH

### Setup (Week 0–1)
1. Choose the number. **It must not be active on the consumer WhatsApp app** — delete it there first.
2. Create the WABA under REDUX's Business Manager; complete Business Verification (shared with §1).
3. Submit the **display name** for approval. It must relate to the business —
   "REDUX Bath" works; "Bath Restoration" will be rejected.
4. Register: `POST /{phone_number_id}/register` with a 6-digit PIN. Store the PIN somewhere REDUX
   can find it in two years.
5. Subscribe the WABA to the **`messages`** field →
   `https://app.reduxbath.com/api/webhooks/whatsapp`.
6. Set up **INR billing** (India localisation; all WABAs must be on INR by 31 Dec 2026).
7. Submit the Week-4 templates: `enquiry_received`, `survey_booked`, `approval_otp`, `login_otp`.

### Template rules (the cost rule)
- **Utility ₹0.115 vs Marketing ₹0.8631 — 7.5×.**
- A transactional template contains the fact and nothing else. One upsell line and Meta
  reclassifies it as marketing, **silently**, at 7.5× the cost.
- Submit with the correct category; `allow_category_change` defaults on since Apr 2025.
- Repeat misclassification is reclassified **with no advance notice** since Apr 2025.

### Operate
- Messaging limit tiers: 250 → 2,000 → 10K → 100K → unlimited. Business verification unlocks 2,000;
  scaling is automatic within ~6 h when quality is high **and** ≥50% of the current limit was used
  in the last 7 days.
- Quality rating is per-template and per-number. Watch it in Business Manager; low quality pauses
  templates.
- Log opt-in for marketing: source, timestamp, channel. Keep ≥2 years (`consent_records`).
- **Note: from 1 Oct 2026 service messages are billable and utility templates are billable inside
  the 24-hour window.** Re-check the rate card before quoting running costs to REDUX.

### CTWA attribution (do not skip)
Capture `messages[0].referral` → `source_id`, `source_type`, `ctwa_clid` onto the lead **at
creation**. It cannot be backfilled, and without it §3 does not work.

---

## 3. Meta Conversions API (CAPI)

The highest-ROI integration in the project: it lets Meta optimise REDUX's ads on **booked surveys
and won jobs** instead of raw chats.

- Create a WhatsApp conversions dataset in Events Manager.
- Fire two events: `survey_booked` and `job_won` (with value = quote total).
- Payload: `action_source: "business_messaging"`, `messaging_channel: "whatsapp"`,
  `user_data.ctwa_clid`, `user_data.whatsapp_business_account_id`, `event_name`, `event_time`
  (within the last 7 days), `custom_data` (currency INR + value).
- Up to 1,000 events per request. Meta validates and rejects fabricated CLIDs.
- Queue: `q_capi`, retried on failure, recorded in `capi_events`.

---

## 4. Google Ads lead forms

### Setup (Week 2–3)
1. Get access to REDUX's Google Ads account (or confirm there isn't one yet).
2. In the lead form asset → *Export leads → Other data integration options*:
   - Webhook URL: `https://app.reduxbath.com/api/webhooks/google-ads`
   - Webhook key: generate and store in env as `GOOGLE_ADS_WEBHOOK_KEY`
3. Click **"Send test data"** and confirm a `webhook_events` row appears.

### The contract
- Validate `google_key` with a constant-time compare.
- **Return HTTP 200 with body `{}`** — the exact body is part of the contract.
- **4XX is never retried: the lead is lost forever.** Never 4XX on a transient DB error —
  persist raw, return 200, process async. 5XX *is* retried, so that is the correct failure code
  if the database is genuinely unreachable.
- Dedup on `lead_id`; drop or tag `is_test: true`.
- Ignore unknown fields — Google adds optional fields without notice (`lead_stage`,
  `lead_source: CONVERSATIONAL_AGENT` are recent additions).

No Google Ads API, OAuth or developer token is needed.

---

## 5. Razorpay  ⏰ KYC gates Phase 3

### Setup (Week 0 for KYC, Week 17 for integration)
1. **KYC pack:** entity PAN, CIN / partnership deed, GST certificate, bank proof, signatory
   PAN + Aadhaar, address proof.
2. **The website must already have live Terms, Privacy, Refund/Cancellation and Contact pages.**
   This is why those are Phase 1 scope — KYC will not approve without them.
3. Enable **Payment Links** and **Smart Collect** (virtual accounts).
4. Webhook: `https://app.reduxbath.com/api/webhooks/razorpay`, secret in env.
5. Subscribe: `payment.captured`, `payment.failed`, `refund.processed`, `settlement.processed`.

### Routing rule (BR-I6)
| Invoice | Route |
|---|---|
| ≤ ₹50,000 | Payment Link (UPI / card / netbanking) |
| > ₹50,000 | **Per-invoice virtual account (NEFT/RTGS)** shown first, Payment Link secondary |

A 2% MDR on a ₹3,00,000 hotel invoice is ₹6,000. And from **15 Oct 2026** UPI P2M carries 0.4%
MDR (capped ₹300) above ₹2,000, so UPI is no longer the free rail either.
**Confirm the "small merchant" zero-MDR definition with the Razorpay RM** — it may still apply.

### Operate
- Verify `X-Razorpay-Signature` on the **raw** body.
- Idempotent on `payment.id`.
- **An invoice is marked paid only from a verified webhook — never from a browser redirect.**

---

## 6. MSG91 (SMS, OTP only)

### Setup (Week 0–1, runs in parallel)
1. **TRAI DLT Principal Entity registration** — PAN, GST, incorporation proof, signatory KYC,
   authorisation letter. ~₹5,900 incl. GST. **Biometric authentication required since Feb 2025.**
2. Register the 6-character header (~₹590/yr).
3. Register content templates (free) — only ~3 are needed: `approval_otp_sms`, `login_otp_sms`,
   `survey_booked_sms`.
4. PE–TM binding with MSG91.
5. **Whitelist reduxbath.com** as the URL domain. Public shorteners (bit.ly, tinyurl) are
   **silently blocked**.
6. Wire into Supabase **Send SMS Hook** (an Edge Function calling MSG91) — provider-agnostic and
   avoids depending on dashboard provider support.

**Why SMS is OTP-only:** WhatsApp is outside DLT entirely. Keeping SMS to OTP means 3 templates
instead of 20, and avoids the 10:00–21:00 promotional window where out-of-window messages are
**dropped, not queued**.

---

## 7. Integration health

`integration_accounts.last_event_at` is stamped on every inbound event. The
`integration_health` cron (every 30 min) alerts Super Admin if any source is silent >6 hours.

Surfaced at `/admin/integrations`:

| Source | Last event | Status |
|---|---|---|
| Meta lead ads | 4 min ago | ✅ |
| WhatsApp | 12 min ago | ✅ |
| Google Ads | 6 h 20 min ago | ⚠ |
| Razorpay | 2 h ago | ✅ |

**Silence is the dangerous failure.** A broken integration does not throw an error — leads simply
stop arriving, and nobody notices for a week. This screen exists for that reason.

---

## 8. Environment variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-only, never in a client bundle

# Meta / WhatsApp
META_APP_ID=
META_APP_SECRET=
META_SYSTEM_USER_TOKEN=
META_PAGE_ID=
META_WEBHOOK_VERIFY_TOKEN=
META_GRAPH_VERSION=v25.0
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
META_CAPI_DATASET_ID=

# Google Ads
GOOGLE_ADS_WEBHOOK_KEY=

# Razorpay
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

# MSG91
MSG91_AUTH_KEY=
MSG91_SENDER_ID=
MSG91_DLT_TE_ID=

# Infra
GOTENBERG_URL=http://gotenberg:3000
CRON_SECRET=
SENTRY_DSN=
NEXT_PUBLIC_SITE_URL=https://reduxbath.com
NEXT_PUBLIC_APP_URL=https://app.reduxbath.com
NEXT_PUBLIC_PORTAL_URL=https://my.reduxbath.com
```

A copy lives at `../.env.example`.
