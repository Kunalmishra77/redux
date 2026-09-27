# 07 — DevOps & Environments

---

## 1. Repositories

```
redux-platform/          # Next.js 16.3 monorepo-lite — website, portals, admin, API
redux-surveyor-app/      # Expo SDK 57 Android app
```

Two repos, not a monorepo. They share nothing but generated Supabase types, which are published
from `redux-platform` and consumed as a file. A monorepo would add tooling for one shared file.

---

## 2. Environments

| | Local | Staging | Production |
|---|---|---|---|
| App | `next dev --turbo` | VPS (staging container) | VPS (prod container) |
| DB | Supabase local (Docker) | Supabase project `redux-staging` | Supabase Pro `redux-prod`, ap-south-1 |
| Meta | Test app + test leads | Test app | Live app |
| WhatsApp | Meta test number | Meta test number | Live WABA |
| Razorpay | Test mode | Test mode | Live |
| Data | Seeded fixtures | Seeded fixtures | Real |
| Surveyor app | Expo Go / dev build | EAS internal track | Play closed → production track |

**Staging never contains real customer data.** If a production bug needs real data to reproduce,
anonymise it into staging with a script — never copy the production database.

---

## 3. Branching & CI

```
main        → production (protected, deploy on tag)
develop     → staging (auto-deploy on merge)
feat/*      → PR into develop
hotfix/*    → PR into main, back-merged to develop
```

### CI pipeline (every PR)
1. `tsc --noEmit`
2. ESLint + Prettier (note: `next lint` was removed in Next 16 — run ESLint directly)
3. Unit tests (Vitest)
4. **Migration check** — migrations apply cleanly to a fresh database
5. **RLS check** — every public table has `relrowsecurity = true`
6. **Secret check** — no `SERVICE_ROLE` or `*_SECRET` string in any client bundle *(blocking)*
7. **₹ render check** — generate a PDF, extract text, assert `₹` and Indian digit grouping
8. Build

### CD
`develop` merge → build image → deploy to staging → smoke test.
`main` tag → build image → deploy to production → smoke test → Sentry release marker.

Rolling deploy with a health check, so webhooks survive the swap.

---

## 4. Server layout (VPS)

```
Coolify
├── redux-web         Next.js standalone        :3000   ← Cloudflare → 80/443
├── redux-worker      Node queue worker         (no ingress)
├── gotenberg         PDF service               :3001   (internal only)
└── redux-web-staging Next.js staging           :3100
```

**Sizing:** 4 vCPU / 8 GB is comfortable for the assumed load. Gotenberg is the memory spike —
cap its concurrency at 2.

**Firewall:** only 22 (key-only), 80 and 443. Gotenberg is never publicly reachable.

---

## 5. Migrations

```bash
supabase migration new add_job_batches      # create
supabase db reset                           # local: rebuild from scratch + seed
supabase db push --linked                   # staging
# production runs through CI on a tagged release, never from a laptop
```

**Rules.** Forward-only. Never edit an applied migration. Never touch the Supabase dashboard
schema editor on staging or production. Every migration applies cleanly to an empty database
(CI proves this on every PR).

---

## 6. Backups & recovery

| What | How | Tested |
|---|---|---|
| Database | Supabase PITR (Pro) | **Restore once during Phase 1 UAT** — an untested backup is a hope |
| Storage | Supabase-managed redundancy + a weekly `documents` bucket sync to object storage | Quarterly |
| Code | GitHub + a mirror | — |
| Env / secrets | Encrypted vault, shared with two people minimum | On staff change |

**Recovery targets:** RTO 4 hours, RPO 1 hour.

**The only truly unrecoverable data** is an unsynced surveyor device. Backups do not help there —
which is why `TN11` alerts on unsynced data older than 24 hours, and why offboarding blocks access
revocation until the device reports empty.

---

## 7. Monitoring & alerts

| Signal | Source | Threshold | Route |
|---|---|---|---|
| Uptime | Cloudflare / UptimeRobot | 2 consecutive failures | WhatsApp + email |
| App errors | Sentry | New type, or >1% of requests | Email |
| Queue depth | pgmq | >500, or oldest >15 min | Email |
| Dead letters | `webhook_events.status='dead'` | any | Email, immediately |
| Integration silence | `integration_health` cron | >6 h | Email |
| **Unsynced surveyor data** | query | >24 h | **Email + WhatsApp** |
| DB connections | Supabase | >80% | Email |
| Disk | VPS | >80% | Email |
| Certificate expiry | Cloudflare | 14 days | Email |

---

## 8. Mobile release

```bash
eas build --platform android --profile production
eas submit --platform android
eas update --branch production            # JS-only hot fix, no Play review
```

| Channel | Who | When |
|---|---|---|
| `development` | Devs | Continuous |
| `internal` | QA + REDUX pilot surveyor | Each sprint |
| `closed` | All REDUX surveyors | Phase 2 UAT |
| `production` | — | Phase 2 go-live |

**Play Store:** target **API 36** (required since 31 Aug 2026). Declare the `dataSync` foreground
service in Play Console → Policy → App content, or the release is blocked.

**EAS Update is for JS fixes only.** A native change (new permission, new module) needs a full
build and a Play review — plan two days for it, not two hours.

---

## 9. Runbooks

### Webhooks stopped arriving
1. `/admin/integrations` — which source, and since when?
2. Meta: is the subscription still enabled? (Sustained failures auto-disable it.) Check the TLS chain.
3. Check `webhook_events` for `signature_ok = false` — a rotated secret looks exactly like this.
4. Google Ads: check for 4XX responses in logs — those leads are gone and need manual recovery
   from the Google Ads UI.
5. Meta: run the reconciliation poll manually to close the gap.

### Photos not syncing from a device
1. Query `surveys` with pending attachments.
2. Get the surveyor on the phone — is the app open and on WiFi?
3. Check the "needs attention" screen on the device.
4. Check storage quota and Supabase Storage status.
5. **Do not reinstall the app.** The outbox lives in app storage; reinstalling destroys unsynced
   photos permanently. This is the single most damaging support mistake available.

### An invoice is wrong
1. Never edit it. Issue a `credit_note` and a corrected invoice.
2. Both PDFs are retained; the audit log shows who did what.

### Database restore
1. Put the app in maintenance mode (Cloudflare page rule).
2. Supabase PITR to the target timestamp.
3. Replay `webhook_events` since that timestamp — this is exactly why we persist raw payloads.
4. Verify invoice sequence integrity before reopening.
5. Reopen; post a summary to REDUX.

---

## 10. Handover to REDUX (D23)

At final handover REDUX receives:
- [ ] Both repositories, with admin access transferred
- [ ] Supabase project ownership
- [ ] VPS and Coolify access
- [ ] All third-party accounts in REDUX's own name — **Meta app, WABA, Razorpay, MSG91, Play
      Console.** (This is why they are created under REDUX's Business Manager from day one, not
      under ours. Retrofitting ownership is painful and sometimes impossible.)
- [ ] Encrypted secrets vault
- [ ] These blueprint documents, updated to as-built
- [ ] Role-wise user guides (D23)
- [ ] 30-day hypercare, then an agreed support arrangement
