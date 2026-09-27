# 06 — Cost Model

Figures verified 26 Sep 2026. USD→INR taken at ₹88/$ for indicative totals. **Re-price before
quoting a running cost to REDUX** — WhatsApp rates and UPI MDR both change in October 2026.

Based on assumption B1: ~300–500 leads/month, ~100 surveys/month, ~50 internal users, ~300 GB
photos in year one.

---

## 1. Monthly infrastructure

| Item | Monthly | Note |
|---|---|---|
| Supabase Pro (ap-south-1) | $25 | includes $10 compute credit |
| Compute upgrade → Small instance | ~$15 | needed once photo metadata and CRM load grow |
| Storage: 200 GB over the 100 GB included | ~$4 | |
| Egress: ~500 GB over the 250 GB included | ~$23 | **this is why photos are served from Supabase Storage with signed URLs and thumbnails, never full-size in list views** |
| App VPS, 4 vCPU / 8 GB, Mumbai or Bangalore | $24–48 | runs Next.js + Gotenberg + queue worker |
| Cloudflare, domains, misc | ~$5 | |
| **Total** | **≈ $95–120/mo (₹8,500–11,000)** | |

Same shape on **Vercel Pro with 5 seats: ≈ $180–230/mo**, with more variance (Active CPU,
Provisioned Memory, Edge Requests, image-optimisation cache writes at $4–6.40 per 1M).
See ADR-003.

**MAU is a non-issue** — Supabase Pro includes 100,000.

### The one cost that can run away
Photo egress. Three rules keep it flat:
1. List views request an explicit thumbnail width (`?width=400&quality=75`) — never full-size.
2. Signed URLs with 5–15 min TTL, generated server-side.
3. Photos are **never** proxied through the app host.

Note Supabase image **transformations bill separately** on top of storage, so generate a thumbnail
once and cache the derived URL rather than transforming on every render.

---

## 2. Messaging (per month, at assumed volume)

| Channel | Rate | Est. volume | Monthly |
|---|---|---|---|
| WhatsApp **utility** (survey booked, quote shared, job updates, handover) | ₹0.115 | ~2,500 | ~₹290 |
| WhatsApp **authentication** (OTP) | ₹0.115 | ~600 | ~₹70 |
| WhatsApp **service** (replies inside the window) — billable from 1 Oct 2026 | ₹0.115 | ~1,000 | ~₹115 |
| WhatsApp **marketing** (campaigns, if REDUX runs them) | **₹0.8631** | variable | **₹863 per 1,000** |
| SMS OTP fallback (MSG91) | ~₹0.15–0.25 (UNVERIFIED) | ~100 | ~₹25 |
| **Total transactional** | | | **≈ ₹500/month + GST** |

**The number that matters:** marketing is **7.5×** utility. One badly-written template that Meta
reclassifies turns a ₹290 line item into ₹2,175. This is why
`../05-content/02-whatsapp-templates.md` forbids promotional content in transactional templates.

---

## 3. Payment cost — the real money

Assume ~₹15 L/month collected, split as 70% hotel invoices (large) and 30% homeowner (small).

| Route | Cost on ₹15 L | |
|---|---|---|
| Everything on cards/UPI at ~2% | **₹30,000/month** | ₹3.6 L/year |
| Hotels (₹10.5 L) via NEFT/RTGS virtual accounts + homeowners (₹4.5 L) at 2% | ~₹9,000 + flat fees | ≈ **₹1.1 L/year** |
| **Saving** | | **≈ ₹2.5 L/year** |

Plus from **15 Oct 2026**, UPI P2M carries 0.4% MDR (capped ₹300) above ₹2,000 — so UPI is no
longer the free escape for large tickets either.

**This single routing rule is worth more than every other optimisation in the project combined.**
It is implemented as: invoice ≤ ₹50,000 → Payment Link; > ₹50,000 → virtual account first.

---

## 4. One-time setup costs

| Item | Cost | When |
|---|---|---|
| TRAI DLT — Principal Entity registration | ~₹5,900 incl. GST | Week 0 |
| TRAI DLT — header | ~₹590/yr | Week 0 |
| TRAI DLT — content templates | Free | Week 1 |
| Meta Business Verification | Free (time cost is the real cost) | Week 0 |
| Google Play developer account | $25 one-time | Week 9 |
| Razorpay onboarding | ₹0 | Week 0 |
| Domain + SSL | via Cloudflare | Week 1 |

---

## 5. Unit economics REDUX should watch

The platform exists to make these computable. Build them into the Super Admin dashboard (D14):

| Metric | Formula | Why |
|---|---|---|
| **Cost per lead by source** | ad spend ÷ leads | Tells REDUX which channel to fund |
| **Survey-to-order conversion** | won ÷ surveys done | The core operating metric — already on the demo dashboard |
| **Cost per won job** | ad spend ÷ won jobs | The number that actually matters |
| **Free-survey cost** | surveyor cost × surveys ÷ won jobs | The free survey is REDUX's biggest variable cost. If conversion drops below ~20%, the free survey stops paying for itself |
| **Revenue per property** | invoiced ÷ properties | Pilot → wider project is the growth path |

**The free-survey metric is the one to instrument first.** REDUX is giving away field time as a
sales tool; the platform should tell them exactly what that costs per won job — and CAPI
(`02-meta-whatsapp-integration.md` §2) is what lets Meta optimise ads against it.

---

## 6. What scales badly (and the mitigation already in the design)

| Risk | At what point | Mitigation already designed in |
|---|---|---|
| Photo storage + egress | >1 TB | Thumbnails, signed URLs, lifecycle policy archiving photos of jobs closed >2 years |
| Supabase compute on CRM list views | >50k leads | Indexed RLS policy columns (ADR-004), server-side pagination, TanStack Table v9 |
| WhatsApp marketing spend | any campaign volume | Utility/marketing separation; campaign cost shown per-campaign in the dashboard |
| Surveyor photo upload on 3G | always | Compress at capture to 250–400 KB, foreground drain with progress |
| Payment MDR | every large invoice | Virtual-account routing above ₹50,000 |
