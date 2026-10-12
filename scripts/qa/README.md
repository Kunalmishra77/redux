# QA scripts (browser, against the live demo)

| Script | What it proves |
|---|---|
| `golden-path.mjs` | J-A…J-H: website enquiry → call → on-site survey (the surveyor app's calls) → quote → OTP approval → job → handover → invoice → payment |
| `golden-path-b2b.mjs` | J-I (CR-001): referral link → registration → self-assessment → referral 5% quote → free demo → approval converts demo and referral → job → invoice → payment → referrer credit → "Request again" |
| `page-audit.mjs` | Every CR-001 page, desktop and phone: HTTP errors, console errors, sideways scroll, clipped text, broken images; screenshots in `audit/` |

They need Playwright and supabase-js, which are **not** project dependencies — run them from a
scratch folder that has `playwright` and `@supabase/supabase-js` installed, with the project's env:

```
node --import file:///<repo>/scripts/dev/supabase-dns.mjs --env-file=<repo>/.env.local golden-path-b2b.mjs
```

Each run creates a new customer: pass a never-used mobile (`GP_PHONE=98112046xx`) and name
(`GP_HOTEL=…` / `GP_NAME=…`). Nothing here holds a credential; the scripts read the environment.
