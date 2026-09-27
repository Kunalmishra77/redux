# 01 — Architecture Decision Records

Twelve decisions. Each one: the choice, the reasoning, what we rejected, and the trigger that
would make us revisit it. **These are binding.** Diverging from one during the build requires a
new superseding ADR, not a quiet change.

Verified against live sources 26 Sep 2026.

---

## Stack at a glance

| Layer | Choice | Version (Sep 2026) |
|---|---|---|
| Web framework | Next.js App Router | 16.3.x |
| UI runtime | React | 19.3.0 |
| Runtime | Node LTS | 24 now → 26 from Oct 2026 |
| Styling | Tailwind CSS (CSS-first `@theme`) | 4.3.x |
| Components | shadcn/ui (CLI v4, Radix base) | CLI 4.21 |
| Tables | TanStack Table | v9 (9.2.x) |
| Server state | TanStack Query | v5 |
| Forms | react-hook-form + Zod | 7.89 + 4.6.x |
| Database / Auth / Storage | Supabase Cloud, **ap-south-1 (Mumbai)** | — |
| Jobs & queues | Supabase Queues (pgmq) + pg_cron + one Node worker | — |
| App hosting | Docker on a Mumbai/Bangalore VPS (Coolify), Cloudflare in front | — |
| Mobile | Expo (React Native), Android-first | SDK 57 |
| Mobile local DB | expo-sqlite + hand-rolled outbox | 57.x |
| PDF | Gotenberg (Docker sidecar), HTML → PDF | — |
| Payments | Razorpay (Payment Links + Smart Collect) | — |
| WhatsApp | Meta Cloud API, direct (no BSP) | Graph v25.0 |
| SMS (OTP fallback) | MSG91 via Supabase Send SMS Hook | — |

---

## ADR-001 — Next.js 16.3 App Router (not Next 15, not a separate SPA + API)

**Decision.** Build the website, all three web portals and the admin on one Next.js 16.3
App Router codebase, deployed as a standalone Docker image.

**Why.** One codebase, one auth session, one set of TypeScript types shared between the CRM and
the webhook handlers. The team already works in Next.js App Router, so there is no learning tax.
Next 16.3 has Turbopack stable and by default, and Cache Components.

