# Demo data

The demo runs on the **staging** Supabase project with sample data. Nothing here touches production,
and nothing leaves the system: WhatsApp messages, OTPs and payments are simulated and listed in the
demo outbox (`/demo/outbox`).

## Seed

```bash
pnpm demo:seed          # needs DEMO_PASSWORD and NEXT_PUBLIC_DEMO_MODE=true in .env.local
```

Creates the demo logins, master lists, a demo rate card, demo GST identity and warranty terms, then the
story — 28 leads taken through calls, surveys with photos, three-price assessments, quotations, OTP
approvals, jobs at every stage, handovers, warranty cards, invoices and payments, stock and service
requests. Every step goes through the real database functions, so the demo obeys the business rules.

The seed refuses to run against anything but the staging project.

## Logins

| Who | Email | Role |
|---|---|---|
| Vikram Sethi | vikram@redux.demo | Super Admin |
| Priya Nair | priya@redux.demo | Care Executive (Delhi) |
| Arjun Malhotra | arjun@redux.demo | Care Executive (Gurugram) |
| Ankit Verma | ankit@redux.demo | Surveyor |
| Sunil Rawat | sunil@redux.demo | Surveyor |
| Anita Sharma (The Grand Orchid) | +91 98100 11001 | Customer portal |
| Rohit Mehra | +91 98100 11002 | Customer portal |

The password is `DEMO_PASSWORD` from `.env.local` — it is never committed (the repository is public).

## Remove

The immutability rules (invoices, approvals, photos, consent) deliberately stop row-by-row deletes, so
the demo is removed by resetting staging and re-applying the migrations:

```bash
supabase db reset --db-url "$SUPABASE_DB_URL"   # drops everything on staging, re-runs every migration
```

Then delete the `*@redux.demo` users in Supabase → Authentication, and set `NEXT_PUBLIC_DEMO_MODE=false`.
