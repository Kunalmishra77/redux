# 03 — API Specification

Three kinds of server entry point. **Prefer Server Actions; use Route Handlers only where an
external system or a non-browser client needs an HTTP endpoint.**

| Kind | Used for | Auth |
|---|---|---|
| **Server Actions** | Everything the web UI does | Supabase session cookie + RLS |
| **Route Handlers** (`app/api/...`) | Webhooks, the surveyor app, cron triggers, file signing | Signature, bearer token, or cron secret |
| **Supabase RPC** (Postgres functions) | Offline writes needing idempotency, and anything transactional | Supabase JWT + RLS |

---

## 1. Webhooks — `app/api/webhooks/*`

Every one follows ADR-008: verify raw body → persist → enqueue → `200` in <200 ms.

| Route | Provider | Verification | Ack |
|---|---|---|---|
| `POST /api/webhooks/meta` | Meta Lead Ads | `X-Hub-Signature-256`, HMAC-SHA256 of raw body | `200` |
| `GET /api/webhooks/meta` | Meta handshake | `hub.verify_token` match | echo `hub.challenge` |
| `POST /api/webhooks/whatsapp` | WhatsApp Cloud API | `X-Hub-Signature-256` | `200` |
| `GET /api/webhooks/whatsapp` | WhatsApp handshake | `hub.verify_token` match | echo `hub.challenge` |
| `POST /api/webhooks/google-ads` | Google Ads lead forms | `google_key` equality, constant-time | **`200` with body `{}`** |
| `POST /api/webhooks/razorpay` | Razorpay | `X-Razorpay-Signature` | `200` |

```ts
// app/api/webhooks/meta/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const raw = await req.text()                       // RAW first — HMAC is over bytes
  if (!verifyMetaSignature(raw, req.headers.get('x-hub-signature-256'))) {
    return new Response('invalid signature', { status: 401 })
  }
  const body = JSON.parse(raw)
  for (const change of extractLeadgenChanges(body)) {
    await admin.from('webhook_events')
      .upsert({ source: 'meta_leadgen', external_id: change.leadgen_id, payload: change },
              { onConflict: 'source,external_id', ignoreDuplicates: true })
    await enqueue('q_webhooks', { source: 'meta_leadgen', external_id: change.leadgen_id })
  }
  return Response.json({ ok: true })                 // fast, always
}
```

**Google Ads is the one to be careful with:** a `4XX` is **never retried**, so the lead is gone.
Never return 4XX for a transient failure — only for a genuinely bad `google_key`.

---

## 2. Surveyor app API — `app/api/mobile/*`

Bearer token = the surveyor's Supabase JWT. All writes are **idempotent on `idem_key`** so the
offline outbox can retry safely (ADR-006).

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/mobile/bootstrap` | Master lists + settings, with an ETag so it only re-downloads when changed |
| `GET` | `/api/mobile/visits?from=&to=` | The surveyor's visits with properties and units |
| `POST` | `/api/mobile/checkin` | GPS check-in. Body: `{survey_id, lat, lng, accuracy_m, is_mocked, device_id, idem_key}` |
| `POST` | `/api/mobile/fittings` | Upsert a fitting. `idem_key` required |
| `POST` | `/api/mobile/fittings/:id/conditions` | Replace the condition flag set |
| `POST` | `/api/mobile/assessments` | Upsert the assessment; server re-prices from the active rate card |
| `POST` | `/api/mobile/photos/sign` | Returns a signed upload URL for `{fitting_id, slot, sha256}` |
| `POST` | `/api/mobile/photos/confirm` | Records the photo row after a successful upload |
| `POST` | `/api/mobile/surveys/:id/submit` | **Rejects if any photo slot is missing or unconfirmed (BR-S5/S6)** |
| `POST` | `/api/mobile/quotes` | Build a draft quotation from the survey |

**Photo upload sequence** (why it can't lose a photo):
```
1. POST /photos/sign      → { uploadUrl, path }   (path includes the sha256)
2. PUT  uploadUrl          → direct to Supabase Storage, upsert:false
                             HTTP 409 means it is already there = SUCCESS
