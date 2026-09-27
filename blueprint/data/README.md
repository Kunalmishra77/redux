# data/

Machine-readable companions to the blueprint.

| File | What it is | Used for |
|---|---|---|
| `deliverables.csv` | D1–D23 with phase, description and acceptance criterion | Import into a tracker; client sign-off |
| `timeline.csv` | All 27 weeks with dates, phase and focus | Import into a Gantt or project tool |
| `rate-card-template.csv` | The rate card structure REDUX fills in | **Client input A9** — hand this to REDUX |

---

## rate-card-template.csv

**Give this to REDUX in Week 6, not Week 9.** It gates the whole of Phase 2 (risk R4): quotations
cannot be built or tested without real prices.

| Column | Meaning |
|---|---|
| `fitting_type_code` | Stable code — becomes `fitting_types.code` |
| `fitting_type_name` | Display name |
| `work_type_code` | `restore_finish` · `repair_function` · `replace_eurobrass` |
| `finish_code` | Only where the finish affects the price; blank otherwise |
| `price_inr` | **REDUX fills this in** — what REDUX charges |
| `market_replacement_inr` | **REDUX fills this in** — open-market replacement price. Drives "You save" |
| `gst_rate` | Default 18 |
| `hsn_sac` | **REDUX's CA confirms.** 998719 is the usual fit for repair/maintenance services; goods differ |

The fitting types listed are a starting set drawn from the pitch deck. **REDUX should add, remove
or rename rows** — this is their master list, not ours (client input A8).

Rows with a blank `price_inr` are ignored on import, so REDUX can return a partially filled sheet
and we can load what exists.
