# 02 — Phase 1 Plan · Capture & Convert

**W0–W9 · 5 Oct – 11 Dec 2026 · Go-live Thu 10 Dec 2026**
**Deliverables: D1 Website · D2 Lead CRM · D3 Lead source integrations · D4 Care Executive Portal ·
D5 Notifications · D6 Admin setup**

**The goal:** by 10 December, no REDUX lead is lost, every lead knows where it came from, and a
care executive can take a lead from arrival to booked survey in one screen.

---

## W0 · Mobilisation (5–9 Oct) — paperwork, not code

This week looks slow and is the highest-leverage week in the project. Everything here is somebody
else's approval queue.

| # | Task | Owner | Gate for |
|---|---|---|---|
| 0.1 | Blueprint walkthrough with REDUX; sign off **D19** | Lead + REDUX | Everything |
| 0.2 | REDUX completes Meta **Business Verification** | REDUX | Meta + WhatsApp |
| 0.3 | Create Meta app, System User, non-expiring token; assign **Leads Access** on the Page | Lead | D3 |
| 0.4 | **Submit Meta App Review** (`leads_retrieval`, `ads_management`, `pages_*`) with screencast | Lead | **D3 — the long pole** |
| 0.5 | WhatsApp number chosen, removed from the consumer app; WABA created; display name submitted | Lead + REDUX | D5 |
| 0.6 | **DLT Principal Entity registration** (biometric auth required) | REDUX | SMS fallback |
| 0.7 | **Razorpay KYC** started | REDUX | Phase 3 |
| 0.8 | Repos created; Supabase projects (staging + prod, ap-south-1); VPS + Coolify; Cloudflare | Lead | Everything |
| 0.9 | Sentry, CI pipeline, branch protection | Lead | Everything |

**Exit:** App Review submitted, DLT and KYC in flight, infrastructure reachable, D19 signed.

---

## W1–W2 · Design sprint 1 + foundation (12–23 Oct)

### Design (D20)
DS1 covers **18 website screens + 15 CRM/portal screens** (`../02-product/03-screen-inventory.md`).
Design system first, then website, then CRM. **REDUX approval by Fri 23 Oct** — development from
W3 assumes it.

### Build
| Task | Detail |
|---|---|
| Schema part 1 | Enums, identity, masters, leads, calls — from `schema.sql` §1–6 |
| Auth | Supabase Auth, **Custom Access Token Hook**, `user_roles`, `authorize()` |
| RLS | Policies for everything in part 1, all four rules (ADR-004) |
| CI gates | `tsc`, ESLint, migration check, **RLS check**, **secret check** |
| App shell | Next 16.3, Tailwind v4 `@theme` tokens, shadcn/ui, role-filtered sidebar |
| Seed | Master lists, lead sources, cities, settings, notification rules |
| **D6** | Users, roles, cities, assignment rules |

**Next 16 gotchas to get right now, not later:** `proxy.ts` (not `middleware.ts`), async
`params`/`searchParams`/`cookies()`/`headers()`, `cacheComponents` **off** for portals and **on**
only for the marketing site, explicit `default.js` in parallel routes.

---

## W3–W4 · Website (26 Oct – 6 Nov) — **D1**

| Week | Work |
|---|---|
| W3 | All 18 pages, responsive, design-system components. **Terms, Privacy, Refunds, Contact — these gate Razorpay KYC**, so they are not "later" |
| W4 | Three enquiry forms → CRM with source, campaign, UTM; consent capture against the active notice version; WhatsApp button; SEO, sitemap, schema.org; Core Web Vitals |

**D1 accepted when:** the site is live and every form submission reaches the CRM with its source.

---

## W4–W6 · Lead CRM + integrations (2–20 Nov) — **D2, D3**

⚠ **W5 (9–13 Nov) is Diwali week — plan for reduced capacity.**

### W4–W5 — CRM core (D2)
Lead list with filters · **My leads** SLA-sorted queue · lead detail with timeline · pipeline board ·
manual lead entry · **phone-based dedup creating `lead_touches`** · auto-assignment by city then
round-robin · SLA timer from creation · lost reasons.

