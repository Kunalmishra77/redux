# CLAUDE.md — REDUX Platform

Project memory for Claude Code. Read this first, every session.

---

## What this project is

The **REDUX Platform** for REDUX — Bath Restorations by Eurobrass (New Delhi). Six connected
pieces: public website, lead CRM, care executive portal, offline surveyor mobile app, customer
portal, super admin. Twenty-three contracted deliverables (D1–D23) across three phases.

**The full specification is in `blueprint/`. It is decided, not advisory.**

---

## Read before you write code

| First session | Every session |
|---|---|
| `blueprint/README.md` | `blueprint/07-build/05-task-tracker.md` — current state |
| `blueprint/00-brief/02-deliverables-D1-D23.md` | `blueprint/07-build/01-build-order.md` — what's next |
| `blueprint/01-research/01-stack-decisions-adr.md` | The doc for the feature you're building |
| `blueprint/02-product/PRD.md` | |
| `blueprint/02-product/05-business-rules.md` | |
| `blueprint/03-architecture/schema.sql` | |
| `blueprint/07-build/02-coding-standards.md` | |

**Do not re-derive decisions that are already in an ADR.** If an ADR looks wrong, say so and
propose a superseding ADR — do not quietly diverge.

---

## The stack (ADR-001 to ADR-012 — decided)

Next.js 16.3 App Router · React 19.3 · Node 24→26 · Tailwind v4 (`@theme`, no config file) ·
shadcn/ui CLI v4 · TanStack Table v9 · TanStack Query v5 · react-hook-form + Zod 4 ·
**Supabase Cloud ap-south-1** · Docker on a Mumbai VPS (Coolify) · **pgmq + pg_cron** ·
**Gotenberg** for PDFs · **Expo SDK 57** Android-only for the surveyor app ·
**Razorpay** · **Meta Cloud API direct** (no BSP) · MSG91 for OTP SMS only.

### Next 16 specifics that will bite
- `proxy.ts`, **not** `middleware.ts`
- `params`, `searchParams`, `cookies()`, `headers()` are **async**
- `cacheComponents: true` **only** for `(marketing)`; portals are per-request
- `updateTag()` for read-your-writes after a Server Action
- Parallel routes need an explicit `default.js`
- `next lint` is gone — run ESLint directly

---

## Rules that are never negotiable

1. **RLS on every table, with a written policy.** A table with RLS and no policy denies — that is
   safe. A table without RLS leaks. Never disable RLS to debug.
2. **The four RLS rules (ADR-004):** wrap `auth.uid()`/`auth.jwt()` in `(select …)`; index every
   policy column; always `TO authenticated`; still filter in the client query.
3. **Service-role key is server-only.** `lib/supabase/admin.ts` starts with `import 'server-only'`.
   CI blocks any client bundle containing it.
4. **Business rules live in `lib/services/`**, cite their BR-ID in a comment, and have a test.
   The mobile app and the API do not go through the UI.
5. **Money is `numeric`, never float.** Display as `₹1,23,456` (Indian grouping), tabular numerals.
6. **Webhooks: verify raw body → persist → 200 in <200 ms.** Processing happens in the queue.
   **Google Ads must never receive a 4XX** — it does not retry, and the lead is lost forever.
7. **Every mobile write goes through the outbox.** No direct network write from a screen.
8. **Photos: local file is deleted only after remote existence is confirmed.** Nothing else in
   this system is unrecoverable; this is.
9. **Immutable:** approved quotations, `quote_approvals`, invoices, `fitting_photos`. Version or
   credit-note them; never edit or delete.
10. **Nothing is built without a D-number.** No D-number → change request.

---

## Domain vocabulary (use these exact words)

