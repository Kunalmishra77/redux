# 07 — Deployment Runbook · D22

---

## 1. Routine deploy (staging)

```bash
git checkout develop && git pull
# CI runs all gates; merge to develop auto-deploys
```
Then: smoke test the three hostnames, check Sentry for new errors, confirm the queue is draining.

---

## 2. Production deploy

```bash
git checkout main && git merge develop
git tag -a v1.2.0 -m "Phase 2: job tracking"
git push origin main --tags     # CI builds, migrates, deploys
```

### Pre-deploy (every time)
- [ ] All CI gates green on `main`
- [ ] Migrations reviewed — additive first; a destructive change is its own release
- [ ] Rollback plan written for **this** deploy
- [ ] Deploy window agreed with REDUX (never Friday evening, never during a live hotel job)
- [ ] Staging has run the same build for at least 24 hours

### Deploy
1. Announce in the team channel.
2. CI applies migrations to production Supabase.
3. New container starts; health check passes; traffic switches (rolling — webhooks stay alive).
4. Smoke test (below).
5. Tag the Sentry release.

### Smoke test (5 minutes, every deploy)
- [ ] reduxbath.com loads; a form submits and reaches the CRM
- [ ] app.reduxbath.com login works; lead list renders
- [ ] my.reduxbath.com OTP login works
- [ ] POST a signed test payload to each webhook → 200
- [ ] Queue depth is falling, not rising
- [ ] Render one PDF; **confirm ₹ displays**
- [ ] Sentry has no new error types

---

## 3. Phase go-live (the bigger version)

### T-7 days
- [ ] Feature freeze; only S1/S2 fixes
- [ ] UAT sign-off obtained
- [ ] Production data seeded: masters, rate card, users, notification rules
- [ ] Third-party production credentials in place
- [ ] Training delivered

### T-1 day
- [ ] Full smoke test on staging with production-like config
- [ ] **Backup taken and a restore verified**
- [ ] Rollback plan reviewed with the team
- [ ] REDUX told what will change and when

### T-0 (Thursday morning)
1. Maintenance page if the migration is long; otherwise rolling.
2. Migrate → deploy → smoke test.
3. **Switch third-party webhooks to production URLs.**
4. Verify a real inbound event on each integration.
5. Remove the maintenance page.
6. Watch for 2 hours: Sentry, queue depth, integration health.
7. Tell REDUX it's live and what to watch for.

### T+1 to T+5 (hypercare)
Whole team available. Daily check: error rate, queue depth, integration health, unsynced surveyor
data, and one call with REDUX.

---

## 4. Rollback

| Situation | Action |
|---|---|
| App broken, schema unchanged | Redeploy the previous image — under 5 minutes |
| App broken, additive migration | Redeploy previous image; additive schema is backward-compatible |
| App broken, destructive migration | **PITR restore + redeploy.** This is why destructive changes ship alone, in their own release |
| One integration broken | Disable that source's rule; others keep running |
| Data corruption | Maintenance mode → PITR → **replay `webhook_events`** → verify invoice sequence → reopen |

**Rollback decision rule:** if it is not fixed in 15 minutes, roll back. Debugging in production
with users on the system costs more than a reverted release.

---

## 5. Phase-specific go-live steps

### Phase 1 (10 Dec 2026)
- [ ] DNS cutover for reduxbath.com; SSL valid
- [ ] `app.` and `my.` disallowed in robots.txt
- [ ] Meta webhook switched to production; verified with a real test lead
- [ ] Google Ads webhook configured and verified with "Send test data"
- [ ] WhatsApp templates approved and firing
- [ ] Care executives have logins and have been trained
- [ ] Old lead channels (if any) redirected or closed so nothing arrives somewhere nobody watches

### Phase 2 (18 Feb 2027)
- [ ] Play Store release live; every surveyor has it installed
- [ ] **Every surveyor device has battery optimisation disabled — verified, not assumed**
- [ ] Rate card loaded and checked against REDUX's own pricing
- [ ] Warranty periods and text confirmed
- [ ] Gotenberg ₹ test green in production
- [ ] `TN11` unsynced-data alert tested by leaving a device offline

### Phase 3 (25 Mar 2027)
- [ ] Razorpay in live mode; **real ₹1 payment and refund tested**
- [ ] Virtual account routing verified above ₹50,000
- [ ] **FY2027-28 invoice series configured; reset on 1 April verified**
- [ ] GST fields verified by REDUX's CA
- [ ] Grievance officer details live
- [ ] Customer contacts imported; first logins tested

---

## 6. Incident response

| Severity | Definition | Response | Comms |
|---|---|---|---|
| **P1** | Platform down, data loss, or a security breach | Immediately, all hands | REDUX within 15 min, then hourly |
| **P2** | A core journey broken (leads not arriving, photos not syncing) | Within 1 hour | REDUX within 1 hour |
| **P3** | Feature broken, workaround exists | Next business day | Daily summary |
| **P4** | Cosmetic | Backlog | Weekly |

### P1 procedure
1. Acknowledge in the channel; one person is incident lead.
2. Stop the bleeding — roll back or disable the feature. Diagnose afterwards.
3. Tell REDUX what is broken, what is unaffected, and when the next update comes.
4. Fix, verify, monitor.
5. **Post-incident review within 48 hours** — what happened, why, what changes.

### If it is a personal-data breach
DPDP Rule 7 applies and the clock starts at discovery:
- Notify affected data principals **without delay** — nature, extent, timing, consequences,
  mitigation, what they should do, contact person.
- Notify the Board **without delay**, with a **detailed report within 72 hours**.
- Open an `incidents` record immediately — the report deadline is computed from `discovered_at`.

**Do this before the technical post-mortem.** The deadline does not wait for root cause.

---

## 7. Maintenance windows

| Type | When | Notice |
|---|---|---|
| Routine deploy | Business hours, rolling | None |
| Migration with downtime | Sun 07:00–09:00 IST | 48 hours |
| Supabase upgrade | Sun 07:00–09:00 IST | 1 week |
| Emergency | Whenever | As soon as possible |

**Never deploy during a live hotel job's handover window.** A room going back into service is the
moment the customer is looking at the portal.
