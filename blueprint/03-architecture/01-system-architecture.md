# 01 — System Architecture

---

## 1. The picture

```
                    ┌──────────────────── Cloudflare ────────────────────┐
                    │                                                    │
   reduxbath.com ───┤                                                    │
   my.reduxbath.com ┤            Mumbai / Bangalore VPS                  │
   app.reduxbath.com┤   ┌────────────────────────────────────────────┐   │
                    │   │  Docker (Coolify)                          │   │
                    │   │  ┌──────────────┐  ┌────────┐  ┌────────┐  │   │
                    │   │  │ Next.js 16.3 │  │Gotenberg│ │ Queue  │  │   │
                    │   │  │  standalone  │  │  PDF    │ │ worker │  │   │
                    │   │  └──────┬───────┘  └────┬───┘  └───┬────┘  │   │
                    │   └─────────┼───────────────┼──────────┼───────┘   │
                    └─────────────┼───────────────┼──────────┼───────────┘
                                  │               │          │
                                  ▼               ▼          ▼
                    ┌──────────────────────────────────────────────────┐
                    │      Supabase Cloud — ap-south-1 (Mumbai)        │
                    │  Postgres · Auth · Storage · Realtime · pgmq     │
                    │  · pg_cron                                       │
                    └──────────────────────────────────────────────────┘
                                  ▲                        ▲
                                  │                        │
          ┌───────────────────────┘                        └────────────┐
          │                                                             │
 ┌────────┴─────────┐                                        ┌──────────┴─────────┐
 │  Surveyor app    │                                        │  External systems  │
 │  Expo / Android  │                                        │  Meta Graph v25    │
 │  expo-sqlite     │  photos → Supabase Storage direct      │  WhatsApp Cloud API│
 │  outbox queue    │  (never through the app host)          │  Google Ads webhook│
 └──────────────────┘                                        │  Razorpay          │
                                                             │  MSG91 (OTP SMS)   │
                                                             └────────────────────┘
```

**Two hard rules visible in that diagram:**
1. **Photos never travel through the app host.** Upload direct to Supabase Storage, serve via
   signed URLs. This is the difference between a ₹9,000/month bill and a ₹40,000/month one.
2. **External systems talk to Route Handlers, which do nothing but verify, persist and ack.**
   All real work happens in the queue worker.

---

## 2. Deployment units

| Unit | What it is | Where |
|---|---|---|
| **Web app** | Next.js 16.3, `output: 'standalone'`, one codebase serving the marketing site, CRM, admin and customer portal on three hostnames | VPS, Docker |
| **Gotenberg** | Headless Chromium HTML→PDF, with **Noto Sans baked in for the ₹ glyph** | VPS, Docker sidecar, not publicly exposed |
| **Queue worker** | Small Node process: drains pgmq, calls Graph API, sends WhatsApp, renders PDFs, runs reconciliation | VPS, Docker |
| **Database + Auth + Storage** | Supabase Cloud Pro, ap-south-1 | Managed |
| **Surveyor app** | Expo SDK 57, Android, Play Store internal/closed track, EAS Update for hot fixes | Device |

Three hostnames, one app:
- `reduxbath.com` — public marketing site (the only place `cacheComponents` is on)
- `app.reduxbath.com` — staff: CRM, care portal, surveys, quotes, jobs, admin
- `my.reduxbath.com` — customer portal

---

## 3. Request paths

### 3.1 A page load (staff)
Cloudflare → Next.js → Supabase with the user's JWT → **RLS enforces the role** → render.
No "if user.role === 'admin'" in a component decides data access; the database does.

### 3.2 A webhook (Meta / WhatsApp / Google Ads / Razorpay)
```
Provider → Cloudflare → Route Handler
   1. read raw body (await req.text())
   2. verify signature (timing-safe)  ← Meta: X-Hub-Signature-256
                                        Razorpay: X-Razorpay-Signature
                                        Google Ads: google_key equality
   3. INSERT INTO webhook_events (source, external_id, payload)
      ON CONFLICT (source, external_id) DO NOTHING
   4. enqueue pgmq message
   5. return 200            ← target < 200 ms
```
Then, asynchronously: worker claims with `FOR UPDATE SKIP LOCKED` → calls Graph API for the PII →
upserts `leads` → stamps `processed_at`. Retries with backoff, dead-letters after N with an admin alert.

**Why this shape:** Meta disables a subscription after sustained failures, and **Google Ads does not
retry a 4XX at all** — a 4XX on a transient DB error loses the lead permanently.

### 3.3 A surveyor photo
```
Camera → compress at capture (1600px q0.72) → write to app-private dir
      → INSERT attachments row IN THE SAME SQLITE TRANSACTION as the fitting
      → outbox drain → direct PUT to https://<ref>.storage.supabase.co
         path: surveys/{survey_id}/{fitting_id}/{slot}/{sha256}.jpg
         upsert: false   → HTTP 409 is treated as SUCCESS (idempotent retry)
      → confirm remote existence → only then delete the local file
```

### 3.4 A quotation PDF
```
Server Action → render /quotes/[id]/preview as HTML (same markup as the on-screen quote)
             → POST to Gotenberg → PDF
             → SHA-256 the bytes → store hash on the quotation
             → upload to Storage → signed URL → WhatsApp document message
```
The on-screen quote and the PDF are the same markup, so they can never drift.