| Word | Meaning |
|---|---|
| **Free survey / assessment** | REDUX's free on-site audit. Never charged. `surveys` has no price column, deliberately |
| **Unit** | One room or bathroom. UI says "Room" for hotels, "Bathroom" for homes; the DB always says unit |
| **Fitting** | One tap, mixer, shower, diverter, aerator |
| **Photo slot** | `front` · `side` · `top` · `close_up`. All four required, always |
| **Assessment** | The per-fitting restore/repair/replace decision with **all three prices** |
| **Pilot** | A trial bathroom before a hotel approves a wider project. A real commercial stage |
| **Batch** | Rooms taken out of service together around the property's approved dates |
| **Blocked** | A unit waiting on the hotel's own civil work. **Stops the delay clock** |
| **Rate card** | Versioned price list. Editing creates a new version; old quotes never re-price |

Full glossary: `blueprint/00-brief/03-domain-glossary.md`.

---

## How to work

1. **Check `blueprint/07-build/05-task-tracker.md`** for current state and blockers.
2. **Follow `blueprint/07-build/01-build-order.md`** — do not jump ahead.
3. **Build vertical slices**: migration + RLS + policy + service + action + UI + tests, one
   feature at a time. Never all-migrations-then-all-UI.
4. **Check the Definition of Done** (`blueprint/07-build/03-definition-of-done.md`) before calling
   anything finished.
5. **Update the task tracker** — status, decisions, deviations, and a session-log line.
6. **If the blueprint is wrong, say so.** Record it under *Deviations* and update the doc.

### Commits
`feat(E3-S03): phone-based lead dedup into lead_touches` — type, story ID, imperative summary.

---

## Where things are

| Need | File |
|---|---|
| What to build next | `blueprint/07-build/01-build-order.md` |
| Full backlog with IDs | `blueprint/06-delivery/05-backlog.md` |
| Feature spec | `blueprint/02-product/PRD.md` |
| **The rules that must be exactly right** | `blueprint/02-product/05-business-rules.md` |
| Schema (validated against PG 16) | `blueprint/03-architecture/schema.sql` |
| RLS patterns and the threat model | `blueprint/03-architecture/04-auth-security-rls.md` |
| API routes and server actions | `blueprint/03-architecture/03-api-spec.md` |
| Integration setup, in order | `blueprint/03-architecture/06-integrations-runbook.md` |
| Design tokens and components | `blueprint/04-design/01-design-system.md` |
| Screen specs | `blueprint/04-design/03-05-*.md` |
| Website copy | `blueprint/05-content/01-website-copy.md` |
| WhatsApp templates | `blueprint/05-content/02-whatsapp-templates.md` |
| Dates and phases | `blueprint/06-delivery/01-master-timeline.md` |
| Why a technology was chosen | `blueprint/01-research/01-stack-decisions-adr.md` |
| What we still need from the client | `blueprint/00-brief/04-assumptions-open-questions.md` |

---

## Things that cost real money if you get them wrong

| Trap | Cost |
|---|---|
| A promotional line in a WhatsApp **utility** template | Meta silently reclassifies it as marketing — **7.5×** |
| Serving full-size photos in a list view | Egress bill goes from ₹9k to ₹40k/month |
| Collecting a large hotel invoice on a card | ~2% MDR — ₹6,000 on a ₹3,00,000 invoice. Route >₹50,000 to a virtual account |
| Missing the ₹ font in Gotenberg | Every invoice renders ₹ as an empty box, silently |
| Returning 4XX to Google Ads | That lead is gone forever — no retry |
| A Meta webhook gap over 90 days | Leads are unrecoverable. The 15-min reconciliation poll is not optional |
| Reinstalling the surveyor app with a pending outbox | Unsynced photos are destroyed permanently |

---

## What not to do

- Don't add a dependency that duplicates something already in the stack.
- Don't build an abstraction for one use case.
- Don't put a business rule only in a React component.
- Don't hardcode a price, warranty period, threshold or list — `settings` or a master table.
- Don't skip empty states. Week one has no data.
- Don't treat offline as polish. It is architecture.
- Don't mark a story done without its tests and its RLS policy.
