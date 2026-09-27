# 02 — Meta Lead Ads + WhatsApp Cloud API

Verified 26 Sep 2026. Pin the Graph API to **v25.0** (released 18 Feb 2026; v26.0 expected later
in 2026).

---

## ⚠ Time-critical items

| Date | What happens | Impact on us |
|---|---|---|
| **1 Oct 2026** | Service messages become billable; **utility templates become billable inside the 24-hour customer service window** (previously free) | Notification cost model changes 5 days after this blueprint. Re-check before quoting running costs. |
| **1 Jan 2026 → 31 Dec 2026** | India INR billing localisation; all WABAs must migrate to INR by 31 Dec 2026 | Set up billing in INR from the start |
| **1 Aug 2026** | Meta Business Agent messages billed per token ($2.00/1M) | Not in scope, but don't enable it accidentally |

---

## 1. Meta Lead Ads → CRM

### Mechanism
1. Subscribe the app to the **`leadgen`** field on the Page:
   `POST /v25.0/{page-id}/subscribed_apps?subscribed_fields=leadgen`
   with a Page access token whose holder has the **ADVERTISE** task on the Page.
2. Webhook fires: `object: "page"`, `entry[].changes[].field: "leadgen"`, value containing
   `leadgen_id`, `page_id`, `form_id`, `adgroup_id`, `ad_id`, `created_time`.
   **No PII is in the webhook** — it must be fetched.
3. Retrieve: `GET /v25.0/{leadgen_id}` (or bulk `GET /v25.0/{form_id}/leads`).

### Permissions and verification
Required: `leads_retrieval`, `pages_manage_metadata`, `pages_show_list`, `pages_read_engagement`,
`ads_management` (the retrieval docs also list `pages_manage_ads`). `business_management` is **not**
required for this flow.

- **Business Verification: required.**
- **Tech Provider verification: NOT required** — that gate applies to apps accessing *other*
  businesses' data. We are building a CRM for REDUX's own Pages.
- There is **no separate "CRM integration registration"** product. Meta's CRM partner listing is
  a marketing programme, not a technical requirement.
- **Separately, in Business Suite you must assign Leads Access** (Page → Lead Access settings) to
  the system user. Without it, retrieval 403s even with correct scopes. This trips everyone.

All permissions need **Advanced Access via App Review** for production. Expect a screencast of the
working end-to-end flow and at least one rejection round. **Budget weeks. Submit in Week 0.**

### Tokens
Use a **System User token** from REDUX's Business Manager (non-expiring, survives staff turnover)
to mint the Page token. A plain Page token derived from a person's user token dies the day that
person loses their Page role — which will happen and will be blamed on us.

Rate limit for retrieval: `200 × 24 × (leads created in past 90 days)` per Page.

### The 90-day rule — design consequence
**Lead data is unretrievable by any method after 90 days.** Our database is the system of record.
A silent webhook outage lasting past 90 days is permanent, unrecoverable loss of leads REDUX paid
for.

**Therefore we build a reconciliation job** (every 15 minutes) polling
`/{form_id}/leads?filtering=[{"field":"time_created","operator":"GREATER_THAN","value":<ts>}]`
and upserting anything the webhook missed. This is not optional.

### Gotchas
- **Test leads:** only one per form at a time — delete before creating another. They arrive on the
  real webhook, so tag and drop them.
- **`is_organic`:** `1` = organic Page form, `0` = paid. The field is **absent** if the token lacks
  advertiser privileges on the ad account.
- **`field_data`** is `[{name, values[]}]`. Standard names (`full_name`, `email`, `phone_number`)
  are stable, but **custom question names are auto-slugged from the question text and change if
  the marketer edits the question.** Never hardcode: store the raw `field_data` as JSONB plus a
  per-`form_id` mapping table. Also capture `custom_disclaimer_responses` (consent evidence).
- **Duplication:** Meta redelivers on non-2xx and can send the same `leadgen_id` twice.
  Unique index on `leadgen_id`.
- **Signature:** `X-Hub-Signature-256` = HMAC-SHA256 of the **raw** body with the app secret.
- **Retries:** backoff, then subscription disabled after sustained failure. Always 200 fast.
- **UNVERIFIED:** one third-party source claims a Meta webhook CA/mTLS trust-chain change on
  31 Mar 2026 that silently killed deliveries. Not confirmed on Meta docs — but if webhooks go
  quiet with no errors, check the TLS chain first.

**Decision.** Own Meta app + System User token + `leadgen` webhook, store raw payloads, App Review
submitted Week 0, 15-minute reconciliation poll as the safety net.

---

## 2. WhatsApp Business Platform (Cloud API)

### Pricing — India, per message (since 1 Jul 2025)

| Category | INR / msg | Notes |
|---|---|---|
| Marketing | ₹0.8631 | **7.5× utility** |
| Utility | ₹0.115 | What all our transactional notifications must be |
| Authentication (domestic) | ₹0.115 | OTP |
| Authentication–International | ₹2.4971 | |
| Service (from 1 Oct 2026) | ₹0.115 | Previously free |

