# 05 — Surveyor App Screen Specs · D7 · Expo, Android

Design brief in one line: **a surveyor with wet hands, in a dim bathroom, with no signal, must be
able to record a fitting in under 60 seconds and never doubt that their work is safe.**

---

## Global rules

| Rule | Why |
|---|---|
| Touch targets **56 dp minimum** | One-handed use in a tight space |
| Sync status **always in the header** | The surveyor's main anxiety is "did it save?" — answer it permanently |
| Primary action is a full-width bottom button | Thumb reach |
| No screen requires network | Everything writes to the local outbox first |
| No raw error strings, ever | "Couldn't upload 3 photos. They're saved — we'll retry." |
| Big type, high contrast | Dim rooms, bright glare, older eyes |

Header sync chip states:
`✓ All synced` · `↑ Uploading 187/200` · `⏸ Offline — 12 saved` · `⚠ 3 need attention`

---

## C2 — Device onboarding (first launch)

**Ships in the first build, not "later".** OEM battery managers are the number-one cause of
background work silently dying on Indian Android phones.

1. "This app saves your work on the phone and uploads it in the background."
2. Camera permission.
3. Location permission (while using the app).
4. **Battery optimisation** — detect `isIgnoringBatteryOptimizations()`; if false, deep-link to the
   OEM autostart/battery screen with device-specific wording (Xiaomi/Oppo/Vivo/Samsung differ).
5. Notification permission (upload progress).

Re-shown if any of these is revoked later.

---

## C3 — Today's visits

```
┌──────────────────────────────────────┐
│ Today          ✓ All synced          │
│ 3 visits                             │
├──────────────────────────────────────┤
│ 10:30 AM                             │
│ The Grand Orchid                     │
│ Delhi · 12 rooms to audit            │
│ [ Navigate ]        [ Check in ]     │
├──────────────────────────────────────┤
│ 2:00 PM   Rohit Mehra                │
│ Gurugram · 2 bathrooms               │
│ [ Navigate ]        [ Check in ]     │
└──────────────────────────────────────┘
```

Pull to refresh (when online). Offline shows the last synced list with a timestamp —
never an empty screen, which reads as "the app is broken".

---

## C5 — Check-in

Map preview, address, and a large **Check in** button showing live GPS accuracy.

- Accuracy ≤50 m → green.
- Accuracy >50 m → amber: "Weak GPS — checking in anyway." **It never blocks.** A basement with
  no signal is exactly where the work is (BR-S3).
- Captures lat/lng/accuracy/`is_mocked`/device ID; queued locally.
- Server later computes geofence distance and impossible-travel; flags for review without ever
  interrupting the surveyor.

---

## C6 — Unit (room) list

Unit chips with a per-unit progress ring ("3 fittings"). **+ Add unit** is prominent — hotel room
lists are wrong more often than they are right, and a surveyor who cannot add a room will put it
in the notes, where it is useless.

---

## C7 / C8 — Fitting capture (the core screen)

```
┌──────────────────────────────────────┐
│ ← Room 204 · The Grand Orchid   ↑ 12 │
│ Basin mixer                          │
├──────────────────────────────────────┤
│ Type    [ Basin mixer          ▾ ]   │
│ Brand   [ Eurobrass            ▾ ]   │
│ Model   [ EB-2201                ]   │
│ Finish  [ Chrome               ▾ ]   │
│                                      │
│ Photos (4 required)                  │
│ ┌────────┐ ┌────────┐                │
│ │  📷 ✓  │ │  📷 ✓  │   Front  Side  │
│ └────────┘ └────────┘                │
│ ┌────────┐ ┌ ─ ─ ─ ┐                 │
│ │  📷 ✓  │ │   📷   │   Top  Close-up│
│ └────────┘ └ ─ ─ ─ ┘                 │
│                                      │
│ Condition                            │
│ [Leak ✓] [Stiff control] [Scaling ✓] │
│ [Worn finish ✓] [Part unavailable]   │
│                                      │
│ Recommendation                       │
│ [ Restore finish + cartridge repair ]│
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │       Save & next fitting        │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

**Rules**
- Four fixed slots. Captured = solid with a tick; missing = dashed blue outline. Readable in a glance.
- **Save is disabled until all four exist.** The button says why: "Add the close-up photo to save."
- Camera opens straight into the tapped slot — no gallery, no picker, no chooser dialog.
- Compression and the `attachments` row happen **before the preview closes**, in the same SQLite
  transaction as the fitting. This is the "no photo lost" guarantee (BR-S5/S7).
- Dropdowns come from master lists synced while online, with recents pinned to the top —
  a surveyor auditing 40 basin mixers should not scroll to "basin mixer" 40 times.
- Condition chips are multi-select, large, and toggle with one tap.

---

## C10 — Quote preview on site

The moment the sale is made. Three columns per fitting: **Restore/repair · Eurobrass replacement ·
Market replacement**, with the recommended option highlighted and **"You save ₹X"** large at the
bottom.

Designed to be **turned around and shown to the customer**, so: large type, no internal jargon,
no cost fields, nothing on screen the customer should not see.

---

## C11 — Sync status

```
┌──────────────────────────────────────┐
│ Sync                                 │
├──────────────────────────────────────┤
│ ↑ Uploading photos                   │
│ ████████████░░░░  187 / 200          │
│                                      │
│ The Grand Orchid   184 / 196   ↑     │
│ Rohit Mehra          3 / 4     ✓     │
│                                      │
│ ⚠ Needs attention (1)                │
│   Room 207 · Shower mixer · Top      │
│   Upload failed 5 times              │
│   [ Retry ]                          │
└──────────────────────────────────────┘
```

**Needs attention** names the exact fitting and slot. "Sync failed" with no detail is useless to
someone standing in a hotel corridor deciding whether to go back to Room 207.

---

## C12 — Handover capture

Used at the end of a job, not the survey. After-photos per fitting, three checks (leak,
operation, finish), customer name, signature pad, notes. Submitting generates the warranty cards.

---

## Offline behaviour summary

| Action | Offline |
|---|---|
| Open today's visits | ✅ last synced list, with the timestamp shown |
| Check in | ✅ queued |
| Add unit / fitting | ✅ queued |
| Take photos | ✅ saved locally |
| Build quote | ✅ priced from the synced rate card |
| **Submit visit** | ❌ **blocked until every photo is synced** (BR-S6) |
| Refresh master lists | ❌ uses the last synced copy |

---

## Failure UX

| Situation | What the surveyor sees |
|---|---|
| No signal | `⏸ Offline — 12 saved on this device` |
| Upload retrying | `↑ Uploading 187/200` with a progress bar |
| 5 failures on one photo | Needs-attention entry naming the fitting and slot, with Retry |
| Storage nearly full | "Phone storage is low. Upload when you get signal to free space." |
| Session expired | Re-login prompt — **the outbox is never cleared by a logout** |
| App updated | Outbox survives; a migration runs on first launch |

**The rule behind all of these:** the surveyor's work is never deleted by anything the app does
automatically. Only a confirmed successful upload removes a local file.
