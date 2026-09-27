# 03 — Phase 2 Plan · Survey & Quote

**W10–W19 · 14 Dec 2026 – 19 Feb 2027 · Go-live Thu 18 Feb 2027**
**Deliverables: D7 Surveyor app · D8 Assessment · D9 Rate card · D10 Quotation & OTP ·
D11 Job tracking · D12 Notifications**

**The goal:** a surveyor audits a hotel with no signal, loses nothing, and leaves with an
OTP-approved quotation that has already created the job.

**This is the hard phase.** The offline app is the only genuinely difficult engineering in the
project, and the OTP approval and GST quotation carry legal weight. Everything else is
well-understood workflow.

---

## W10–W11 · Design sprint 2 + app foundation (14–25 Dec)

⚠ **W11–W12 (21 Dec – 1 Jan) are holiday-affected. Planned for, not pretended away.**

### Design (D20)
DS2 covers the **12 surveyor app screens** plus quotation and job-tracking web screens.
Approval by **Fri 25 Dec**.

Design priority is the **fitting capture screen** — a surveyor does it 40 times a visit. Everything
else in the app is navigation to and from it.

### Build
| Task | Detail |
|---|---|
| Expo project | SDK 57, Android, `minSdk 24` / **`targetSdk 36`** (required since 31 Aug 2026), EAS build + Update |
| Auth | Long-lived session — field staff must never be logged out mid-visit |
| **SQLite outbox** | `outbox` + `attachments` tables, UUIDv7, `idem_key`, backoff with jitter (ADR-006) |
| Bootstrap sync | Master lists + settings with ETag |
| Schema part 2 | `schema.sql` §7–9: customers, properties, units, surveys, fittings, photos, assessments |
| Mobile API | `/api/mobile/*` route handlers, all idempotent on `idem_key` |
| **C2 onboarding** | Battery/autostart deep-links per OEM — ships in the first build, not later |

---

## W11–W13 · Surveyor app core + photo pipeline + offline hardening (21 Dec – 15 Jan) — **D7**

### W11 — visits, check-in, units, fittings
Today's visits · navigation · **GPS check-in** (accuracy stored, >50 m flagged not blocked) ·
unit list with **add-unit** · fitting capture with master-list dropdowns and recents pinned.

### W12 — the photo pipeline
| Step | Detail |
|---|---|
| Capture | `expo-camera` straight into the tapped slot; app-private dir, never the gallery |
| Compress | **at capture**: 1600 px q0.72; close-up 2048 px q0.8 → 250–700 KB |
| Stamp | date · GPS · visit ID burned into the corner |
| Commit | `attachments` row **in the same SQLite transaction as the fitting, before the preview closes** |
| Upload | direct to Supabase Storage, path includes the sha256, `upsert:false`, **409 = success** |
| Confirm | `/photos/confirm` → `fitting_photos` row → **only then** delete the local file |
| UI | 2×2 slot grid; save disabled until all four exist, with the button saying which is missing |

### W13 — offline hardening (do not skip this week)
Outbox drain with backoff · foreground service (`dataSync`, declared in Play Console) ·
**startup reconciler** for orphan files · needs-attention screen naming the exact fitting and slot ·
**Submit blocked while anything is unsynced** · airplane-mode test of a full 40-fitting audit ·
kill-the-app test · storage-full test.

**The acceptance test for the whole phase:** run a complete 40-fitting audit in airplane mode,
force-kill the app twice during it, then reconnect. **Every photo arrives. Nothing is lost.**

---

## W14 · Rate card + assessment (18–22 Jan) — **D8, D9**

⚠ **The rate card from REDUX (input A9) is due W10 and gates this week.** Chase it from W6.
Without real prices, quotations cannot be built or tested.

| Task | Detail |
|---|---|
| D9 | Versioned rate cards; only one active; effective-from; CSV import/export; admin editor |
| D9 | Market replacement prices per fitting type |
| D8 | Per-fitting recommendation; **all three prices always computed**; `rate_card_id` frozen on the row |
| D8 | "You save" = market − recommended, never negative |
| D8 | Suitability caveat surfaced wherever a recommendation appears |
| D8 | Part-unavailable note: **"Eurobrass can re-machine this"** — the differentiator, shown to the customer |
| App | On-site three-column comparison (C10), designed to be turned around and shown to the customer |

---

## W15–W16 · Quotation + OTP approval (25 Jan – 5 Feb) — **D10**

### W15 — build and PDF
Builder pulling lines from assessments (never re-typed) · discount with approval threshold ·
tax split · market total and "You save" · 15-day validity · **terms snapshotted onto the quote** ·
**Gotenberg PDF with Noto Sans baked in for the ₹ glyph** · `pdf_sha256` stored ·
WhatsApp share as a document.