---

## 4. Data flow: lead → job → invoice

```
webhook_events ──worker──▶ leads ──survey booked──▶ surveys ──▶ fittings ──▶ fitting_photos
                             │                                      │
                             │                                      ▼
                             │                                 assessments
                             │                                      │
                             │                                      ▼
                             └────────── OTP approval ◀───── quotations ── quotation_lines
                                              │                         (rate_card_version_id
                                              │                          frozen per line)
                                              ▼
                                  customers + properties + jobs
                                              │
                                    ┌─────────┴─────────┐
                                    ▼                   ▼
                              job_units            job_batches
                                    │
                            job_stage_events
                                    │
                                    ▼
                               handovers ──▶ warranties
                                    │
                                    ▼
                                invoices ──▶ payments
```

**The immutability spine.** Four things are never edited after the fact, because a customer
relationship or a tax authority depends on them:
`quotations` (superseded, not edited) · `quote_approvals` (append-only) ·
`invoices` (credit-noted, not deleted) · `fitting_photos` (added, not overwritten).

---

## 5. Background jobs

pgmq queues + pg_cron schedules, worked by the Node worker (ADR-009).

| Queue | Work |
|---|---|
| `q_webhooks` | Process webhook events, call Graph API, normalise into `leads` |
| `q_notifications` | Send WhatsApp / SMS / email with retry and dedup key |
| `q_documents` | Render quotation and invoice PDFs |
| `q_capi` | Fire Meta conversion events (`survey_booked`, `job_won`) |
| `q_reports` | Generate scheduled reports and exports |

| Schedule (pg_cron) | Frequency | Why |
|---|---|---|
| `meta_lead_reconcile` | **every 15 min** | Meta deletes leads after 90 days — a webhook gap is permanent loss |
| `sla_sweep` | every 5 min | Call-back timers, follow-ups due |
| `job_delay_sweep` | hourly | Units past planned downtime and not blocked |
| `stock_alert_sweep` | hourly | Below-minimum crossings |
| `integration_health` | every 30 min | Alert if a source has been silent >6 h |
| `retention_purge` | daily 02:00 IST | Call recordings >90 days; archived photos; erasure requests |
| `quote_expiry` | daily 09:00 IST | Expiring-in-3-days notices; mark expired |
| `weekly_report` | Mon 08:00 IST | Email summary to Super Admin |

**Transactional enqueue.** A notification is enqueued in the **same transaction** as the state
change that triggers it. There is no window where a quote is approved but the confirmation was
never queued.

---

## 6. Environments

| Env | Purpose | Database | Notes |
|---|---|---|---|
| **Local** | Development | Hosted staging project — no local Docker (ADR-013) | Fixtures in `supabase/seed.sql` run only in CI |
| **Staging** | UAT, client demos | Separate Supabase project | **Meta test numbers, Razorpay test mode, no real customer data** |
| **Production** | Live | Supabase Pro ap-south-1 | PITR backups on |

Migrations are **forward-only, checked into git**, applied via Supabase CLI in CI. No manual
changes in the dashboard — ever. A schema change made by hand in production is the single
easiest way to lose a weekend.

---

## 7. Observability

| Concern | Tool | What triggers a human |
|---|---|---|
| App errors | Sentry | New error type, or error rate >1% of requests |
| Webhook health | `integration_health` screen + cron | Any source silent >6 h |
| Queue depth | pgmq metrics | Depth >500 or oldest message >15 min |
| Dead letters | `webhook_events.status = 'dead'` | Any row, immediately |
| Unsynced surveyor data | Query on `surveys` | Any survey with pending attachments >24 h |
| Uptime | Cloudflare / UptimeRobot | 2 consecutive failures |
| DB | Supabase dashboard | Connection saturation, slow query log |

**The alert that matters most:** unsynced surveyor data. It is the only failure mode where the
work is genuinely irreplaceable — nobody is re-visiting a hotel to re-photograph 200 fittings.

---

## 8. Security posture

| Layer | Control |
|---|---|
| Transport | TLS everywhere; HSTS; Cloudflare proxy |
| Auth | Supabase Auth; staff = email+password with strong policy; customers = OTP |
| Authorisation | RLS on every table, role from a JWT claim (ADR-004) |
| Secrets | Environment variables on the VPS; **service-role key server-only**, never in a client bundle (build check) |
| Storage | Private buckets; signed URLs 5–15 min; RLS on `storage.objects` |
| Webhooks | Signature verification on raw body, timing-safe compare |
| PII | Encrypted at rest (Supabase default); call recordings 90-day retention; photo access logged |
| Audit | `audit_log` on every privileged action |
| Rate limiting | Cloudflare on public forms; app-level on OTP endpoints |

---

## 9. What this architecture deliberately does NOT do

| Not doing | Why |
|---|---|
| Microservices | One team, one deploy. Splitting this into services would add failure modes and no capability |
| Kubernetes | A 4 vCPU VPS running three containers does not need an orchestrator |
| GraphQL | REST route handlers + Supabase client cover it; a schema layer would be ceremony |
| Event sourcing | `audit_log` + immutable quotes/invoices give the auditability without the complexity |
| A separate mobile backend | The surveyor app talks to Supabase directly with RLS; there is no second API to keep in sync |
| Redis | pgmq removes the reason to add it |
| A sync engine | ADR-006 |
