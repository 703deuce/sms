# MCTB Direct Telnyx — Live PSTN Test Procedure

Manual test for the **non-destructive isolation experiment**: forwarded call survives on FQDN 3PCC **without LiveKit**.

No code edits required after deployment — only env vars and Telnyx setup script.

---

## Prerequisites

1. **Deploy** `transovo-web` with the `mctb-direct-telnyx-test` route.
2. **Set env on transovo-web** (Coolify):
   ```
   MCTB_DIRECT_TELNYX_TEST=1
   MCTB_DIRECT_TELNYX_TEST_E164S=+18553103375
   MCTB_DIRECT_TELNYX_TEST_EMIT_SMS=0
   MCTB_DIRECT_TELNYX_TEST_HOLD_MS=15000
   ```
3. **Run Telnyx cutover** (once):
   ```bash
   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
     npx tsx scripts/mctb-setup-direct-telnyx-test-800.ts --apply
   ```
4. Confirm platform **571 is NOT on the same FQDN** during test (setup script warns if it is).

---

## 1. Test destination number

| Role | Number |
|------|--------|
| **Transovo test ingress (forward TO)** | `+1-855-310-3375` (`+18553103375`) |
| **Your business line (forward FROM)** | Your normal mobile — configure conditional forward on device/carrier |
| **Do NOT use** | `+15714073615` (571 platform demo) |

---

## 2. Feature flags / env vars

| Variable | Value | Purpose |
|----------|-------|---------|
| `MCTB_DIRECT_TELNYX_TEST` | `1` | Enable direct handler |
| `MCTB_DIRECT_TELNYX_TEST_E164S` | `+18553103375` | Only this DID is handled |
| `MCTB_DIRECT_TELNYX_TEST_EMIT_SMS` | `0` | No customer SMS (default) |
| `MCTB_DIRECT_TELNYX_TEST_HOLD_MS` | `15000` | Stability checkpoint at 15s |

---

## 3. Start server / runtime

Production: ensure **transovo-web** is deployed with the env above.

Local (not recommended for real PSTN): same env + public `APP_URL` reachable by Telnyx webhooks.

**Do not** need transovo-voice / LiveKit worker for this test.

---

## 4. Logs to watch

Stream transovo-web logs and filter:

```bash
# PASS patterns
grep 'mctb-direct-telnyx-test' 
grep 'call_initiated'
grep 'answer_command_sent'
grep 'call_answered'
grep 'hold_stability_checkpoint'
grep 'normalized_automation_event'
```

Key JSON fields per call:

- `callControlId`, `forwardedFrom`, `sipHeaders`
- `signalingHints.supported100rel`, `signalingHints.prackMentioned`
- `holdDurationMs`, `livekitRoomCreated: false`
- `kind`: `call.forwarded_unanswered` or `call.missed`

Optional post-call audit:

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
  npx tsx scripts/audit-mctb-forwarded-call-signaling.ts \
  --transovo-e164 +18553103375 --hours 1
```

---

## 5. Conditional forward configuration

On **your phone** (AT&T / carrier):

1. Enable **conditional forward on no answer** (or busy) to `+1-855-310-3375`.
2. Use carrier dial codes if needed (e.g. `*61*18553103375#` on AT&T — verify with your carrier).

---

## 6. What to do during each test call

1. From a **second phone**, call your business line.
2. Let it ring — **do not answer**.
3. Wait for forward to 855 (you may hear ringback).
4. Stay on the line **at least 15 seconds** after connect.
5. Hang up (either side).
6. Record PASS/FAIL for this attempt.
7. Repeat **5 times** (reliability gate).

---

## 7. PASS criteria (single call)

All must be true:

| Check | Log / evidence |
|-------|----------------|
| Forward reached Transovo | `call_initiated` with `to: +18553103375` |
| Forward metadata present | `forwardedFrom` or Diversion header |
| Call not dropped immediately | `call_answered` within ~5s of initiated |
| Our app answered | `answer_command_sent` |
| Held ≥15s | `hold_stability_checkpoint` with `status: PASS_HOLD_THRESHOLD` |
| No LiveKit | No `mctb-sip-e2e` / `worker_job_received` for this call |
| Final outcome | `call_hangup` + `normalized_automation_event` |
| Hold duration | `holdDurationMs` ≥ 10000 |

---

## 8. FAIL criteria

| Symptom | Likely cause |
|---------|--------------|
| No `call_initiated` | Wrong number assignment or webhook URL |
| `call_initiated` then immediate `call_hangup` &lt;3s | PROGRESS_TIMEOUT / signaling regression |
| `answer_command_failed` | Call Control API issue |
| `holdDurationMs` &lt; 5000 | Carrier dropped forward leg |
| LiveKit worker logs for same call | LiveKit not bypassed — check 3PCC webhook |
| 403 from webhook | `MCTB_DIRECT_TELNYX_TEST` not set |

---

## 9. Five-call reliability matrix

| # | Time | callControlId | holdDurationMs | PASS? | Notes |
|---|------|---------------|----------------|-------|-------|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |

**Experiment proven:** 5/5 PASS with no LiveKit rooms.

---

## 10. Rollback

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
  npx tsx scripts/mctb-rollback-direct-telnyx-test-800.ts --apply
```

Unset `MCTB_DIRECT_TELNYX_TEST` on transovo-web.

---

## 11. After test — fill certification report

See `docs/MCTB-DIRECT-TELNYX-CERT-REPORT.md`.
