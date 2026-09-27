# 01 — Build Order

**The order things get built in, and why.** Each step is usable on its own, so progress is always
demonstrable and nothing is blocked waiting for a later layer.

**Rule:** do not start a step until the previous one is green — CI passing, tests passing, RLS
policies written. Skipping ahead in this list is how a project ends with three half-built features
and nothing shippable.

---

## Step 0 — Repo and infrastructure *(before any feature)*

1. `redux-platform` — Next.js 16.3, TypeScript strict, Tailwind v4, shadcn/ui
2. `redux-surveyor-app` — Expo SDK 57 (scaffold now, build in Phase 2)
3. Supabase projects: staging + production, **ap-south-1**
4. VPS + Coolify + Cloudflare; Gotenberg and worker containers
5. **CI gates on day one** — tsc, lint, migration check, RLS check, secret scan, ₹ render test

> **Why CI gates first:** the RLS check and the secret scan are worthless if added after 40 tables
> and 200 components exist. They must fail on the very first PR that would break them.

---

## Step 1 — Data foundation

Order inside the schema matters; each block depends on the one before.

```
enums → identity/org → masters → rate cards → leads → calls
      → customers/properties/units → surveys → fittings/photos
      → assessments → quotations → jobs → invoices → stock → integrations → privacy/audit
```

For **every** table, in the same PR as the table:
1. Migration
2. RLS enabled + policies (all four ADR-004 rules)
3. Indexes on every policy column
4. Seed data if it is a master
5. Type generation (`supabase gen types`)

Never a table without its policy. A table with RLS and no policy denies everything, which is
safe — a table with RLS *disabled* leaks everything, which is not.

---

## Step 2 — Auth and roles *(before any feature UI)*

1. Supabase Auth
2. **Custom Access Token Hook** → `user_role` in the JWT
3. `authorize()`, `current_role_is()`, `my_customer_id()`
4. Login, session, `proxy.ts` route protection
5. Role-filtered sidebar
6. **The 8 permission tests — and they must pass before anything else is built**

---

## Step 3 — Design system *(before any screen)*

Tokens in `@theme` → primitives (button, input, card, pill, table, empty state) → composed
patterns (list + detail, timeline, stage tracker, photo grid, before/after).

> **Why before screens:** building screens first means retrofitting a design system into 30
> components later, which nobody ever actually finishes.

---

## Step 4 — Phase 1 features

```
D6 admin users
  └─▶ D1 website  ──┐
                    ├─▶ D2 lead CRM ──▶ D3 integrations ──▶ D5 notifications ──▶ D4 care portal
  (forms feed CRM) ─┘
```

Within the CRM: model and RLS → list → detail → actions → board. **Build the list before the
board.** A board is a nicer view of data you must already be able to see.

---

## Step 5 — Phase 2 features

```
Expo scaffold ─▶ SQLite outbox ─▶ bootstrap sync ─▶ visits ─▶ check-in
   ─▶ fitting capture ─▶ photo pipeline ─▶ OFFLINE HARDENING (do not skip)
   ─▶ rate card (D9) ─▶ assessment (D8) ─▶ quotation (D10) ─▶ OTP approval
   ─▶ job tracking (D11) ─▶ notifications (D12)
```

**Build the outbox before the first screen.** Every screen writes through it; retrofitting an
offline queue into screens that already assume a network is a rewrite, not a refactor.

**Offline hardening is its own week.** Treating it as "polish at the end" is how photo loss ships.

---

## Step 6 — Phase 3 features

```
Customer portal (D13) ─▶ invoicing ─▶ payments
Super admin (D14) ─▶ stock (D15) ─▶ admin controls (D16) ─▶ reports (D17) ─▶ notifications (D18)
```

The dashboard comes **after** the data it reports on exists and has been used. A dashboard built
against empty tables looks fine and is wrong.

---

## Cross-cutting, built once and used everywhere

| Concern | When | Used by |
|---|---|---|
| `audit_log` + trigger | Step 1 | Everything privileged |
| Queue worker + pgmq | Step 4, before D3 | Webhooks, notifications, PDFs, reports |
| Notification engine | Step 4, before D5 | All three phases |
| PDF pipeline (Gotenberg) | Step 5, before D10 | Quotes, invoices, reports |
| Consent ledger | Step 4, with D1 forms | Everything that collects data |
| Signed-URL helper | Step 5, with photos | Photos, documents, recordings |

---

## Vertical slices, not horizontal layers

Build **one complete feature at a time**, end to end:

> ✅ "Lead list" = migration + RLS + policy tests + server action + UI + empty state + tests
> ❌ "All migrations", then "all server actions", then "all UI"

A horizontal approach means nothing works until everything works, which makes progress
unmeasurable and integration bugs arrive all at once at the end.

---

## What "done" means for a slice

1. Migration applied, RLS policy written, policy column indexed
2. Types regenerated
3. Server action or route handler with Zod validation
4. UI including loading, empty and error states
5. Business rules from `../02-product/05-business-rules.md` implemented **and tested**
6. `audit_log` writing if the action is privileged
7. Unit and integration tests passing
8. Accessibility checked
9. CI green

Full checklist: `03-definition-of-done.md`.

---

## The five things not to do

| Don't | Why |
|---|---|
| Disable RLS "temporarily to test" | It ships. It always ships |
| Build UI before the policy | You will design a screen the policy cannot support |
| Put business rules only in the UI | The mobile app and the API bypass the UI |
| Skip the empty state | Week one has no data; that is the first impression |
| Leave offline behaviour for the end | It is architecture, not polish |