**Next 15 → 16 changes that will bite (build with these from day one, don't migrate later):**
- `middleware.ts` is now **`proxy.ts`** (Node runtime).
- `params`, `searchParams`, `cookies()`, `headers()`, `draftMode()` are **async only**.
- `revalidateTag()` needs a cacheLife profile: `revalidateTag('quotes', 'max')`. Use the new
  `updateTag()` for read-your-writes after a Server Action — that is what you want after a
  surveyor submits a form.
- `experimental.ppr` / `dynamicIO` are gone → `cacheComponents: true`. Caching is now opt-in.
  **For this app that is correct: leave `cacheComponents` off for the role-gated portals and
  turn it on only for the public marketing site.**
- `next lint` removed; parallel routes need an explicit `default.js` or the build fails.

**Rejected.** A separate React SPA + Nest/Express API — doubles the auth surface and the type
duplication for no gain at this size. Next 15 — we would only migrate later at higher cost.

**What would change this.** Nothing foreseeable inside this contract.

---

## ADR-002 — Supabase Cloud in ap-south-1 (Mumbai), not self-hosted Supabase

**Decision.** Supabase Cloud Pro, Mumbai region, for Postgres + Auth + Storage + Realtime + Queues.

**Why.** Self-hosting means operating GoTrue, Storage, Realtime, PgBouncer, PITR backups and
upgrades with a 4–5 person team on a fixed-price contract. The managed bill (~$25–40/month) is
smaller than one incident. Mumbai region keeps app↔DB latency in single-digit milliseconds.

**Rejected.** Self-hosted Supabase on the same VPS (false economy). Raw Postgres + custom auth
(rebuilds three months of Supabase for free). Firebase (no SQL, poor fit for a relational
quote/job/invoice model).

**What would change this.** A client data-residency requirement Supabase Cloud cannot satisfy,
or sustained costs above ~$300/month where a dedicated Postgres becomes cheaper.

---

## ADR-003 — App on a Mumbai VPS, not Vercel

**Decision.** Deploy the Next.js standalone build as Docker on a 4 vCPU / 8 GB VPS in
Mumbai or Bangalore, managed with Coolify (or Dokploy), with Cloudflare in front.
Gotenberg and the queue worker run as sidecars on the same box.

**Why.** Vercel Pro is **$20/seat/month** — a 5-person team is ~$100/month before any usage,
and the usage side (Active CPU, Provisioned Memory, Edge Requests, image-optimisation cache
writes at $4–6.40 per 1M) is where fixed-price projects lose money. A VPS is a known ₹2,000–4,000/month
and gives us somewhere to put Gotenberg and the worker for free. This is a cost-conscious agency
project with a predictable load profile, which is exactly the case where a VPS wins.

**Non-negotiable regardless of host:** survey photos are served from **Supabase Storage**, never
proxied through the app host. That is the classic bandwidth-bill mistake.

**Rejected.** Vercel (right product, wrong buyer for this project — but a legitimate switch if
REDUX ever wants zero-ops). Hetzner (no India region; 150–250 ms RTT).

**What would change this.** REDUX taking over hosting and wanting no ops burden at all → Vercel Pro.

---

## ADR-004 — Roles in the JWT via a Custom Access Token Hook, plus a permissions table

**Decision.** A `user_roles` table with an `app_role` enum, surfaced into the JWT as `user_role`
by a Supabase **Custom Access Token Hook**, with a `role_permissions` table and a
`SECURITY DEFINER` `authorize()` helper for fine-grained checks.

**Why.** RLS policies read the role from the JWT claim instead of joining a table on every row.
Supabase's own benchmarks on this pattern:

| Mistake | Cost |
|---|---|
| `auth.uid()` not wrapped in `(select …)` | 179 ms → 9 ms when wrapped |
| Policy column not indexed | ~100× slower on large tables |
| Policy missing `TO authenticated` | 170 ms → <0.1 ms when added |
| Join-table lookup per row instead of a SECURITY DEFINER helper | 178,000 ms → 12 ms |

**Four rules every policy in this project must follow** (enforced in review, see
`../07-build/03-definition-of-done.md`):
1. Wrap `auth.uid()` / `auth.jwt()` in `(select …)`.
2. Index every column a policy filters on.
3. Always specify `TO authenticated`.
4. Still filter in the client query — RLS is a guard, not a query planner.

**Rejected.** Role stored only in a table and joined in every policy (the 178-second case above).
Role in `user_metadata` — user-writable, therefore a privilege-escalation hole.

**What would change this.** Nothing; this is Supabase's documented recommendation.

---

## ADR-005 — Expo (React Native), Android-first, for the surveyor app

**Decision.** Expo SDK 57, React Native, Android only, `minSdk 24` / `targetSdk 36`,
distributed via Play Store internal/closed track with EAS Update for hot fixes.

**Why.**
- Team is React-first; Flutter would be a second language for one deliverable.
- Expo SDK 56 restored **task-based transfers in `expo-file-system`** (`createUploadTask()`
  with progress and `AbortSignal`) — exactly the primitive the photo uploader needs.
- EAS Update ships Hermes bytecode diffs, so a surveyor in the field can be hot-fixed without a
  Play review. On a project with field staff this is worth a lot.
- Play Store requires **target API 36** for new apps and updates as of 31 Aug 2026 — we are
  already past that date, so we ship on 36 from the first build.

**Rejected — Flutter.** Team is React-first; offline story is no better; `workmanager` has the
identical WorkManager constraints as Expo's background task.

**Rejected — installable PWA.** Four disqualifiers, any one of which is fatal for mandatory
evidence photos:
1. Chrome Background Sync is one-shot; Periodic Background Sync needs install + engagement heuristics.
2. **Origin storage is evictable.** 60–90 MB of photo blobs in IndexedDB/OPFS on a low-storage
   budget phone can be reclaimed by the OS. For mandatory evidence photos that is unrecoverable
   data loss — the one failure mode we cannot ship.
3. `getUserMedia` capture is worse than the native camera pipeline and strips EXIF.
4. No reliable wake-on-network.

**What would change this.** REDUX issuing iPhones → add an iOS build (Expo makes this ~2 weeks
plus an Apple account), not a rewrite.

---

## ADR-006 — Hand-rolled SQLite outbox, not PowerSync or any sync engine

**Decision.** `expo-sqlite` with two local tables — `outbox` (row mutations) and `attachments`
(photos) — drained by a single worker with idempotency keys. No sync engine.

**Why.** Sync engines earn their keep when multiple clients edit shared state concurrently.
Here: **one surveyor owns their visit** (assumption B3), only one role is offline, and writes are
append-mostly. The conflict machinery is dead weight we would still have to learn, pay for and
debug. Roughly **2–3 days** of work versus **1–2 weeks** for PowerSync's sync rules, Postgres
publication and attachment adapter, plus **$49+/month forever**.

The decider: PowerSync's free tier **deactivates after one week idle**. On a client project that
gets handed over and used in bursts, that is a support call waiting to happen.

**Design.**
```
outbox(id uuid pk, table_name, op, payload_json, idem_key, attempts, next_attempt_at, status)
attachments(id, local_uri, sha256, fitting_id, slot, bytes, status, attempts)
```
Server side: one Supabase RPC per entity taking `idem_key`, with
`on conflict (idem_key) do nothing returning *`. Drain FIFO per visit, exponential backoff with
jitter, cap attempts and surface a "needs attention" screen rather than silently dropping.

**Rejected.**
- **PowerSync** — genuinely good and its attachment state machine is the one thing we hand-build.
  Documented as the escape hatch if REDUX ever wants multi-surveyor shared editing.
- **ElectricSQL** — *disqualified*: it changed direction and is now a **read-path** sync engine;
  the offline write path was dropped.
- **WatermelonDB** — last release Apr 2025, and you write the server sync anyway.
- **Legend-State Supabase plugin** — still beta (`3.0.0-beta.48`) two years on. Unacceptable on a
  fixed-scope client deliverable.
- **RxDB** — the parts we need (SQLite storage) are paid Premium; large conceptual surface.

**What would change this.** Two surveyors editing the *same fitting* concurrently. Two surveyors
on the same property is handled by partitioning on *unit*, not by buying a sync engine.

---

## ADR-007 — Meta Cloud API direct, not a BSP

**Decision.** REDUX's own Meta app and WABA, talking to the Cloud API directly. No AiSensy /
Interakt / Wati / Gupshup.

**Why.** Meta's per-message rates are **identical** through a BSP — they don't mark up Meta fees.
What a BSP sells is a shared team inbox, a campaign UI and webhook infrastructure. **We are
building the inbox and the campaign UI — that is deliverable D4.** Renting a second, disconnected
CRM for ₹12,000–₹40,000/year to duplicate our own product is backwards. We also need the raw
`referral` object for CTWA attribution, which is cleaner direct.

**Escape hatch.** If REDUX's care team needs to chat before our inbox ships in Phase 1, park them
on AiSensy for 1–2 months — **but register the number on REDUX's own WABA** so migration is free.

**What would change this.** REDUX wanting a no-code campaign builder their marketing agency
operates independently of the CRM.

---

## ADR-008 — Webhooks land in Next.js Route Handlers, work happens in a queue

**Decision.** `app/api/webhooks/{meta,whatsapp,google-ads,razorpay}/route.ts`, each:
verify signature on the **raw** body → insert into `webhook_events` → return 200 in <200 ms.
A pgmq-backed worker does the real processing.

**Why.** Meta retries on non-2xx and **disables the subscription** after sustained failures.
Google Ads does not retry a 4XX at all — a 4XX on a transient DB error means the lead is lost
forever. So the handler must do almost nothing.

**Implementation rules.**
- `export const runtime = 'nodejs'` and `export const dynamic = 'force-dynamic'`.
- Read `await req.text()` **before** JSON parsing — HMAC is over raw bytes.
- Timing-safe compare for `X-Hub-Signature-256` (Meta), `X-Razorpay-Signature` (Razorpay),
  `google_key` equality (Google Ads).
- GET handler returns `hub.challenge` when `hub.verify_token` matches (Meta and WhatsApp share
  this handshake).
- Idempotency: unique index on `(source, external_id)` — `leadgen_id`, `wamid.*`,
  `lead_id`, `payment.id`. `ON CONFLICT DO NOTHING`.
- Worker claims rows with `FOR UPDATE SKIP LOCKED`, tracks `retry_count` + `last_error`,
  dead-letters after N attempts.

**Rejected.** Supabase Edge Functions for webhooks — splits the runtime and the secrets for a
benefit (webhooks alive during app deploys) that Cloudflare + a rolling deploy already covers.

---

## ADR-009 — Supabase Queues (pgmq) + pg_cron, not Trigger.dev / Inngest / BullMQ

**Decision.** pgmq for queues, pg_cron for schedules, one small Node worker container on the VPS.

**Why.** Job state is transactional with the data it operates on — enqueue the "send quote
WhatsApp" job in the same transaction that creates the quotation, and it cannot desync. No second
dashboard, no second bill, no Redis. pgmq gives visibility timeouts, guaranteed delivery and
archival for audit.

**Rejected.** Trigger.dev / Inngest (vendor lock-in for retry UI we don't need at this scale).
BullMQ (would mean adding Redis — pgmq removes the reason).

**What would change this.** Orchestration longer than ~15 minutes with complex fan-out.

---

## ADR-010 — Gotenberg for PDFs, not @react-pdf/renderer

**Decision.** Gotenberg as a Docker sidecar. Quotations and invoices render as a normal Tailwind
HTML route, which we POST to Gotenberg for HTML→PDF.

**Why.** Full CSS fidelity — the quotation PDF and the on-screen quotation are literally the same
markup, so they can never drift. Chromium memory is isolated from the app container.

**The ₹ trap.** Bake **Noto Sans** into the Gotenberg image. Default container fonts may not carry
the ₹ glyph and it renders as an empty box — silently, on every invoice. Add a test that asserts
₹ renders.

**Audit requirement.** GST fields (GSTIN, HSN/SAC, CGST/SGST vs IGST split, place of supply,
invoice number) are stored as **columns on the invoice row**, so the PDF is a pure render of
stored values. Past invoices must reproduce byte-identically years later; never recompute from
current rates.

**Rejected.** `@react-pdf/renderer` (own layout engine, no CSS Grid parity, every font must be
registered — pick it only if we ever go fully serverless). Raw Puppeteer in the app container
(memory spikes, Chromium in the app image).

---

## ADR-011 — Razorpay, with virtual accounts for large invoices

**Decision.** Razorpay. **Payment Links** for invoices ≤ ₹50,000; **Smart Collect per-invoice
virtual accounts (NEFT/RTGS)** above that.

**Why.** Razorpay has ₹0 AMC (Cashfree charges ₹4,999/year), the most mature Payment Links +
virtual account combination, and well-documented webhooks. But the real reason is the split:

| Invoice | Card/UPI at ~2% | Virtual account |
|---|---|---|
| ₹15,000 (homeowner) | ₹300 | overkill |
| ₹3,00,000 (hotel) | **₹6,000** | small flat fee |

And from **15 Oct 2026** UPI P2M carries 0.4% MDR (capped ₹300) above ₹2,000, so UPI is no longer
the free rail for large tickets.

**Hard rule.** An invoice is marked paid **only** from a signature-verified webhook. Never from a
browser redirect.

**What would change this.** REDUX already banking with someone who bundles a gateway.

---

## ADR-012 — WhatsApp primary, SMS only for OTP fallback

**Decision.** All customer notifications over WhatsApp utility templates. SMS via MSG91
(DLT-registered) only for login OTP when the customer has no WhatsApp.

**Why.** WhatsApp is **outside TRAI DLT** — no entity ID, no header registration, no scrubbing,
no 10:00–21:00 window, no URL whitelisting. SMS needs all of it. Keeping SMS to OTP alone means
registering ~3 DLT templates instead of ~20.

**The cost rule that shapes our copy.** Utility ₹0.115 vs Marketing ₹0.8631 — **7.5×**. A template
is utility only if it is non-promotional *and* follows a user action. "Survey booked", "quote
shared", "job update" are utility. Add one upsell line and Meta reclassifies it as marketing —
since Apr 2025, `allow_category_change` is default, so it is reclassified **silently**, and repeat
misclassification now happens with no advance notice.

**Therefore:** promotional content lives in separate, clearly-marketing templates. Transactional
templates never carry an offer, a discount or a "book another service" CTA. This is a content
rule enforced in `../05-content/02-whatsapp-templates.md`.

**What would change this.** REDUX running SMS marketing campaigns → full DLT template registration.
