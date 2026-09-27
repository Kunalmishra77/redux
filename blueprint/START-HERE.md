# START HERE

Everything you need to go from this folder to a running build.

---

## 1. Set the folder up (5 minutes)

```bash
mkdir redux-platform && cd redux-platform
mkdir blueprint
# copy the contents of this ZIP into blueprint/
cp blueprint/CLAUDE.md ./CLAUDE.md          # CLAUDE.md must sit at the project root
cp blueprint/.env.example ./.env.example
git init && git add . && git commit -m "chore: project blueprint"
code .                                       # open in VS Code
```

Resulting layout:

```
redux-platform/
├── CLAUDE.md          ← Claude Code reads this automatically, every session
├── .env.example
└── blueprint/         ← the full specification
    ├── README.md  START-HERE.md
    ├── 00-brief/ 01-research/ 02-product/ 03-architecture/
    ├── 04-design/ 05-content/ 06-delivery/ 07-build/ data/
```

> **`CLAUDE.md` belongs at the project root, not inside `blueprint/`.** Claude Code loads it
> automatically from the root — that is what makes every session start with the right context
> instead of you re-explaining the project.

---

## 2. The first prompt

Open Claude Code in that folder and paste this:

---

```
Read CLAUDE.md, then read the blueprint/ folder in this order:

1. blueprint/README.md
2. blueprint/00-brief/ — all four files
3. blueprint/01-research/00-research-summary.md and 01-stack-decisions-adr.md
4. blueprint/02-product/PRD.md and 05-business-rules.md
5. blueprint/03-architecture/01-system-architecture.md and schema.sql
6. blueprint/07-build/01-build-order.md, 02-coding-standards.md, 03-definition-of-done.md
7. blueprint/06-delivery/01-master-timeline.md and 02-phase-1-plan.md

This is the REDUX Platform — a website, lead CRM, care executive portal, offline
surveyor mobile app, customer portal and super admin for a bath fittings restoration
company in New Delhi. 23 contracted deliverables (D1–D23) across three phases. The
blueprint is decided, not advisory: follow the ADRs rather than re-deriving them.

When you have read all of that, do NOT start writing features. Instead:

A. Give me a 10-line summary proving you understand the project — what it does, the
   three phases, the stack, and the three rules that are never negotiable.

B. List anything in the blueprint that is contradictory, missing or looks wrong to you.
   Be direct. I would rather fix the spec now than in week six.

C. Propose the exact scope of the first work session, drawn from Step 0 and Step 1 of
   blueprint/07-build/01-build-order.md and epic E0/E1 in
   blueprint/06-delivery/05-backlog.md. Include the story IDs.

Then stop and wait for me to confirm before writing any code.
```

---

### Why it is shaped like this

| Part | Reason |
|---|---|
| A specific reading order | Stops it from skimming 40 files and absorbing none |
| "Decided, not advisory" | Stops it re-litigating the stack halfway through Phase 2 |
| **A** — prove understanding | Catches a misread before it becomes 2,000 lines of wrong code |
| **B** — find the flaws | It will find some. Better now than in week six |
| **C** — propose scope | Turns it into a collaborator rather than an order-taker |
| **Stop and wait** | You approve the plan before anything is written |

---

## 3. The second prompt (after you approve the plan)

```
Good. Start with Step 0 and Step 1 from blueprint/07-build/01-build-order.md.

Scaffold the Next.js 16.3 project exactly as specified in
blueprint/07-build/04-repo-structure.md, then set up the CI gates from
blueprint/06-delivery/06-qa-uat-plan.md §2 — including the RLS check, the
secret scan, and the ₹ render test. Those gates must exist before any feature code.

Then build the data foundation: enums, identity/org and master data from
blueprint/03-architecture/schema.sql, as numbered Supabase migrations. For every
table, in the same commit: the migration, RLS enabled, the policy, and an index on
every policy column.

Work in vertical slices. Update blueprint/07-build/05-task-tracker.md as you go.
Stop and show me when the migrations run clean and CI is green.
```

---

## 4. Prompts for later sessions

**Resuming**
```
Read CLAUDE.md and blueprint/07-build/05-task-tracker.md. Tell me where we are,
what's blocked, and what's next per blueprint/07-build/01-build-order.md.
```

**A specific story**
```
Build E3-S08 (My leads queue) from blueprint/06-delivery/05-backlog.md.
Spec: blueprint/02-product/PRD.md §4.2 and blueprint/04-design/04-screens-portals.md.
Business rules: BR-L4, BR-L5 in blueprint/02-product/05-business-rules.md.
Vertical slice — migration, RLS, service, action, UI, tests. Definition of done applies.
```

**Before a go-live**
```
We're at the end of Phase 1. Work through blueprint/06-delivery/02-phase-1-plan.md
"Go-live checklist" and blueprint/03-architecture/04-auth-security-rls.md §9.
Report what passes, what fails, and what you couldn't verify.
```

**When the spec is wrong**
```
The blueprint says X but Y is the case. Tell me which one is wrong, update the
relevant blueprint doc, and record it under "Deviations" in the task tracker.
```

---

## 5. What to do before any of this

**Week 0 is paperwork, not code, and it is the highest-leverage week in the project.**
Three approval queues gate everything and none of them are yours to speed up:

| # | Task | Typical wait | Gates |
|---|---|---|---|
| 1 | **Meta App Review** (`leads_retrieval`, `ads_management`) | 2–6 weeks, rejections common | Meta lead ads (D3) |
| 2 | **TRAI DLT registration** (biometric auth required) | 1–2 weeks | SMS OTP fallback |
| 3 | **Razorpay KYC** (needs live Terms/Privacy/Refunds/Contact pages) | 1–2 weeks | Payments (D13) |

Start all three the day the project starts. Detail: `03-architecture/06-integrations-runbook.md`.

**Also get from REDUX early** (`00-brief/04-assumptions-open-questions.md` §A):
Meta Business Manager access · WhatsApp number · KYC documents · domain/DNS · brand assets ·
and by Week 10, **the rate card** — which gates the whole of Phase 2.

---

## 6. Two things to settle with REDUX before Week 14

Both get materially more expensive the later they surface:

1. **Is REDUX's AATO above ₹5 Cr in any year since 2017-18?** If yes, GST e-invoicing (IRP/IRN)
   is mandatory and **permanent**, and that is ~2 weeks of GSP integration not currently in scope.
   Their CA can answer it in a phone call.
2. **Will two surveyors ever audit the same property at the same time?** If they might, the
   offline model partitions by *unit* rather than by *survey*. Cheap to design for now,
   expensive to retrofit. (Assumption B3.)

---

## 7. How to keep the blueprint useful

It stops being useful the moment it stops matching the code.

- When reality diverges, **record it in the task tracker under Deviations and update the doc.**
- When a decision is made that contradicts an ADR, **write a superseding ADR.** Don't diverge quietly.
- At handover, the blueprint is updated to as-built — that is part of D23.

A spec that silently drifts out of date is worse than no spec, because people still trust it.
