# 04 — Auth, Security & RLS

---

## 1. Who logs in how

| Role | Method | Session |
|---|---|---|
| `super_admin`, `cc_exec` | Email + password, strong policy, optional TOTP | 8 hours, sliding |
| `surveyor` | Email + password on the app | **Long-lived (30 days).** Field staff must never be logged out mid-visit |
| `customer` | **OTP** on the registered mobile — WhatsApp first, SMS fallback | 30 days |

OTP rules: 6 digits, 10-minute expiry, max 5 attempts, rate-limited 3/hour per phone and per IP.
Only the hash is stored, never the code.

---

## 2. How the role reaches a policy

ADR-004. `user_roles` is the source of truth; the **Custom Access Token Hook** projects it into
the JWT as `user_role` so policies read a claim instead of joining a table on every row.

```
sign in → Supabase Auth → custom_access_token_hook(event)
                             ↓
                       JWT: { sub, user_role: 'cc_exec', ... }
                             ↓
            every query carries it → RLS reads (select auth.jwt()) ->> 'user_role'
```

Register the hook in **Supabase → Authentication → Hooks → Custom Access Token**.

**Role changes take effect on the next token refresh, not instantly.** When a Super Admin changes
someone's role, also revoke their sessions — otherwise they keep the old role for up to an hour.

---

## 3. The four RLS rules (non-negotiable)

From Supabase's own benchmarks. Every policy in this project follows all four; PR review rejects
any that does not.

| # | Rule | Measured impact |
|---|---|---|
| 1 | Wrap `auth.uid()` / `auth.jwt()` in `(select …)` | 179 ms → **9 ms** |
| 2 | Index every column a policy filters on | ~**100×** on large tables |
| 3 | Always `TO authenticated` | 170 ms → **<0.1 ms** |
| 4 | Use a `SECURITY DEFINER` helper instead of a per-row join | 178,000 ms → **12 ms** |

Plus: **still filter in the client query.** RLS is a guard, not a query planner —
`.eq('assigned_to', userId)` belongs in the query even though the policy enforces it.

### Correct
```sql
create policy leads_select on leads for select to authenticated
using (
  ((select auth.jwt()) ->> 'user_role') = 'super_admin'
  or (((select auth.jwt()) ->> 'user_role') = 'cc_exec' and assigned_to = (select auth.uid()))
);
create index on leads (assigned_to);
```

### Wrong (all four mistakes)
```sql
create policy bad on leads for select                 -- no TO authenticated
using (
  auth.uid() in (                                      -- not wrapped in select
    select user_id from user_roles                     -- per-row join
    where role = 'super_admin'
  ) or assigned_to = auth.uid()                        -- and assigned_to isn't indexed
);
```

---

## 4. Tables with no policy — deliberate

`webhook_events`, `messages`, `capi_events`, `audit_log` (write path) have RLS enabled and **no
policy**, so every authenticated user is denied. They are written by the service role from server
code only. This is intentional: a bug that leaks the CRM should not also leak the raw webhook
payloads.

---

## 5. Storage

All buckets **private**. Access is by short-lived signed URL, generated in a Server Action after
the role check.

| Bucket | Path | TTL | Who |
|---|---|---|---|
| `survey-photos` | `surveys/{survey_id}/{fitting_id}/{slot}/{sha256}.jpg` | 15 min | staff; the owning customer |
| `handover-photos` | `jobs/{job_id}/{unit_id}/{sha256}.jpg` | 15 min | staff; the owning customer |
| `documents` | `quotes/{id}.pdf`, `invoices/{id}.pdf` | 15 min | staff; the owning customer |
| `call-recordings` | `calls/{call_id}.mp3` | 5 min | `super_admin`; the agent on that call |
| `signatures` | `handovers/{id}.png` | 15 min | staff |
| `brand` | logos, site assets | public | anyone |

**Rules.** List views request an explicit thumbnail width (`?width=400&quality=75`) — never
full-size; this is the difference between a ₹9,000 and a ₹40,000 monthly bill. Photos are never
proxied through the app host. Transformations bill separately, so cache the derived URL rather
than transforming on every render.