### W5–W6 — integrations (D3)
| Source | Work |
|---|---|
| Website + dealer | Server actions (done in W4) |
| **Meta lead ads** | `leadgen` webhook, retrieval, `lead_form_field_map`, **15-min reconciliation poll** |
| WhatsApp chats | `messages` webhook, `referral` → `ctwa_clid` |
| WhatsApp campaigns | Outbound template + inbound attribution |
| **Google Ads** | Webhook with `google_key`; **200 `{}` always** — a 4XX loses the lead forever |
| Calls / walk-ins | Manual entry |
| All | `webhook_events` idempotency, pgmq worker, dead-letter alerts, `/admin/integrations` health screen |
| CAPI | `survey_booked` and `job_won` events wired (the second fires from Phase 2) |

**If Meta App Review has not cleared by W6:** ship the other six sources, keep the Meta handler
behind a flag, and turn it on the day approval lands. Do not let one approval queue hold the phase.

---

## W6–W7 · Notifications + Care Executive Portal (16–27 Nov) — **D4, D5**

**Templates submitted to Meta in W4** — approval takes days and rejections happen. Four are needed
for go-live: `enquiry_received`, `survey_booked`, `approval_otp`, `login_otp`.

| Area | Work |
|---|---|
| Notifications (D5) | Queue, dedup keys, quiet hours, retries; CN1, CN2, TN1–TN5; admin toggles |
| Care portal (D4) | Click-to-call + call logging · outcomes · **survey booking inline** (date, slot, nearest surveyor, no navigation) · follow-ups · WhatsApp inbox with 24-h window countdown · own stats |
| Call recording | Only if REDUX says yes (decision D-e): announcement, consent capture, 90-day retention, role-gated playback |

---

## W8 · QA (30 Nov – 4 Dec) — **D21**

| Area | Checks |
|---|---|
| Functional | Every D1–D6 acceptance criterion |
| **Security** | All 8 permission tests (`../02-product/01-roles-permissions.md`); RLS on every table; secret-scan green |
| Integrations | A real test lead from **each of the 7 sources** |
| Notifications | Every template fires on its trigger, in the right category |
| Performance | Lead list <1 s at 50k seeded leads; website CWV green |
| Accessibility | WCAG 2.2 AA on website and CRM |
| Data | Dedup, SLA timing, round-robin fairness, lost-reason enforcement |

**Backup restore is performed this week, not just enabled.** An untested backup is a hope.

---

## W9 · UAT + go-live (7–11 Dec) — **D22, D23**

| Day | Activity |
|---|---|
| Mon | REDUX UAT on staging; scripted scenarios per role |
| Tue | UAT fixes |
| Wed | Training: Super Admin + care executives. User guides handed over |
| **Thu 10 Dec** | **Production deploy.** Switch webhooks to live. Smoke test all 7 sources |
| Fri | Hypercare — whole team available |

### Go-live checklist
- [ ] All D1–D6 acceptance criteria signed by REDUX
- [ ] Security checklist (`../03-architecture/04-auth-security-rls.md` §9) complete
- [ ] DNS cut over; SSL valid; `app.` and `my.` disallowed in robots
- [ ] Live Meta webhook verified with a real test lead
- [ ] Google Ads webhook verified with "Send test data"
- [ ] WhatsApp templates approved and firing
- [ ] Care executives have logins and have completed training
- [ ] Sentry live; alert routing tested by triggering a real alert
- [ ] PITR on; a restore has actually been performed
- [ ] Rollback plan written and understood

---

## Definition of done for Phase 1

REDUX can run their whole lead operation on it:

1. A lead from any of seven sources lands in the CRM, tagged, de-duplicated and assigned, with no
   manual work.
2. The customer gets an instant WhatsApp acknowledgement.
3. A care executive can call, log the outcome and book a free survey from one screen.
4. Nobody can see a lead that isn't theirs.
5. Super Admin can see every lead, every source and every executive's performance.
6. If an integration goes quiet, someone is told within 6 hours.

Point 6 is the one people forget. **A broken integration does not throw an error — leads just stop
arriving**, and without the health screen nobody notices for a week.
