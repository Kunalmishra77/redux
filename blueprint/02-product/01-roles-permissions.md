# 01 — Roles & Permissions

Four roles. Implemented per ADR-004: `app_role` enum → `user_roles` table → JWT claim
`user_role` via a Custom Access Token Hook → RLS policies + a `SECURITY DEFINER authorize()` helper.

---

## Capability matrix

● Full access · **Own** = only their own records · **View** = read-only · — = no access

| Capability | Super Admin | Care Executive | Surveyor | Customer |
|---|:--:|:--:|:--:|:--:|
| Manage all leads & sources | ● | Own leads | — | — |
| Call, qualify, book free survey | ● | ● | — | — |
| Field audit & photos | View | View | ● | — |
| Create quotation | ● | — | ● | — |
| Approve quotation | Discounts | — | — | ● |
| Track job status | ● | ● | Own jobs | Own jobs |
| Invoices, payments & warranty | ● | View | — | Own |
| Stock, rate card & users | ● | — | — | — |
| Performance reports | ● | Own stats | Own stats | — |
| Call recordings | ● | Own calls | — | — |
| Export data | ● | — | — | Own (DPDP) |

---

## Role definitions

### `super_admin` — REDUX / Eurobrass management
Sees everything, changes everything. Approves discounts above threshold. The only role that can
edit the rate card, master lists, users and notification rules.
**Constraint:** even a Super Admin's changes are written to `audit_log` — there is no silent edit.

### `cc_exec` — Customer Care Executive
Works their own assigned lead queue. Can call, log outcomes, book surveys, message on WhatsApp.
Can see job status (to answer "where is my job?") but cannot change it.
Cannot see other executives' leads, other executives' stats, or any pricing beyond what appears
on a quote they are discussing.
**Assignment:** by city, else round-robin. A Super Admin can reassign; reassignment is logged.

### `surveyor` — Field auditor
Sees only their own assigned visits. Records fittings, photos, conditions, recommendations, and
creates quotations at rate-card prices. Cannot edit the rate card, cannot apply a discount above
threshold, cannot see other surveyors' visits or any CRM lead not assigned to them for survey.
**Offline:** the mobile app holds only the data for that surveyor's upcoming and recent visits —
which is also why a sync engine is unnecessary (ADR-006).

### `customer` — Hotel or homeowner
Sees only their own properties, jobs, quotes, invoices, warranties and photos. Approves
quotations by OTP. Raises service requests. Exercises DPDP rights (export, correct, withdraw,
erase).
**Hotel sub-case:** a hotel may have several contacts (Chief Engineer, GM, Accounts). All are
`customer` role against the same property; contact-level notification preferences decide who gets
what.

---

## The rules that must be enforced in the database, not the UI

These are the ones a test suite must prove, because getting them wrong is a data breach, not a bug.

| # | Rule | Test |
|---|---|---|
| P1 | A customer can never read another customer's property, job, quote, invoice or photo | Authenticated as customer A, query customer B's records directly → 0 rows |
| P2 | A surveyor can never read a survey not assigned to them | Same, with surveys |
| P3 | A care executive can never read another executive's leads | Same, with leads |
| P4 | Nobody except `super_admin` can write `rate_card_items`, `user_roles`, `master_*` | Insert/update as each other role → denied |
| P5 | The service-role key never reaches the browser | Build-time check: no `SERVICE_ROLE` string in any client bundle |
| P6 | A signed photo URL expires and cannot be re-shared indefinitely | Fetch after TTL → 403 |
| P7 | A quotation cannot be edited after approval | Update an approved quote → denied by policy |
| P8 | An invoice number is never reused and never has a gap | Sequence test across concurrent inserts |

Implementation patterns and example policies: `../03-architecture/04-auth-security-rls.md`.

---

## Onboarding and offboarding

| Event | What must happen |
|---|---|
| New care executive | Invite by email → role assigned → city set → appears in round-robin |
| New surveyor | Same + Play Store internal-track access + device onboarding (battery settings) |
| Executive leaves | Deactivate (never delete — their call logs and lead history must survive). Open leads auto-reassign |
| Surveyor leaves | Deactivate. **Check for unsynced visits on their device before revoking access** — this is a real data-loss path |
| Customer contact changes | Add the new contact; deactivate the old. Warranty and history stay on the property |
