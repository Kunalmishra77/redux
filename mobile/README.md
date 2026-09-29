# REDUX Surveyor app (D7)

This is the offline surveyor app, built with Expo SDK 57 for Android. It lives in `mobile/` with its own
`package.json` and lockfile (ADR-014). It is not part of the pnpm workspace. It imports pure pricing
logic from the repo root (`lib/services/`) through Metro `watchFolders`.

## Run it on a phone (Expo Go)

```bash
cd mobile
cp .env.example .env        # fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
npm install
npx expo start              # scan the QR code with Expo Go (Android)
```

Sign in with `ankit@redux.demo` or `sunil@redux.demo`. The password is the demo password the team
already has; it is never committed.

### "Can't reach the REDUX server" on home Wi-Fi
Some Indian ISPs hijack DNS for `*.supabase.co`, so the app can't connect over home Wi-Fi. On the
phone, either:
- use **mobile data**, or
- set **Settings → Network & internet → Private DNS → `dns.google`**.

The app still works offline. Everything is saved on the phone and uploads once it can reach the server.

## Checks

```bash
npx tsc --noEmit
npx expo-doctor
npx expo export --platform android   # proves the bundle builds
```

## How it works

| Piece | File |
|---|---|
| Local SQLite store (surveys, units, masters, rate card, fittings, attachments, outbox) | `src/lib/db.ts` |
| Download (visits, masters, active rate card) | `src/lib/pull.ts` |
| Local writes: each one is a single transaction of local rows plus outbox rows | `src/lib/repo.ts` |
| Outbox drain (FIFO per survey, idempotent, backoff, "needs attention") | `src/lib/sync.ts` |
| Photo capture and compression (1600 px q0.72, close-up 2048 px q0.8), sha256 | `src/lib/photos.ts` |
| Offline three-price assessment (shared with the web) | `../lib/services/assessment-pricing.ts` |

Photos: capture → compress → app document directory → draft row. Saving the fitting writes the
fitting, its conditions, its assessment, 4 attachment rows and every outbox row in one SQLite
transaction. When the outbox reaches a photo, the app uploads it to
`survey-photos/surveys/{survey}/{fitting}/{slot}/{sha256}.jpg` with `upsert: false` (a 409 counts as
success), then confirms the object exists, then inserts the `fitting_photos` row. **Only after that** is
the local file deleted.
