# 03 — Google Ads Lead Forms + Payments

Verified 26 Sep 2026.

---

## 1. Google Ads lead form assets → CRM

### Mechanism
In the lead form asset: *Export leads from Google Ads → Other data integration options* → set a
**Webhook URL** and a **Webhook key** (a secret you choose). Google POSTs JSON per lead in
near-real-time. **No Google Ads API, no OAuth, no developer token needed** — the API is an
alternative polling path, not a requirement.

### Payload fields
```
lead_id            — dedup key
api_version
form_id
campaign_id, adgroup_id, creative_id, asset_group_id (PMax)
user_column_data[] — { column_id, column_name, string_value }
google_key         — must equal our configured key
gcl_id
is_test            — drop or tag these
lead_stage         — funnel position (newer field)
lead_submit_time   — ISO-8601
lead_source        — "LEAD_FORM" | "CONVERSATIONAL_AGENT"
```

`lead_source: CONVERSATIONAL_AGENT` (AI-agent-generated leads) and `lead_stage` are 2026 additions.
No deprecation of lead form assets found.

### The contract we must honour
| Rule | Why it matters |
|---|---|
| Validate `google_key` (constant-time compare) | Anyone can POST to the URL otherwise |
| Return **HTTP 200 with body `{}`** | Exact body is part of the contract |
| **4XX is never retried — the lead is lost** | So never 4XX on a transient DB error. Write raw to staging, return 200, process async |
| 5XX is retried | Our fallback if the DB is genuinely down |
| Ignore unknown fields | Google adds optional fields without notice |
| Dedup on `lead_id` | Unique index |
| Drop or tag `is_test: true` | Keeps the pipeline clean |

Use Google's **"Send test data"** button to verify before any campaign launches.

**What we build.** `app/api/webhooks/google-ads-leads/route.ts` → key check → insert into
`webhook_events` → `200 {}` → async mapper into `leads`.

---

## 2. Payments

### ⚠ The biggest change since May 2026 — UPI is no longer free for large invoices

From **15 October 2026**, NPCI introduces **MDR of 0.4% on P2M UPI transactions above ₹2,000**,
capped at **₹300** (reached at ₹75,000). P2P stays free; P2M ≤ ₹2,000 stays zero-MDR;
"eligible small merchants" retain zero MDR — **the turnover definition of *small merchant* is
UNVERIFIED; confirm with the Razorpay relationship manager before pricing this to REDUX.**
Essential services flat ₹5; capital markets 0.02%.

**UNVERIFIED:** no NPCI circular number was located — this is from secondary reporting.
Get the circular from the gateway before repricing.

### Gateway comparison (published rates, before negotiation)

| | **Razorpay** | Cashfree | PhonePe PG |
|---|---|---|---|
| Standard rate | **2% + GST** all modes | ~1.95% platform fee; wallets/pay-later 2.50% | ~1.99%, promo 0% limited period |
| Setup | ₹0 | ₹0 | ₹0 |
| **AMC** | **₹0** | **₹4,999/yr** | UNVERIFIED |
| Settlement | T+2 standard (instant/T+1 extra) | T+1 on current offer | UNVERIFIED |
| Links / Pages | Included | Included | Included |
| Intro offer | 0% platform fee first 90 days | 0% MDR up to ₹20 L | 0% limited period |

Per-mode MDR for Cashfree and PhonePe is **UNVERIFIED** — both publish "as per applicable law"
for UPI and withhold card rates publicly. Assume ~2% and negotiate.

### The architectural decision that saves the most money

**Use per-invoice NEFT/RTGS virtual accounts (Razorpay Smart Collect) for hotel invoices.**

| Invoice | Card/UPI at ~2% | Virtual account |
|---|---|---|
| ₹15,000 homeowner | ₹300 | overkill |
| ₹75,000 hotel | ₹1,500 | small flat fee |
| ₹3,00,000 hotel | **₹6,000** | small flat fee |

A hotel's accounts department is going to pay by NEFT anyway. A virtual account makes that
**auto-reconcile via webhook** instead of someone matching UTR numbers in a spreadsheet.

**Rule we implement:** invoice ≤ ₹50,000 → Payment Link (UPI/card/netbanking).
Invoice > ₹50,000 → virtual account shown first, Payment Link offered as secondary.

### Decision: Razorpay
₹0 AMC (Cashfree's ₹4,999 is a real cost at this volume), the most mature Payment Links +
Smart Collect combination, best-documented webhooks and refunds, and Payment Links need zero
checkout integration — attach a link to the GST invoice and the hotel pays.

Use **Payment Links per invoice**. Not Payment Pages (generic storefronts). Not full checkout
(we are collecting invoices, not running a cart).

### KYC — build these pages early, they gate approval
PAN of the entity, Certificate of Incorporation / partnership deed, GST certificate, bank proof
(cancelled cheque or statement), authorised signatory PAN + Aadhaar, business address proof, and
a website URL with **live Terms, Privacy Policy, Refund/Cancellation policy and Contact pages**.

**Those four pages must be live before KYC is approved** — so they are Phase 1 website scope,
not an afterthought. Listed as D1 sub-pages in `../02-product/03-screen-inventory.md`.

### Webhooks and refunds — what we build
- Verify `X-Razorpay-Signature` = HMAC-SHA256 of the **raw** body with the webhook secret.
  Read the raw body before JSON parsing.
- Subscribe: `payment.captured`, `payment.failed`, `refund.processed`, `settlement.processed`.
- Idempotency on `payment.id`.
- **Never mark an invoice paid from the browser redirect — only from the verified webhook.**
- Refunds via API with our own `receipt` id stored against the invoice.

---

## Sources
- Google Ads Lead Form Webhook — Implementation · developers.google.com/google-ads/webhook/docs/implementation (26 Sep 2026)
- Google Ads Help — Set up a webhook integration for a lead form · support.google.com/google-ads/answer/16729613
- Google Ads Help — Best practices integrating lead form ads with your CRM · support.google.com/google-ads/answer/17051188
- Razorpay Pricing · razorpay.com/pricing/ (26 Sep 2026)
- Cashfree Pricing · cashfree.com/pricing/ (26 Sep 2026)
- Razorpay — Payment Gateway KYC Onboarding Guide India (2026)
- UPI MDR 2026 (0.4% from 15 Oct 2026) — secondary reporting, circular not located
