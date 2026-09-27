# 02 — Database Schema (guide)

The schema itself is `schema.sql`. This file explains **why** it looks the way it does.

**Validated 26 Sep 2026:** executed clean against PostgreSQL 16 — 0 errors, 65 tables, 19 enums,
181 indexes, 47 functions, RLS enabled on 65/65 tables, and six business rules verified by
execution (see the header of `schema.sql`).

---

## 1. Section map

| § | Area | Key tables |
|---|---|---|
| 1 | Enums | 19 domain enums — statuses are enums, not text, so a typo is a compile error |
| 2 | Identity & org | `profiles`, `cities`, `user_roles`, `role_permissions`, `assignment_state` |
| 3 | Master data (D16) | `fitting_types`, `brands`, `finishes`, `work_types`, `condition_flags`, `lost_reasons` |
| 4 | Rate card (D9) | `rate_cards`, `rate_card_items`, `market_prices` |
| 5 | Leads (D2/D3) | `leads`, `lead_touches`, `lead_status_history`, `lead_notes`, `follow_ups`, `campaigns` |
| 6 | Calls (D4) | `calls` |
| 7 | Customers | `customers`, `customer_contacts`, `properties`, `property_units` |
| 8 | Surveys (D7) | `surveys`, `survey_checkins`, `fittings`, `fitting_conditions`, `fitting_photos` |
| 9 | Assessment (D8) | `assessments` |
| 10 | Quotations (D10) | `quotations`, `quotation_lines`, `quote_approvals`, `discount_approvals` |
| 11 | Jobs (D11) | `jobs`, `job_batches`, `job_units`, `job_stage_events`, `handovers`, `warranties` |
| 12 | Money (D13) | `invoice_series`, `invoices`, `invoice_lines`, `payments`, `credit_notes` |
| 13 | Stock (D15) | `stock_items`, `stock_movements` |
| 14 | Service requests | `service_requests` |
| 15 | Integrations | `webhook_events`, `integration_accounts`, `lead_form_field_map`, `whatsapp_conversations`, `message_templates`, `notification_rules`, `messages`, `capi_events` |
| 16 | Privacy & audit | `privacy_notices`, `consent_records`, `dsr_requests`, `incidents`, `audit_log`, `settings` |
| 17–21 | Auth helpers, RLS, triggers, cron, storage | — |

---

## 2. The eight design decisions worth knowing

### 2.1 A lead is one row per phone number, forever
`leads.phone` is unique. A second enquiry from the same number becomes a **`lead_touches`** row, not
a second lead (BR-L1). This is the difference between "we have 500 leads" and "we have 500 people".

### 2.2 Attribution is immutable and cannot be backfilled
`source_id`, `ctwa_clid`, `meta_ad_id`, `meta_form_id` are locked by the `guard_lead_attribution`
trigger. Meta will not give you `ctwa_clid` later, and without it Meta's Conversions API cannot
attribute a won job back to the ad that produced it. **Capture at creation or lose it permanently.**

### 2.3 The survey has no price column
Deliberate. The free survey is REDUX's offer, and the schema makes charging for one impossible
(BR-S1). If REDUX ever wants paid surveys, that is a schema change and a conversation — not
something someone can do by filling in a field.

### 2.4 Three prices on every assessment, frozen to a rate card version
`assessments` carries `price_recommended`, `price_replace_eurobrass` **and**
`price_market_replacement`, plus the `rate_card_id` they came from. Two consequences:
- The customer always sees the comparison that makes REDUX's argument (D8-02).
- Editing the rate card never changes an existing quote (BR-A3). Old quotes reprice to nothing.

### 2.5 Four photo slots, enforced by a check constraint
`fitting_photos.slot in ('front','side','top','close_up')` with
`unique (fitting_id, slot, sha256)`. Photos are **insert-only** — there is no update or delete
policy on the table anywhere. A correction adds a photo; it never destroys evidence.

### 2.6 The immutability spine
Four tables are never edited or deleted, because a customer relationship or a tax authority
depends on them:

| Table | How change happens instead |
|---|---|
| `quotations` | New version + `supersedes_id`. An approved quote has no UPDATE policy at all |
| `quote_approvals` | Append-only. This is the IT Act s.65B evidence |
| `invoices` | Cancellation issues a `credit_notes` row. **No DELETE policy exists** |
| `fitting_photos` | New row per correction |

### 2.7 The blocked clock
`job_units.blocked_reason` / `blocked_from` / `blocked_to`, with
`unit_effective_downtime_hours()` subtracting blocked time. When the hotel's own maintenance panel
is doing civil work on Room 207, that is not REDUX's delay — and the delay metrics must say so,
or REDUX gets blamed for someone else's schedule (BR-J2).

### 2.8 GST values are stored, never recomputed
Every tax field lives as a column on `invoices` / `invoice_lines`. The PDF is a pure render of
stored values. A 2026 invoice re-rendered in 2030 must be byte-identical, whatever the tax rate is
by then (BR-I3). `next_invoice_no()` takes a row lock on the series, which is what makes numbering
gap-free under concurrency — verified by execution.

---

## 3. Naming conventions

| Convention | Example |
|---|---|
| snake_case, plural tables | `fitting_photos` |
| `id uuid primary key default gen_random_uuid()` | everywhere except `audit_log` (bigserial) |
| Timestamps `*_at`, dates `*_date` / `*_on` | `issued_at`, `issue_date` |
| Booleans `is_*` / `has_*` | `is_active`, `is_pilot` |
| FKs `<singular>_id` | `survey_id` |
| Money `numeric(12,2)` — **never float** | `total numeric(12,2)` |
| Percentages `numeric(5,2)` | `gst_rate` |
| Coordinates `numeric(9,6)` | `lat`, `lng` |
| Offline idempotency | `idem_key text not null unique` |
| Provider idempotency | `unique (source, external_id)` |

---

## 4. Indexing

Every column used in an RLS policy is indexed — ADR-004 rule (b), worth ~100× on large tables.
Beyond that:

| Pattern | Example |
|---|---|
| Partial index on a hot filter | `leads (sla_due_at) where status in ('new','contacted')` |
| Partial unique for provider IDs | `leads (meta_leadgen_id) where meta_leadgen_id is not null` |
| Partial unique for business rules | `rate_cards (is_active) where is_active` |
| Descending on list views | `leads (created_at desc)` |
| Composite for queue queries | `follow_ups (assigned_to, due_at) where completed_at is null` |

---

## 5. Migration discipline

```
supabase/migrations/
  20261005090000_init_enums.sql
  20261005090100_identity_org.sql
  20261005090200_masters.sql
  ...
  20261005091500_rls_policies.sql
  20261005091600_triggers.sql
```

**Rules:**
1. Forward-only. A mistake is corrected by a new migration, never by editing an applied one.
2. Split `schema.sql` into numbered migrations — do not run it as one blob against production.
3. Every migration is reversible in principle; write the down-path in a comment.
4. **No manual changes in the Supabase dashboard, ever.** A hand-edit in production is the single
   easiest way to lose a weekend and desync every environment.
5. Seed data (master lists, `settings`, `lead_sources`, notification rules) lives in
   `supabase/seed.sql` and is idempotent.

---

## 6. What to build first

Order is in `../07-build/01-build-order.md`, but at the schema level:
**enums → identity → masters → leads → surveys → assessments → quotations → jobs → money → the rest.**
Each block is usable on its own, which is what lets Phase 1 ship without Phase 2 tables existing.
