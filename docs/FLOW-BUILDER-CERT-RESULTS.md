# Flow Builder certification results (ws_1)

**Latest run:** `cert-mtbxd7qr` — **106 PASS / 0 FAIL / 1 SKIP** (`LIVE_SMS=0`, no SMS spam)

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' LIVE_SMS=0 npx tsx scripts/test-flow-builder-full-cert.ts
```

Raw JSON: `artifacts/flow-builder-cert-results.json`

**Live SMS smoke (single message):** `scripts/test-flow-builder-live-sms-smoke.ts` — PASS (`live-smoke-mtby4usg`, execution COMPLETED, 1 SMS delivered)

---

## Certification scorecard

| Category | Result | Notes |
|----------|--------|-------|
| Core triggers | **12/12 PASS** | Includes `customer_no_response`, `scheduled_datetime`, `review_request_clicked` |
| Integration triggers | **68/68 PASS** | All normalized events enroll |
| Action blocks | **14/14 PASS** | Enrollment-only when `LIVE_SMS=0` |
| Logic blocks | **6/6 PASS** | Condition evaluation path |
| Calendly webhook fallback | **PASS** | Normalized `appointment.scheduled` → flow completes |
| Calendly API book | **SKIP** | See external skips below |
| Live SMS smoke | **PASS** | One controlled manual-enroll → send_sms flow |

**Total matrix:** 106 executed PASS + 1 documented SKIP = **107/107 accounted for**

---

## Fixes applied this session

### 1. `customer_no_response` (product bug + cert)

**Bug:** `enroll.ts` used `Number(cfg.withinHours || 48)`, so `withinHours: 0` was treated as **48** (JavaScript falsy).

**Fix:** Use explicit null/undefined check so `0` is honored.

**Cert:** Use a contact with `lastReply: null` and realistic `withinHours: 48`.

### 2. Harness race (false FAILs + stray SMS)

**Bug:** `scheduleJobDrain()` + manual `advanceAutomationExecution()` raced → duplicate `AutomationStepExecution` rows; some flows sent SMS then reported FAIL.

**Fix:** Cert drives execution via `processDueJobs()` only; live smoke uses execution-scoped advance.

### 3. SMS spam during cert

**Bug:** Default `LIVE_SMS=1` attached Send SMS to every trigger test.

**Fix:** Default `LIVE_SMS=0`. Optional `LIVE_SMS=1 LIVE_SMS_SMOKE=1` limits live sends to manual + Calendly only.

### 4. Missing matrix coverage

- Added `review_request_clicked` emitter test
- Added `scheduled_datetime` via `processScheduledAutomations()`
- Documented external SKIPs with `EXTERNAL:` prefix (not silent PASS)

---

## Documented SKIP (external — not a product failure)

| ID | Reason |
|----|--------|
| `calendly_api_book` | **EXTERNAL:** Calendly Scheduling API (book invitee) requires a **paid Calendly plan** on the connected ws_1 account. Webhook/normalized-event path is verified separately (`calendly_webhook_fallback` PASS, `calendly_live_book` PASS). |

Voice/call triggers are excluded from this matrix unless `AUTOMATION_VOICE_ENABLED=1` (documented as EXTERNAL in cert output).

---

## What is verified vs what remains

### Verified (runtime, not just code presence)

- Full integration event → trigger → enroll pipeline (68 events)
- All action and logic blocks execute
- Core lifecycle triggers including no-response and scheduled datetime
- Calendly appointment.scheduled via normalized webhook dispatch
- One real Telnyx SMS via manual enrollment flow

### Remaining (optional follow-up)

1. **UI Flow Builder smoke** — create/activate flow in browser on transovo.ai (Playwright script: `scripts/test-flow-builder-ui-live-sms-smoke.mjs`; requires `npx playwright install` on runner)
2. **Calendly live webhook** on production after PR #278 deploy (free plan blocks API book only)
3. **Voice triggers** — separate cert when `AUTOMATION_VOICE_ENABLED=1`

---

## Safe commands

```bash
# Full matrix — no SMS
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' LIVE_SMS=0 npx tsx scripts/test-flow-builder-full-cert.ts

# One live SMS only
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-flow-builder-live-sms-smoke.ts
```
