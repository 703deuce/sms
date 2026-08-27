# V1 Page Certification Matrix

**Last run:** 2026-08-27 against **https://transovo.ai** (post-deploy `master`).

**Auth:** `DEV_AUTH_BYPASS` via `/api/auth/dev-bypass` — owner account `703deuce@gmail.com`, business workspace `ws_1` (HP **+15714073615**).

**Overall:** **PASS** — routes 76/76, actions 14/14, gates 4/4 (`artifacts/v1-full-application-cert.json`).

| Page | Loads | Actions | Browser | Mobile | Status |
| --- | --- | --- | --- | --- | --- |
| Dashboard | PASS | HP/A2P not falsely blocked | PASS | PASS | **PASS** |
| Conversations (`/conversations`) | PASS | — | PASS | PASS | **PASS** |
| Campaigns + tabs | PASS | — | PASS | PASS | **PASS** |
| Send / Quick / AI | PASS | 571 in UI | PASS | PASS | **PASS** |
| Templates | PASS | — | PASS | — | **PASS** |
| Contacts + tabs | PASS | add contact modal | PASS | PASS | **PASS** |
| Imports | PASS | upload control | PASS | — | **PASS** |
| Automations / Builder | PASS | create, save, connect, test SMS | PASS | — | **PASS** |
| Lead capture (grow/*) | PASS | — | PASS | — | **PASS** |
| Numbers / Buy (search only) | PASS | search UI (no purchase) | PASS | — | **PASS** |
| Compliance + tabs | PASS | preferred sending number check | PASS | — | **PASS** |
| Integrations + tabs | PASS | — | PASS | — | **PASS** |
| Analytics (`/analytics`) | PASS | — | PASS | PASS | **PASS** |
| Reports (campaigns/messages/automations) | PASS | — | PASS | — | **PASS** |
| Settings + tabs | PASS | — | PASS | — | **PASS** |
| Billing | PASS | — | PASS | — | **PASS** |
| Mass Texting landing | PASS | — | PASS | — | **PASS** |
| MCTB module | skipped | skipped | skipped | skipped | **SKIPPED** (user verified) |

## Action matrix (controlled tests)

| Feature | Action | Result |
| --- | --- | --- |
| Auth | dev-bypass (703deuce@gmail.com) | **PASS** |
| Header | No Personal/Business toggle | **PASS** |
| SMS | Send to +15714776175 from HP +15714073615 | **PASS** |
| Contacts | Add contact modal | **PASS** |
| Flow builder | Add blocks, save, connect edge, test SMS | **PASS** |
| Numbers | Buy search (no purchase) | **PASS** |

## Run again

```powershell
$env:BASE_URL="https://transovo.ai"
npm run test:v1-full-application-cert
```

Production Coolify (`transovo-web`) needs:

- `DEV_AUTH_BYPASS=1`
- `DEV_AUTH_BYPASS_EMAIL=703deuce@gmail.com`
- `APP_URL=https://transovo.ai` (avoids `0.0.0.0` redirect on bypass)

## Backend certification (local, with `.env.local`)

`npm run test:sms-product-certification` → **18 PASS, 0 FAIL, 1 BLOCKED** (db:push opt-in).
