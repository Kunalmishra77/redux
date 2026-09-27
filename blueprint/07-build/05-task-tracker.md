# 05 — Task Tracker

**Claude Code: update this file as you work.** It is the running state of the build and the first
thing to read when resuming a session.

Story IDs come from `../06-delivery/05-backlog.md`.
Status: `TODO` · `WIP` · `REVIEW` · `DONE` · `BLOCKED`

---

## Current

| Field | Value |
|---|---|
| **Phase** | Phase 0 — Mobilisation |
| **Week** | W0 (5–9 Oct 2026) |
| **Sprint goal** | Accounts, approvals and infrastructure. Meta App Review submitted |
| **Last updated** | *(update this)* |

---

## Blocked — check before starting work

| ID | What | Blocked on | Since | Impact |
|---|---|---|---|---|
| — | *(none yet)* | | | |

> A blocker sits here until it is resolved. If something is blocked on REDUX, it also goes to
> `../00-brief/04-assumptions-open-questions.md` §A and gets raised at the weekly call — not
> quietly parked.

---

## Phase 0 — W0

| ID | Story | Status | Notes |
|---|---|:--:|---|
| E0-S01 | Meta Business Verification | TODO | REDUX |
| E0-S02 | Meta app + System User + Leads Access | TODO | |
| E0-S03 | **Submit Meta App Review** | TODO | **critical path** |
| E0-S04 | WhatsApp number, WABA, display name | TODO | |
| E0-S05 | DLT Principal Entity + header | TODO | REDUX, biometric |
| E0-S06 | Razorpay KYC | TODO | REDUX |
| E0-S07 | Repos, Supabase, VPS, Cloudflare | TODO | |
| E0-S08 | CI gates | TODO | RLS + secret + ₹ checks |
| E0-S09 | Sentry, uptime, alerts | TODO | |
| E0-S10 | Blueprint sign-off (D19) | TODO | |

---

## Phase 1 — W1–W9

<details><summary>E1 · Foundation (W1–W2) — 12 stories</summary>

| ID | Status | | ID | Status |
|---|:--:|---|---|:--:|
| E1-S01 | TODO | | E1-S07 | TODO |
| E1-S02 | TODO | | E1-S08 | TODO |
| E1-S03 | TODO | | E1-S09 | TODO |
| E1-S04 | TODO | | E1-S10 | TODO |
| E1-S05 | TODO | | E1-S11 | TODO |
| E1-S06 | TODO | | E1-S12 | TODO |
</details>

<details><summary>E2 · Website (W3–W4) — 16 stories</summary>

E2-S01 … E2-S16 — all `TODO`
</details>

<details><summary>E3 · Lead CRM (W4–W5) — 14 stories</summary>

E3-S01 … E3-S14 — all `TODO`
</details>

<details><summary>E4 · Integrations (W5–W6) — 12 stories</summary>

E4-S01 … E4-S12 — all `TODO`
</details>

<details><summary>E5 · Notifications (W6) — 8 stories</summary>

E5-S01 … E5-S08 — all `TODO`
</details>

<details><summary>E6 · Care portal (W7) — 9 stories</summary>

E6-S01 … E6-S09 — all `TODO`
</details>

<details><summary>E7 · QA & go-live (W8–W9) — 9 stories</summary>

E7-S01 … E7-S09 — all `TODO`
</details>

---

## Phase 2 — W10–W19

<details><summary>E8–E13 — 66 stories</summary>

E8 mobile foundation (9) · E9 survey capture (15) · E10 rate card & assessment (8) ·
E11 quotation & OTP (15) · E12 job tracking (11) · E13 QA & go-live (6) — all `TODO`
</details>

---

## Phase 3 — W20–W26

<details><summary>E14–E17 — 44 stories</summary>

E14 customer portal (18) · E15 super admin & stock (8) · E16 admin & reports (9) ·
E17 QA, go-live, handover (9) — all `TODO`
</details>

---

## Decisions made during the build

Anything decided that is not already in an ADR. If it contradicts an ADR, **write a new ADR** in
`../01-research/01-stack-decisions-adr.md` rather than diverging quietly.

| Date | Decision | Why | Story |
|---|---|---|---|
| | | | |

---

## Deviations from the blueprint

When reality disagrees with the spec — and it will — record it here and update the spec. A
blueprint that silently stops matching the code is worse than no blueprint.

| Date | What changed | Why | Docs updated |
|---|---|---|---|
| | | | |

---

## Session log

Append one line per working session. This is how the next session (or the next person) picks up.

```
2026-10-05  Started W0. Meta app created; App Review submitted with screencast.
            Blocked: waiting on REDUX Business Verification (E0-S01).
```
