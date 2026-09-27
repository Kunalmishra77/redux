# 02 — Coding Standards

Opinionated on purpose. Consistency matters more than any individual preference here.

---

## TypeScript

- `strict: true`. **No `any`.** Use `unknown` and narrow.
- Types from the database: `supabase gen types typescript` → `types/database.ts`. Never hand-write
  a type that mirrors a table.
- Zod schema at every boundary (forms, route handlers, mobile API); infer TS types from it.
- `type` for shapes, `interface` only for declaration merging.
- No default exports except Next's required ones (`page.tsx`, `layout.tsx`, `route.ts`).

## Next.js 16 App Router

| Rule | Note |
|---|---|
| Server Components by default | `'use client'` only where interactivity actually requires it |
| `proxy.ts`, not `middleware.ts` | Renamed in Next 16 |
| `params`, `searchParams`, `cookies()`, `headers()` are **async** | Always `await` |
| `cacheComponents: true` **only** for the marketing site | Portals are per-request by design |
| `updateTag()` after a Server Action | Read-your-writes; `revalidateTag()` needs a cacheLife profile |
| Parallel routes need `default.js` | The build fails without it |
| Server Actions over Route Handlers | Unless an external system needs HTTP |
| Never fetch in a Client Component on mount | Pass from the server, or use TanStack Query with a server-hydrated initial state |

```
app/
  (marketing)/          # reduxbath.com — cacheComponents ON
  (app)/                # app.reduxbath.com — staff
  (portal)/             # my.reduxbath.com — customers
  api/
    webhooks/ mobile/ cron/ public/
components/
  ui/                   # shadcn primitives
  patterns/             # composed: DataTable, Timeline, PhotoGrid, StageTracker
  features/<domain>/    # feature-specific
lib/
  supabase/{server,client,admin}.ts
  actions/<domain>.ts
  validators/<domain>.ts
  services/             # pure business logic, no framework imports
types/
```

## Supabase

```ts
lib/supabase/server.ts   // RLS-bound, user session — the default
lib/supabase/client.ts   // browser, anon key
lib/supabase/admin.ts    // service role — SERVER ONLY, "import 'server-only'" at the top
```

- **`admin.ts` starts with `import 'server-only'`.** Non-negotiable — it is what makes an
  accidental client import a build error instead of a breach.
- Select explicit columns. `select('*')` on a table with 30 columns is a habit that gets expensive.
- Always filter in the query even though RLS enforces it.
- All money as `numeric` — read as string, parse with a decimal library. **Never float.**

## Business logic lives in `lib/services/`

Pure functions, no framework imports, unit-testable:

```ts
// lib/services/pricing.ts
export function calculateYouSave(marketTotal: Money, quoteTotal: Money): Money {
  return max(subtract(marketTotal, quoteTotal), ZERO)   // BR-A4: never negative
}
```

Server Actions orchestrate (auth, validate, call services, persist, audit). They do not contain
the rules.

## Naming

| Thing | Convention |
|---|---|
| Files | kebab-case — `lead-list.tsx` |
| Components | PascalCase — `LeadList` |
| Functions/vars | camelCase |
| Constants | SCREAMING_SNAKE |
| DB | snake_case |
| Server actions | verb first — `createLead`, `bookSurvey` |
| Booleans | `is` / `has` / `can` |
| Event handlers | `handleX` (local), `onX` (prop) |

## Errors

```ts
type Result<T> = { ok: true; data: T } | { ok: false; code: string; message: string }
```
`code` is a stable machine string; `message` is written for the person reading it. Never surface a
raw database error to a user. Log the full error with context to Sentry.

## Comments

Comment **why**, never what. Every non-obvious rule cites its ID:

```ts
// BR-Q1: 15-day validity. Expired quotes must be re-quoted, never silently re-priced.
if (isAfter(new Date(), quote.validUntil)) return fail('QUOTE_EXPIRED')
```

## Testing

- Unit: every function in `lib/services/`
- Integration: every server action and route handler
- **Every business rule in `../02-product/05-business-rules.md` has a test that cites its ID**
- Policy tests: the 8 permission tests, blocking on every PR
- E2E: the 8 critical journeys

```ts
describe('BR-I1: invoice numbering', () => {
  it('produces no gaps under concurrent issue', async () => { /* ... */ })
})
```

## Git

```
feat(E3-S03): phone-based lead dedup into lead_touches
fix(E9-S06): block save when a photo slot is missing
chore(deps): bump next to 16.3.6
```
Type + story ID + imperative summary. Branch `feat/E3-S03-lead-dedup`.
One story per PR where possible; a PR over ~400 lines wants splitting.

### PR checklist
- [ ] Story ID in the title
- [ ] Business rules cited in comments
- [ ] RLS policy included if a table was added
- [ ] Tests added
- [ ] Empty, loading and error states present
- [ ] Nothing hardcoded that belongs in `settings` or a master list

## Mobile (Expo)

- TypeScript strict; the same Zod validators, shared as a package
- **Every write goes through the outbox.** No direct network write from a screen, ever
- Every screen renders offline
- `expo-sqlite` with a migration runner — the outbox must survive an app update
- No `expo-media-library` — it drags in media permissions we do not need
- Test on a real budget Android device, not only the emulator

## Never

| Never | Instead |
|---|---|
| `any` | `unknown` + narrow |
| Float for money | `numeric` / decimal library |
| Business rule only in the UI | `lib/services/` + a test |
| Direct DOM manipulation | React state |
| Secret in client code | Server action or route handler |
| `select('*')` on a wide table | Explicit columns |
| `console.log` in production | Sentry with context |
| Disable RLS to debug | Fix the policy |
| Hardcode a price, period or threshold | `settings` or a master list |
| Mutate a translated or approved record | Version it |