Plus 18% GST. **CTWA 72-hour free entry-point window remains free** and still covers marketing
templates — it starts at the *user's first message*, not the ad tap.

**UNVERIFIED:** BSPs report **1,000 free service messages per business number per month** from
1 Oct 2026, but this is absent from Meta's own pricing page. Do not promise it to REDUX.

At a few thousand messages/month this is roughly **₹500–₹3,000/month**. Messaging cost is not the
constraint — misclassification is.

### Template categories — the rule that shapes our copy
Utility = non-promotional **and** (user-requested OR essential). Our "survey booked",
"quote shared", "job update", "handover" messages **are utility**.

They flip to **marketing** the moment you add an upsell, a discount, a renewal push, or a
"book another service" CTA.

- Since **9 Apr 2025** `allow_category_change` is the default: submit as utility and Meta may
  silently approve it as marketing at 7.5× the cost.
- Since **16 Apr 2025** repeat misclassification is reclassified **with no advance notice**.

**Therefore:** transactional templates carry zero promotional content. Anything promotional gets
its own explicitly-marketing template. Enforced in `../05-content/02-whatsapp-templates.md`.

### Limits and quality
Tiers: **250 → 2,000 → 10K → 100K → unlimited**. Business verification alone unlocks 2,000.
Scaling above that is automatic within ~6 h when quality is high **and** ≥50% of the current limit
was used in the last 7 days. Quality rating is per-template and per-number; low quality pauses
templates.

### Setup checklist
- Number must not be active on the consumer WhatsApp app (delete it from the app first).
- Register via `POST /{phone_number_id}/register` with a 6-digit PIN.
- **Display name needs Meta approval** and must relate to the business — a generic
  "Bath Restoration" will be rejected. Use "REDUX Bath" or "Redux Bath Restorations".
- **Opt-in is mandatory for marketing** and must be explicit and logged: store source, timestamp
  and channel, keep ≥2 years. Our `consent_records` table covers this.
- **TRAI DLT does not apply to WhatsApp** — that is SMS/voice only.

### Inbound messages and CTWA attribution
Subscribe the WABA to the **`messages`** field. Payload: `entry[].changes[].value` with
`messaging_product: "whatsapp"`, `metadata.phone_number_id`, `contacts[]` (`wa_id`,
`profile.name`), `messages[]`, `statuses[]`.

For a Click-to-WhatsApp lead, `messages[0].referral` carries:

```
source_url, source_id (ad/post ID), source_type ("ad" | "post"),
headline, body, media_type, image_url / video_url, ctwa_clid
```

**Store `ctwa_clid`, `source_id` and the Meta `ad_id`/`form_id` on the lead row from day one.
They cannot be backfilled.**

### CAPI — the highest-ROI integration in the project
`ctwa_clid` can be posted back to Meta for conversion reporting: a WhatsApp conversions dataset
with `action_source: "business_messaging"`, `messaging_channel: "whatsapp"`,
`user_data.ctwa_clid`, `user_data.whatsapp_business_account_id`, plus `event_name` / `event_time`
(within the last 7 days) and `custom_data` (currency/value). Up to 1,000 events per request.
Meta validates and rejects fabricated CLIDs.

**Why it matters commercially:** it lets Meta optimise REDUX's ads on *booked surveys* and
*won jobs* instead of raw chats. That is the difference between an ad account that spends money
and one that makes it. We fire CAPI events at two points: `survey_booked` and `job_won`.

---

## 3. Architecture notes

- Route Handlers, not Edge Functions (see ADR-008).
- Verify → persist raw → return 200. Target <200 ms. Never process inline.
- Idempotency keys: `leadgen_id` (Meta), `messages[].id` / `wamid.*` (WhatsApp).
- Worker does the Graph API calls and normalisation, claims rows `FOR UPDATE SKIP LOCKED`.
- Webhook writes use the service-role key server-side only; RLS still guards everything else.

---

## Sources
- Meta — Webhooks for Lead Ads · developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-leadgen/ (26 Sep 2026)
- Meta — Retrieving Leads · developers.facebook.com/documentation/ads-commerce/marketing-api/guides/lead-ads/retrieving (26 Sep 2026)
- Meta — Tech Providers · developers.facebook.com/docs/development/release/tech-providers/ (26 Sep 2026)
- Meta — Graph API v25.0 changelog (18 Feb 2026)
- Meta — WhatsApp Pricing · developers.facebook.com/documentation/business-messaging/whatsapp/pricing (26 Sep 2026)
- Meta — Non-template message pricing (1 Oct 2026 changes)
- Meta — Template Categorization (26 Sep 2026)
- Meta — Messaging Limits (26 Sep 2026)
- AWS — Sending WhatsApp conversion events (CAPI, ctwa_clid) · docs.aws.amazon.com/social-messaging/latest/userguide/conversions-api.html
- CM.com — WhatsApp inbound referral fields
- Meta Business Help — Enable Leads Access · facebook.com/business/help/618808448980683

**Re-verify before go-live:** INR rate card (shifts with the INR-billing migration), the
1,000-free-service-message allowance, and whether any India marketing-template restriction applies.
