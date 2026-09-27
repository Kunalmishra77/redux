# 05 — Storage & Media

---

## 1. Buckets

All private except `brand`. Bucket list and access rules are in `04-auth-security-rls.md` §5.

| Bucket | Content | Year-1 estimate |
|---|---|---|
| `survey-photos` | 4 per fitting, the bulk of everything | ~250 GB |
| `handover-photos` | After-photos per unit | ~30 GB |
| `documents` | Quotation and invoice PDFs | ~2 GB |
| `call-recordings` | 90-day rolling | ~15 GB |
| `signatures` | Handover sign-offs | <1 GB |
| `brand` | Logos, website imagery | <1 GB |

---

## 2. Photo pipeline (surveyor)

```
capture (expo-camera)
   ↓ compress AT CAPTURE — not at upload
   ├─ standard slots: 1600 px long edge, JPEG q0.72  → ~250–400 KB
   └─ close_up slot:   2048 px long edge, JPEG q0.80 → ~500–700 KB
   ↓ burn corner stamp: date · GPS · visit ID
   ↓ sha256(bytes)
   ↓ write file to FileSystem.documentDirectory  (app-private, NOT the gallery)
   ↓ INSERT attachments row IN THE SAME SQLITE TRANSACTION as the fitting
   ↓ outbox drain → PUT direct to Supabase Storage
        path: surveys/{survey_id}/{fitting_id}/{slot}/{sha256}.jpg
        upsert: false  →  HTTP 409 == already there == SUCCESS
   ↓ POST /api/mobile/photos/confirm → fitting_photos row
   ↓ ONLY NOW delete the local file
```

**Why compress at capture, not upload:** it halves on-device storage pressure. A 50-fitting hotel
is 200 photos ≈ 60–90 MB compressed; uncompressed it would be 600 MB+ on a phone that may only
have 2 GB free.

**Why the sha256 is in the path:** retries become free no-ops. The same bytes always land at the
same path, `upsert: false` returns 409, and we treat 409 as success. A photo can be uploaded
five times and exist once.

### No TUS, deliberately
Supabase Storage supports resumable uploads, but only via `tus-js-client`/Uppy, with a mandatory
6 MB chunk size, and it is only recommended above 6 MB. Our photos are ~300 KB — a failed upload
is simply retried whole. Adding TUS would be complexity for a problem we do not have.

---

## 3. Serving photos

| Context | How |
|---|---|
| List / grid views | Signed URL with an **explicit width**: `?width=400&quality=75` |
| Detail view | Signed URL at `?width=1200` |
| PDF embed | Fetched server-side at render time, embedded in the HTML sent to Gotenberg |
| Download original | Signed URL, full size, admin only, logged |

**Three rules that keep the bill flat:**
1. Never request a full-size image in a list view.
2. Never proxy a photo through the app host.
3. Cache the derived thumbnail URL — Supabase bills transformations separately from storage, so
   transforming on every render pays twice.

---

## 4. Retention & lifecycle

| Content | Retention | Mechanism |
|---|---|---|
| Call recordings | **90 days** (BR-P4), longer only for a live dispute | `retention_purge` cron on `calls.recording_expires_at` |
| Survey photos | Life of the job + 2 years, then archived | Cron moves to cold storage; DB row keeps the reference |
| Handover photos & warranty evidence | Warranty period + 1 year | Warranty may be claimed; evidence must outlive it |
| Invoices & PDFs | **6+ years** (GST) | Never auto-deleted |
| Quote approval evidence | Life of the relationship | Never auto-deleted — it is the contract evidence |
| Erasure request | After job closure and statutory retention | `dsr_requests` → queued purge, with what is retained and why shown to the customer |

**DPDP purpose limitation (BR-P3):** `fitting_photos.marketing_use_consented` defaults to false.
A site photograph collected for quotation evidence cannot appear on the website or in a case study
until that flag is true. This is enforced in the query that powers the gallery, not in a policy
document.

---

## 5. PDF generation

Gotenberg as a Docker sidecar (ADR-010).

```
Server Action
  → render /quotes/[id]/preview  (same Tailwind markup as the on-screen quote)
  → POST html to Gotenberg  { printBackground: true, paperWidth/Height: A4 }
  → PDF bytes
  → sha256 → store on quotations.pdf_sha256   (the approval evidence)
  → upload to documents bucket
  → signed URL → WhatsApp document message
```

### The ₹ trap
Bake **Noto Sans** into the Gotenberg image. Default container fonts may not carry the ₹ glyph,
and it renders as an empty box — silently, on every invoice, and nobody notices until a customer
does.

```dockerfile
FROM gotenberg/gotenberg:8
USER root
COPY fonts/NotoSans-*.ttf /usr/share/fonts/truetype/noto/
RUN fc-cache -f
USER gotenberg
```

**Test, in CI:** render a PDF containing `₹1,23,456`, extract the text, assert the ₹ is present
and that the Indian digit grouping (1,23,456 not 123,456) is correct. Both are easy to get wrong
and embarrassing to ship.

---

## 6. Website images

| Concern | Choice |
|---|---|
| Before/after gallery | `next/image` with explicit sizes; WebP/AVIF; lazy below the fold |
| Source | `brand` bucket (public) for marketing assets; consented site photos for case studies |
| Optimisation | Note that Next 16 changed `next/image` defaults — `qualities: [75]`, `minimumCacheTTL` 4 h, local-IP optimisation blocked. Set `qualities` explicitly if another value is needed |
| LCP | Hero image preloaded with `priority` |

---

## 7. Failure modes and what happens

| Failure | Behaviour |
|---|---|
| Upload fails mid-photo | Outbox retries with exponential backoff and jitter; local file untouched |
| Same photo uploaded twice | 409 → treated as success; one row, one object |
| App killed during upload | Local file and `attachments` row both survive; resumes on relaunch |
| Photo uploaded but confirm fails | Startup reconciler finds the orphan object and re-confirms |
| Local file deleted before confirm | Cannot happen — delete is gated on a successful confirm |
| Storage quota exceeded | Upload 4xx → surfaced on the "needs attention" screen; admin alerted |
| Signed URL expires while viewing | Client re-requests transparently |
| Gotenberg down | PDF job stays in `q_documents` and retries; the quote stays `draft` and is not sent half-done |
