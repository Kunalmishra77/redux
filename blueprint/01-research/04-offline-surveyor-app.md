# 04 — Offline Surveyor App

Verified 26 Sep 2026. Decision summary in ADR-005 and ADR-006.

---

## Recommended stack

**Expo SDK 57 (React Native) + expo-sqlite + a hand-rolled outbox queue + direct Supabase Storage
uploads. Android-only, minSdk 24 / targetSdk 36.**

Do not buy a sync engine. The data is perfectly partitioned (one surveyor owns their visit), only
one role is offline, and the write model is append-mostly — the exact shape where a sync engine's
conflict machinery is dead weight you still have to learn, pay for and debug.

---

## 1. Offline sync options compared

| Option | State (Sep 2026) | Verdict |
|---|---|---|
| **PowerSync** | Healthy. `@powersync/react-native` 2.3.0 (21 Sep 2026), `@powersync/attachments` 3.0.0. Postgres logical replication → per-client SQLite via declarative Sync Rules. Writes go to a local CRUD queue you drain. Server-authoritative last-write-wins by default. Attachments have a real state machine (QUEUED_UPLOAD → SYNCED → ARCHIVED). | Genuinely good; the attachment queue is the one thing we hand-build. **Free tier deactivates after 1 week idle** — fatal for a client handover. Pro from $49/mo. **Documented escape hatch, not the choice.** |
| **ElectricSQL** | **Changed direction — confirmed.** Now a **read-path** sync engine over HTTP using Shapes; the local-SQLite offline *write* client was dropped. Docs moved to electric.ax. | **Disqualified** — no offline write path. |
| **WatermelonDB** | 0.28.0, published 7 Apr 2025 — ~17 months with no release. Sync is BYO-backend anyway. | No. |
| **Legend-State + Supabase plugin** | Supabase plugin still `3.0.0-beta.48` (Jul 2026); npm `latest` is 2.1.15 from Aug 2024. Two-plus years in beta. | Lovely DX, unacceptable risk on a fixed-scope deliverable. No. |
| **RxDB** | 17.5.0 (Aug 2026), active, has a Supabase replication plugin — but SQLite/OPFS storage and encryption are **paid Premium**. | Overkill. No. |
| **Hand-rolled outbox** | `expo-sqlite` 57.x — WAL, ArrayBuffer blob columns, session changesets. | **Yes.** ~2–3 days vs 1–2 weeks. |

### The design

```sql
-- on-device SQLite
outbox(
  id uuid primary key,          -- UUIDv7, client-generated
  table_name text,
  op text,                      -- insert | update
  payload_json text,
  idem_key text unique,
  attempts int default 0,
  next_attempt_at int,
  status text                   -- pending | sending | done | failed
);

attachments(
  id uuid primary key,
  local_uri text,
  sha256 text,
  fitting_id uuid,
  slot text,                    -- front | side | top | close_up
  bytes int,
  status text,                  -- pending | uploading | synced | failed
  attempts int default 0
);
```

Server side: one Supabase RPC per entity taking `idem_key`, with
`on conflict (idem_key) do nothing returning *`. Drain FIFO per visit, exponential backoff with
jitter, cap attempts and surface a **"needs attention"** screen rather than silently dropping.

---

## 2. Platform choice

### Play Store reality, 2026
New apps **and updates** must target **Android 16 / API 36** as of **31 Aug 2026** (extendable to
1 Nov 2026). Existing apps need API 35 to stay visible to new users. We are past that date —
ship on 36 from the first build.
**UNVERIFIED:** whether Expo SDK 57 defaults to `targetSdkVersion 36`. Confirm in
`expo-build-properties` before the first EAS build.

### Background upload — be realistic about what Android allows
- `expo-background-task` = Android **WorkManager**: **minimum 15-minute interval**, and
  **tasks stop if the user swipes the app away**, resuming only on next launch.
- `react-native-background-upload` is dead (last publish 2022).
- Flutter's `workmanager` has identical constraints — this is an OS limit, not a framework one.
- **Android 15+: a `dataSync` foreground service is capped at 6 cumulative hours per 24 h**, then
  `Service.onTimeout()` fires and you must `stopSelf()` or the system throws.

**So the design is:** the primary upload path is an **in-app foreground drain** with
`expo-keep-awake` and a visible progress bar ("187/200 photos uploaded"), plus a `dataSync`
foreground service for the drive back to the office. `expo-background-task` is only opportunistic
catch-up, never the thing we promise.

### Why not a PWA — four disqualifiers
1. Chrome Background Sync is one-shot; Periodic Background Sync needs install + engagement heuristics.
2. **Origin storage is evictable.** 60–90 MB of photo blobs on a low-storage budget phone can be
   reclaimed by the OS. For *mandatory evidence photos* that is unrecoverable data loss.
3. `getUserMedia` capture is worse than the native camera pipeline and strips EXIF.
4. No reliable wake-on-network.

### Why Expo over Flutter
Team is React-first. Expo SDK 56 restored **task-based transfers in `expo-file-system`**
(`createUploadTask()` / `createDownloadTask()` with progress and `AbortSignal`) — the exact
primitive the uploader needs. EAS Update ships Hermes bytecode diffs (~58% smaller), so surveyors
can be hot-fixed in the field without a Play review.