3. POST /photos/confirm    → inserts fitting_photos row
4. app deletes the local file ONLY after step 3 returns 200
```

**Server-side guards on `/checkin`:** compute distance to `properties.lat/lng`; set `geofence_ok`
and `flagged` if beyond `settings.geofence_radius_m` (default 500 m); flag impossible travel from
the previous check-in. **Never block** — a basement with no GPS must not stop work (BR-S3).

---

## 3. Server Actions (web)

Grouped by area. Each validates with Zod, relies on RLS for authorisation, and writes `audit_log`
where the action is privileged.

### Leads
`createLead` · `updateLead` · `assignLead` · `changeLeadStatus` (requires a reason for `lost`) ·
`addLeadNote` · `createFollowUp` · `completeFollowUp` · `logCall` · `bookSurvey`

### Surveys & assessments
`scheduleSurvey` · `rescheduleSurvey` · `cancelSurvey` · `upsertAssessment` · `repriceSurvey`

### Quotations
`createQuoteFromSurvey` · `updateQuoteDraft` · `requestDiscountApproval` · `decideDiscount` ·
`issueQuote` (freezes terms, computes `valid_until`, renders the PDF, stores `pdf_sha256`) ·
`sendQuoteWhatsApp` · `requestApprovalOtp` · `verifyApprovalOtp` · `superseded quote → createQuoteVersion`

`verifyApprovalOtp` is the most important action in the system. In **one transaction** it:
1. checks the OTP hash, attempt count and expiry
2. checks the quote is `sent` and not expired (BR-Q1)
3. writes `quote_approvals` with the full evidence set
4. creates `customers`, `properties`, `jobs`, `job_units`
5. enqueues the confirmation message and the CAPI `job_won` event

If any step fails, **none of it happened** (BR-Q6).

### Jobs
`createBatches` · `assignUnitsToBatch` · `advanceStage` · `revertStage` (reason required) ·
`blockUnit` / `unblockUnit` · `recordHandover` · `generateWarranties`

### Money
`createInvoiceFromJob` · `issueInvoice` (allocates the number via `next_invoice_no`) ·
`createPaymentLink` · `createVirtualAccount` · `recordCreditNote`

### Admin
`upsertRateCardVersion` · `activateRateCard` · `importRateCardCsv` · `upsertMaster` ·
`inviteUser` · `setUserRole` · `deactivateUser` · `adjustStock` · `toggleNotificationRule`

### Privacy
`recordConsent` · `withdrawConsent` · `createDsrRequest` · `exportMyData` · `createIncident`

---

## 4. Cron endpoints — `app/api/cron/*`

Called by `pg_cron` via `net.http_post`, authorised by a `X-Cron-Secret` header.

| Route | Schedule | Job |
|---|---|---|
| `/api/cron/meta-reconcile` | **every 15 min** | Poll Meta for leads the webhook missed (90-day rule) |
| `/api/cron/sla-sweep` | every 5 min | Call-back SLAs, follow-ups due |
| `/api/cron/job-delays` | hourly | Units past planned downtime and not blocked |
| `/api/cron/stock-alerts` | hourly | Below-minimum crossings |
| `/api/cron/integration-health` | every 30 min | Any source silent >6 h |
| `/api/cron/retention-purge` | daily 02:00 IST | Recordings >90 days, archived photos, erasure requests |
| `/api/cron/quote-expiry` | daily 09:00 IST | Expiring-in-3-days notices; mark expired |
| `/api/cron/weekly-report` | Mon 08:00 IST | Email the summary to Super Admin |

---

## 5. Public endpoints — `app/api/public/*`

| Route | Purpose | Protection |
|---|---|---|
| `POST /api/public/enquiry` | Website forms (home / hotel / dealer) | Honeypot + Cloudflare rate limit; no CAPTCHA unless abuse appears |
| `POST /api/public/otp/request` | Customer portal login OTP | Rate limited per phone and per IP |
| `POST /api/public/otp/verify` | Exchange OTP for a session | Max 5 attempts, 10-minute expiry |

---

## 6. Conventions

| Concern | Rule |
|---|---|
| Validation | Zod schema on every input; inferred TS types shared with the client |
| Errors | `{ ok: false, code, message }`. `code` is a stable machine string; `message` is for humans |
| Money | Integers in paise internally where arithmetic happens; `numeric(12,2)` in the DB. **Never float** |
| Dates | ISO 8601 with offset over the wire; `timestamptz` in the DB; IST only at the display layer |
| Phones | Normalised to E.164 at every entry point, without exception |
| Idempotency | `idem_key` on mobile writes; `(source, external_id)` on webhooks; `dedup_key` on messages |
| Pagination | Cursor-based on `created_at desc, id` — never OFFSET on large tables |
| Rate limits | OTP: 3/hour/phone. Public forms: 10/hour/IP |
| Service-role key | Server-only. Never imported into a file that can reach the client bundle |
