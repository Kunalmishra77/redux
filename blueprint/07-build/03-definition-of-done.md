# 03 — Definition of Done

Three levels: a **story**, a **deliverable**, a **phase**. Nothing moves to the next level with an
open item at the one below.

---

## A story is done when…

### Code
- [ ] Implements the acceptance criteria in `../06-delivery/05-backlog.md`
- [ ] TypeScript strict, no `any`
- [ ] Business logic in `lib/services/`, not in the component or the action
- [ ] Every business rule implemented **cites its BR-ID in a comment**
- [ ] No hardcoded prices, periods, thresholds or lists — `settings` or masters

### Data
- [ ] Migration checked in and applies cleanly to a fresh database
- [ ] **RLS enabled and a policy written** for any new table
- [ ] **Every policy column indexed**
- [ ] All four ADR-004 rules followed
- [ ] Types regenerated and committed
- [ ] `audit_log` writing if the action is privileged

### UI
- [ ] Matches the approved design
- [ ] **Loading, empty and error states all present** — the empty state explains what will appear here
- [ ] Responsive at the breakpoints that apply to this surface
- [ ] Keyboard navigable; visible focus ring
- [ ] Contrast ≥4.5:1; status never colour-alone
- [ ] Money as `₹1,23,456` with tabular numerals

### Tests
- [ ] Unit tests for new service functions
- [ ] Integration test for the action or handler
- [ ] **A test per business rule, citing its ID**
- [ ] Permission test if it touches a new table
- [ ] All CI gates green

### Review
- [ ] PR titled with the story ID
- [ ] Reviewed by someone who did not write it
- [ ] No TODOs left without a tracked story

---

## A deliverable is done when…

- [ ] Every story for that D-number is done
- [ ] **The contract acceptance criterion in `../00-brief/02-deliverables-D1-D23.md` is
      demonstrably met** — demonstrated, not asserted
- [ ] It works end to end on staging with realistic data
- [ ] Any admin configuration it needs is documented
- [ ] It appears in the relevant user guide
- [ ] REDUX has seen it

### Acceptance demonstrations — how each D is actually proved

| D | Demonstration |
|---|---|
| D1 | Submit each of the 3 forms; show all 3 leads in the CRM with correct sources |
| D2 | Create a test lead; show it tagged, de-duplicated, assigned, auto-replied — untouched by hand |
| D3 | A real sample lead from **each of the 7 sources** |
| D4 | An executive calls, logs, books — measured, on one screen |
| D5 | Fire each trigger; show each message arriving in the right category |
| D6 | Log in as each role; show what each can and cannot see |
| D7 | **Full audit in airplane mode; reconnect; every photo arrives** |
| D8 | An audited fitting showing all three prices |
| D9 | Edit the rate card; show an old quote unchanged |
| D10 | OTP approval creating the customer and job atomically, with the full evidence set |
| D11 | A multi-room job tracked room by room to handover, including a blocked unit |
| D12 | Each trigger firing |
| D13 | Customer logs in, pays a real ₹1 invoice, sees an active warranty |
| D14 | Three dashboard figures reconciled against the underlying records |
| D15 | Stock crosses its minimum; the alert fires once |
| D16 | **A REDUX admin changes a price and a user with nobody helping** |
| D17 | Each report at three date ranges, exported |
| D18 | Each trigger firing |

---

## A phase is done when…

- [ ] Every deliverable in the phase is done
- [ ] Full regression across everything shipped so far
- [ ] Security checklist complete (`../03-architecture/04-auth-security-rls.md` §9)
- [ ] Performance targets met with realistic data volumes
- [ ] Accessibility audit passed
- [ ] **UAT signed off — every S1 and S2 closed**
- [ ] Training delivered; user guides handed over
- [ ] Deployed to production and smoke-tested
- [ ] Monitoring and alerts live and **tested by triggering a real alert**
- [ ] Runbooks updated
- [ ] Hypercare arranged

---

## Definition of *not* done

Phrases that mean a story is still open, whatever the board says:

| Said | Means |
|---|---|
| "It works, I just haven't written tests" | Not done |
| "The policy is on my list" | **Not done** — and possibly a breach |
| "It works with my data" | Not done — try empty, and try 10,000 rows |
| "The empty state is a to-do" | Not done |
| "I'll make it responsive later" | Not done |
| "It's fine, the UI prevents that" | Not done — the API and the mobile app don't go through the UI |
| "I'll add the audit log after" | Not done |
| "It works on the emulator" | Not done — test on a real budget Android phone |

---

## The three gates that never get waived

However tight the date:

1. **RLS on every table with a written policy.** A missing policy is a data breach, not a bug.
2. **No secret in a client bundle.** CI blocks it.
3. **Business rules tested.** They encode REDUX's commercial and legal commitments; "we tested it
   manually once" is not evidence.

Everything else can be negotiated against a deadline. These three cannot.
