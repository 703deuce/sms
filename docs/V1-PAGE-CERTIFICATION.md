# V1 Page Certification Matrix

Generated from `scripts/v1-full-application-cert.mjs` against **https://transovo.ai** (pre-deploy of this branch) and local dev smoke runs.

**Auth method:** `smoke-signup` with bootstrap token (isolated cert workspace — not the HP 571 production workspace).

| Page | Loads | Backend | Actions | Browser | Mobile | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Dashboard | PASS | PASS | partial | PASS | PASS | **PARTIAL** — deploy HP metrics fix |
| Conversations (`/conversations`) | **FAIL 404** | — | — | — | **FAIL** | **FIX PENDING DEPLOY** — use `/inbox` on prod until merge |
| Campaigns + tabs | PASS | PASS | composer PASS | PASS | PASS | **PASS** |
| Send / Quick / AI | PASS | blocked* | — | PASS | PASS | **PARTIAL** — SMS needs cert account or deploy |
| Templates | PASS | PASS | form PASS | PASS | — | **PASS** |
| Contacts + tabs | PASS | PASS | add contact flake | PASS | PASS | **PARTIAL** |
| Imports | PASS | — | upload flake | PASS | — | **PARTIAL** |
| Automations / Builder | PASS | PASS | builder nodes flake | PASS | — | **PARTIAL** — retest after deploy |
| Lead capture (grow/*) | PASS | — | — | PASS | — | **PASS** |
| Numbers / Buy (search only) | PASS | — | search flake | PASS | — | **PARTIAL** — no purchase |
| Compliance + tabs | PASS | PASS | readiness fix in branch | PASS | — | **PARTIAL** — deploy check page fix |
| Integrations + tabs | PASS | — | — | PASS | — | **PASS** |
| Analytics (`/analytics`) | **FAIL 404** | — | — | **FAIL** | **FAIL** | **INVESTIGATE** — route exists in code |
| Reports (campaigns/messages/automations) | PASS | — | — | PASS | — | **PASS** |
| Settings + tabs | PASS | — | — | mixed 401 smoke | — | **PARTIAL** |
| Billing | PASS | — | — | PASS | — | **PASS** |
| Mass Texting landing | PASS | — | — | PASS | — | **PASS** |
| MCTB module | skipped | skipped | skipped | skipped | skipped | **SKIPPED** (user verified) |

\* Smoke workspace lacks Telnyx A2P registration; use `CERT_EMAIL`/`CERT_PASSWORD` for real workspace or `/api/cert/send-sms` after deploy.

## Action matrix (controlled tests)

| Feature | Action | Result |
| --- | --- | --- |
| Auth | smoke-signup session | **PASS** |
| Header | No Personal/Business toggle | **PASS** |
| SMS | Send to +15714776175 from HP 571 | **PENDING DEPLOY** (`/api/cert/send-sms` + demoBypass) |
| Contacts | Add contact modal | **PARTIAL** (timing on prod) |
| Campaign | Composer input | **PASS** |
| Flow builder | Drag + connect + test SMS | **PARTIAL** — retest on deploy |
| Numbers | Buy search (no purchase) | **PARTIAL** |

## After deploy checklist

1. Merge `pr-276` + this cert branch to `master` and deploy transovo-web.
2. Add to `.env.local` (optional, for real-workspace browser cert):
   - `CERT_EMAIL` / `CERT_PASSWORD` — your admin account with HP 571
3. Run: `BASE_URL=https://transovo.ai npm run test:v1-full-application-cert`
4. Confirm SMS received on **571-477-6175** from **571-407-3615**.

## Backend certification (local, with `.env.local`)

`npm run test:sms-product-certification` → **18 PASS, 0 FAIL, 1 BLOCKED** (db:push opt-in).