**CI test:** render a PDF containing `₹1,23,456`, extract the text, assert the ₹ renders and the
Indian digit grouping is correct. Both fail silently otherwise.

### W16 — OTP approval and auto job creation
| Task | Detail |
|---|---|
| OTP | 6 digits, 10-min expiry, 5 attempts, rate limited; WhatsApp primary, SMS fallback |
| **Evidence** | Full `quote_approvals` set: PDF hash, quote version, OTP lifecycle (server-side timestamps), gateway message ID, DLT template ID, attempts, IP, user agent, terms text |
| **Transaction** | Approval + customer + property + units + job in **one transaction**. Partial failure means none of it happened |
| Email | Signed PDF + audit trail sent immediately — contemporaneous delivery is corroboration |
| s.65B | Certificate generator built now, not during a dispute |
| CAPI | `job_won` fired with value |
| Discounts | Above threshold → Super Admin queue, blocks sending |
| Immutability | Approved quote has no UPDATE policy; changes create a new version |

---

## W17 · Job tracking (8–12 Feb) — **D11, D12**

| Task | Detail |
|---|---|
| 7 stages | `dates_confirmed → removal_pickup → at_eurobrass → quality_check → refit_test → handover → warranty_active` |
| Batches | Units grouped around the property's approved dates |
| Room board | Per-property status board, same view for REDUX and customer |
| **Blocked clock** | `civil_work` and friends stop the delay clock — the hotel's maintenance panel is not REDUX's delay |
| Delay alerts | Units past planned downtime and not blocked |
| Pilot | `is_pilot` + `parent_job_id`; create a wider project from a pilot |
| Handover | After-photos, three checks, customer sign-off |
| **Warranties** | Generated at handover — mechanical and finish, separate periods |
| D12 | CN3–CN11, TN6–TN11 wired and toggleable |

---

## W18 · QA + real field trial (15–19 Feb… *see note*)

**The field trial is the acceptance test that matters.** A real surveyor, a real property, a real
audit — ideally REDUX's own pilot bathroom, which is a stage they run anyway.

| Test | Pass condition |
|---|---|
| Full offline audit, 40+ fittings | Every photo arrives; nothing lost |
| App force-killed mid-upload | Resumes on relaunch |
| Phone battery dies mid-visit | Everything committed survives |
| Weak signal, lift, basement | Retries succeed; no data loss |
| Duplicate photo upload | One object, one row (409 handled as success) |
| Submit with a missing slot | Blocked, with the missing slot named |
| Quote priced from an old rate card | Old quote unchanged after a rate card edit |
| OTP approval | Every evidence field populated; job created atomically |
| Expired quote approval | Rejected |
| Blocked unit | Excluded from delay metrics |
| ₹ in the PDF | Renders correctly, Indian grouping |
| Permission tests | All 8 pass |

Plus: Play Store submission (target API 36, `dataSync` FGS declared in Play Console → App content).

---

## W19 · UAT + go-live (15–19 Feb) — **D22, D23**

| Day | Activity |
|---|---|
| Mon | REDUX UAT: surveyors on the app, admin on quotes and jobs |
| Tue | Fixes; Play production release submitted |
| Wed | **Surveyor training** — in the field, not in a room. Device onboarding, battery settings, the sync screen |
| **Thu 18 Feb** | **Go-live.** App live on the closed/production track |
| Fri | Hypercare; a team member joins a real survey |

### Go-live checklist
- [ ] D7–D12 acceptance criteria signed
- [ ] Offline test passed on **three different OEM phones** (Xiaomi, Oppo/Vivo, Samsung — they kill background work differently)
- [ ] Every surveyor's device has battery optimisation disabled and it is verified, not assumed
- [ ] Rate card loaded and verified against REDUX's own pricing
- [ ] Warranty periods and text confirmed
- [ ] Phase 2 WhatsApp templates approved
- [ ] Gotenberg ₹ test green
- [ ] Play Store live, surveyors have it installed
- [ ] `TN11` (unsynced data >24 h) alert tested by leaving a device offline

---

## Definition of done for Phase 2

1. A surveyor audits a full hotel floor with no signal and loses nothing.
2. Every audited fitting shows restore, Eurobrass replacement and market replacement, priced.
3. A quote is generated from the audit with no re-typing, and priced from a controlled rate card.
4. The customer approves by OTP and the job is created automatically, with evidence that would
   survive a dispute.
5. Every room is tracked to handover, and a room blocked on the hotel's own civil work does not
   count against REDUX.
