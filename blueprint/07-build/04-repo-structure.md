# 04 — Repository Structure

Two repositories. Scaffold both in Step 0 even though the mobile app is not built until Phase 2 —
it keeps the shared validators honest from the start.

---

## `redux-platform`

```
redux-platform/
├── app/
│   ├── (marketing)/                 # reduxbath.com — cacheComponents: true
│   │   ├── page.tsx                 # A1 Home
│   │   ├── hotels/ homes/ dealers/
│   │   ├── services/[slug]/
│   │   ├── work/ work/[slug]/
│   │   ├── process/ why-redux/ contact/
│   │   ├── terms/ privacy/ refunds/        # gate Razorpay KYC
│   │   ├── book-assessment/ dealer-enquiry/ thank-you/
│   │   ├── sitemap.ts  robots.ts
│   │   └── layout.tsx
│   ├── (app)/                       # app.reduxbath.com — staff
│   │   ├── leads/ leads/mine/ leads/[id]/ leads/board/ leads/new/
│   │   ├── inbox/ follow-ups/ calls/
│   │   ├── surveys/ surveys/[id]/
│   │   ├── quotes/ quotes/[id]/ quotes/[id]/preview/
│   │   ├── jobs/ jobs/[id]/ jobs/[id]/board/ jobs/[id]/handover/
│   │   ├── service-requests/
│   │   ├── admin/                   # dashboard, rate-card, masters, users,
│   │   │                            # assignment, stock, invoices, payments,
│   │   │                            # notifications, reports, audit, privacy,
│   │   │                            # integrations, discounts
│   │   ├── me/ me/stats/
│   │   └── layout.tsx
│   ├── (portal)/                    # my.reduxbath.com — customers
│   │   ├── page.tsx  jobs/[id]/  fittings/  quotes/[id]/
│   │   ├── invoices/ warranty/ service-requests/ privacy/
│   │   └── layout.tsx
│   ├── api/
│   │   ├── webhooks/{meta,whatsapp,google-ads,razorpay}/route.ts
│   │   ├── mobile/{bootstrap,visits,checkin,fittings,assessments,photos,surveys,quotes}/
│   │   ├── cron/{meta-reconcile,sla-sweep,job-delays,stock-alerts,
│   │   │         integration-health,retention-purge,quote-expiry,weekly-report}/
│   │   └── public/{enquiry,otp}/
│   ├── login/ layout.tsx not-found.tsx error.tsx
├── proxy.ts                         # NOT middleware.ts (Next 16)
├── components/
│   ├── ui/                          # shadcn primitives
│   ├── patterns/                    # DataTable, Timeline, StageTracker, PhotoGrid,
│   │                                # BeforeAfter, EmptyState, StatusPill, MoneyText
│   ├── features/{leads,surveys,quotes,jobs,invoices,stock,admin}/
│   └── marketing/
├── lib/
│   ├── supabase/{server,client,admin}.ts    # admin.ts starts with import 'server-only'
│   ├── actions/{leads,surveys,quotes,jobs,invoices,stock,admin,privacy}.ts
│   ├── validators/                  # Zod — shared with the mobile app
│   ├── services/                    # PURE business logic, no framework imports
│   │   ├── pricing.ts assessment.ts quotation.ts invoice.ts gst.ts
│   │   ├── lead-dedup.ts assignment.ts sla.ts downtime.ts
│   │   ├── otp.ts consent.ts money.ts
│   ├── integrations/{meta,whatsapp,google-ads,razorpay,msg91,capi}.ts
│   ├── queue/{enqueue,worker,handlers}.ts
│   ├── pdf/{gotenberg,templates}.ts
│   └── utils/{format,date,phone,storage}.ts
├── supabase/
│   ├── migrations/                  # numbered, forward-only
│   ├── seed.sql                     # idempotent
│   └── tests/                       # RLS + permission tests (blocking in CI)
├── types/database.ts                # generated, committed
├── worker/                          # queue worker entrypoint (separate container)
├── docker/{Dockerfile,Dockerfile.worker,gotenberg/Dockerfile}
├── tests/{unit,integration,e2e}/
└── blueprint/                       # ← THIS FOLDER, checked in
```

**`blueprint/` lives in the repo.** The specification travels with the code, stays in review, and
gets updated to as-built at handover. A spec in someone's Drive is a spec nobody reads.

---

## `redux-surveyor-app`

```
redux-surveyor-app/
├── app/                             # expo-router
│   ├── (auth)/login.tsx
│   ├── (onboarding)/{permissions,battery}.tsx    # C2 — ships in build 1
│   ├── (tabs)/{index,sync,profile}.tsx
│   ├── visit/[id]/{index,checkin}.tsx
│   ├── unit/[id]/index.tsx
│   ├── fitting/[id]/{index,photos,assessment}.tsx
│   ├── quote/[surveyId].tsx
│   └── handover/[unitId].tsx
├── src/
│   ├── db/
│   │   ├── schema.ts                # local SQLite
│   │   ├── migrations/              # the outbox must survive an app update
│   │   ├── outbox.ts                # ← the core of the app
│   │   └── attachments.ts
│   ├── sync/{drain,uploader,reconciler,bootstrap}.ts
│   ├── camera/{capture,compress,stamp}.ts
│   ├── api/client.ts
│   ├── components/
│   ├── services/                    # shared pure logic with the web app
│   └── hooks/
├── app.json  eas.json               # targetSdk 36, dataSync FGS
└── assets/
```

**`src/db/outbox.ts` is the most important file in the mobile repo.** Everything writes through
it. Review it more carefully than anything else.

---

## Shared code

`lib/validators/` (Zod) and `lib/services/` are duplicated into the mobile app as a copied
package rather than a workspace dependency. One shared file is not worth monorepo tooling — but
pricing logic **must** be identical on both sides, so the copy is scripted and checked in CI,
not done by hand.

---

## Key files

| File | Why it matters |
|---|---|
| `blueprint/` | The spec, in the repo |
| `CLAUDE.md` | How an AI agent works in this codebase |
| `supabase/migrations/` | The only way the schema changes |
| `supabase/tests/` | The permission tests — blocking |
| `lib/supabase/admin.ts` | Service role. `import 'server-only'` on line 1 |
| `lib/services/` | Every business rule, unit-testable |
| `proxy.ts` | Route protection (renamed from middleware in Next 16) |
| `src/db/outbox.ts` | The no-photo-lost guarantee |
| `docker/gotenberg/Dockerfile` | Where Noto Sans gets baked in for ₹ |