---

## 3. Photo pipeline

| Concern | Decision |
|---|---|
| Capture | `expo-camera` 57.x, written straight to `FileSystem.documentDirectory` — **never the gallery** |
| Compression | **1600 px long edge, JPEG q0.72 → ~250–400 KB.** Close-up slot (model/serial legibility): **2048 px q0.8 → ~500–700 KB**. Compress **at capture**, not at upload — it halves local storage pressure |
| Volume | 50 fittings × 4 photos = 200 photos ≈ **60–90 MB** per hotel visit |
| EXIF / GPS | Do **not** rely on EXIF for integrity. Store lat/lng/accuracy/timestamp/device-id as **DB columns** next to the `sha256`, and burn a corner stamp (date, GPS, visit ID) into the JPEG so evidence survives being emailed around |
| Dedup + idempotency | SHA-256 of compressed bytes; storage path `surveys/{survey_id}/{fitting_id}/{slot}/{sha256}.jpg`; upload with `upsert: false`; **treat HTTP 409 as success**. Retries can never duplicate |
| Resumable / TUS | Supabase Storage does support TUS, but via `tus-js-client`/Uppy (not `supabase-js.upload()`), with a mandatory 6 MB chunk size, and only recommended above 6 MB. **Our photos are ~300 KB — skip TUS.** Use `supabase-js` `upload()` or `expo-file-system` `createUploadTask()` against `https://<ref>.storage.supabase.co`, retry the whole file |

### The "no photo lost" guarantee
1. The `attachments` row is written **in the same SQLite transaction as the fitting record,
   before the camera preview closes**.
2. The local file is deleted **only** after a successful `HEAD`/list confirms the remote object exists.
3. A startup reconciler scans `documentDirectory` for orphan files and re-enqueues them.
4. **"Submit Visit" is blocked** while any `attachments` row has `status != 'synced'`.

---

## 4. India field gotchas

### OEM battery killers — the #1 real risk
Xiaomi HyperOS/MIUI, Oppo/Realme ColorOS, Vivo Funtouch and Samsung kill background work
aggressively regardless of WorkManager correctness (see dontkillmyapp.com).

**Mitigation:** a mandatory onboarding screen that deep-links to the OEM Autostart/Battery
settings; detect `PowerManager.isIgnoringBatteryOptimizations()` and nag.
**Caution:** `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` is a Play-policy-restricted permission. Our
"upload evidence photos" case is arguable but **budget for a possible Play review rejection**;
the safe fallback is the settings deep-link plus a foreground service, which needs no permission.

### Storage permissions — we need less than you'd think
Because we capture to app-private storage, we need **`CAMERA` only**. No `READ_MEDIA_IMAGES`,
no photo picker, no `MANAGE_EXTERNAL_STORAGE`. **Do not add `expo-media-library`** — it drags in
media permissions and a Play data-safety declaration for nothing.

### Foreground service
Declare `android:foregroundServiceType="dataSync"` plus `FOREGROUND_SERVICE` and
`FOREGROUND_SERVICE_DATA_SYNC` permissions, pass `FOREGROUND_SERVICE_TYPE_DATA_SYNC` to
`startForeground()`, **and declare the FGS use in Play Console → Policy → App content** — this is
required for target 34+ and missing it blocks release. Android 15+ cannot start a `dataSync` FGS
from `BOOT_COMPLETED`.

### GPS integrity
`expo-location` with `Accuracy.Highest`. **Persist `coords.accuracy` and flag check-ins above
~50 m.** Android exposes a mock flag (`isFromMockProvider()`), surfaced as `mocked` on the location
object — **UNVERIFIED** whether `expo-location` still exposes it in SDK 57; if not, a ~30-line Expo
Module wrapping `Location.isMock()` covers it.

Client-side mock detection is defeatable on rooted devices, so add cheap **server-side** checks:
geofence the check-in against the property's stored coordinates, and flag impossible travel speed
between consecutive check-ins. Play Integrity API is the strong control but is overkill unless
REDUX asks.

---

## Sources
- PowerSync pricing · powersync.com/pricing (26 Sep 2026)
- PowerSync attachments · docs.powersync.com/usage/use-case-examples/attachments-files
- Electric docs (read-path sync, new domain) · electric.ax/docs/intro
- npm registry versions for watermelondb, rxdb, @powersync/react-native, @legendapp/state, expo-camera, expo-sqlite, @supabase/supabase-js (26 Sep 2026)
- Expo SDK 56 changelog (file-system upload tasks, EAS Update diffs) · expo.dev/changelog/sdk-56
- Expo BackgroundTask docs · docs.expo.dev/versions/latest/sdk/background-task/
- Google Play target API levels · support.google.com/googleplay/android-developer/answer/11926878
- Android foreground service types · developer.android.com/develop/background-work/services/fgs/service-types
- Android 15 behavior changes (dataSync 6 h cap) · developer.android.com/about/versions/15/behavior-changes-15
- Supabase resumable uploads (TUS) · supabase.com/docs/guides/storage/uploads/resumable-uploads