---

## 6. Secrets

| Secret | Where it lives | Never |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | VPS env, server-only modules | In any file importable by a client component |
| `META_APP_SECRET`, `META_SYSTEM_USER_TOKEN` | VPS env | In the DB, including `integration_accounts.config` |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | VPS env | — |
| `GOOGLE_ADS_WEBHOOK_KEY` | VPS env | — |
| `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | VPS env | — |
| `MSG91_AUTH_KEY` | VPS env | — |
| `CRON_SECRET` | VPS env + Supabase vault (for `net.http_post`) | — |

**Build-time check (CI, blocking):** grep the client bundle for `SERVICE_ROLE` and for any
`process.env.*_SECRET`. A match fails the build. This is BR-X2 and it is a gate, not a guideline.

`integration_accounts.config` holds non-secret configuration only — IDs, display names, toggles.

---

## 7. The OTP approval evidence set

The legal position (compliance §6): an OTP-accepted quotation is a valid e-contract under
IT Act s.10A, but OTP is **not** a Second Schedule electronic signature, so there is no s.85B
presumption of authenticity. **Our audit trail is the proof.**

`quote_approvals` captures, for every approval:

| Field | Why it matters in a dispute |
|---|---|
| `pdf_sha256` | Proves *which document* was approved, not a later edit |
| `quotation_version` | Ties the approval to one immutable version |
| `otp_hash` | Proves an OTP existed without storing the code |
| `otp_generated_at` / `delivered_at` / `verified_at` | **Server-side, NTP-synced.** Client clocks are ignored |
| `gateway_message_id`, `dlt_template_id` | Independent third-party corroboration of delivery |
| `attempt_count`, `failed_attempts` | Shows the process was not brute-forced |
| `ip_address`, `user_agent` | Links the approval to a device and session |
| `terms_text` | The exact terms on screen at the moment of approval |

Plus: **email the signed PDF and the audit trail to the customer immediately.** Contemporaneous
delivery to the other party is strong corroboration, and it costs nothing.

**Also build:** a s.65B / s.63 certificate generator — a signed statement about the computer
system that produced the record. It is a template, and having it ready beats writing it during a
dispute.

---

## 8. Threat model — what we actually defend against

| Threat | Control |
|---|---|
| Customer A reads customer B's data | RLS via `my_customer_id()`; tested per BR-X1 |
| Care executive scrapes the whole lead database | Policy limits them to `assigned_to = auth.uid()`; exports are admin-only |
| Departing surveyor keeps photos | App stores to app-private dir; no media-library permission; access revoked on deactivation |
| Forged webhook creating fake leads | HMAC / key verification on the raw body, timing-safe |
| Replayed payment webhook | Idempotent on `payment.id`; invoice paid once |
| OTP brute force | 5 attempts, 10-min expiry, per-phone and per-IP rate limits |
| Spoofed GPS check-in | `is_mocked` flag + server geofence + impossible-travel check; flagged for review, never silently trusted |
| Signed photo URL shared publicly | 15-minute TTL |
| SQL injection | Parameterised queries only; no string-built SQL anywhere |
| Insider price manipulation | `audit_log` on `rate_card_items` and `quotations`; overrides require a reason |

**Not defended against, and accepted:** a rooted device defeating client-side mock detection
(hence server-side checks), and a Super Admin abusing their own access (hence the audit log —
detection, not prevention).

---

## 9. Security checklist before each go-live

- [ ] RLS enabled on every table (`rls_disabled` count is 0)
- [ ] Every policy passes the four rules
- [ ] The eight permission tests in `../02-product/01-roles-permissions.md` pass
- [ ] No service-role key in any client bundle (CI check green)
- [ ] All buckets private; signed-URL TTLs correct
- [ ] Webhook signature verification tested with a deliberately bad signature
- [ ] OTP rate limits tested
- [ ] `audit_log` writing on rate card, quotations, invoices, user roles
- [ ] Sentry live, alert routing tested
- [ ] PITR backups on; a restore actually performed once, not just enabled
