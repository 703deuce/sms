# MCTB Direct Telnyx Test — Certification Report

> Fill after completing 5 consecutive forwarded PSTN tests.  
> Experiment is **not proven** until 5/5 PASS without LiveKit.

**Date:** _______________  
**Tester:** _______________  
**Environment:** production / staging  

---

## Summary

| Field | Value |
|-------|-------|
| **LiveKit required for MCTB** | YES / NO / **NOT YET PROVEN** |
| **5-call reliability** | _/5 PASS |
| **Root cause of previous drop** | FQDN late-media (3PCC+PRACK+183) / LiveKit / inconclusive |

---

## Current path (production — unchanged)

```
Carrier forward → Telnyx → FQDN 3022029259041408870 → LiveKit SIP → Python MCTB worker
```

---

## Direct test path

```
Carrier forward → Telnyx → FQDN 3022029259041408870 (3PCC+PRACK)
  → webhook /api/telnyx/voice/mctb-direct-telnyx-test
  → answer + hold 15s → normalized event (no SMS)
  → NO LiveKit
```

**Test number:** `+18553103375`  
**Flags:** `MCTB_DIRECT_TELNYX_TEST=1`

---

## Changes made (this PR)

- Test-only handler + webhook route (gated by env flag)
- FQDN setup/rollback scripts for 855 TFN
- Signaling instrumentation logs
- Audit + live test runbooks

**Production defaults:** unchanged. LiveKit path not removed.

---

## Tests run

| Test | Result |
|------|--------|
| `npx tsx scripts/test-mctb-direct-telnyx-handler.ts` | |
| Telnyx setup dry-run | |
| Telnyx setup `--apply` | |
| Live PSTN call 1 | |
| Live PSTN call 2 | |
| Live PSTN call 3 | |
| Live PSTN call 4 | |
| Live PSTN call 5 | |

---

## Live PSTN results

### Call 1
- callControlId:
- forwardedFrom:
- holdDurationMs:
- hangupCause:
- LiveKit room created? yes / no
- **PASS / FAIL**

### Call 2–5
_(repeat or attach log excerpts)_

---

## Signaling timeline (best failed call, if any)

| Timestamp | Event | SIP notes |
|-----------|-------|-----------|
| | INVITE received | SDP? |
| | 180/183 sent | PRACK? |
| | 200 OK / ACK | |
| | Media established | |
| | Disconnect | SIP code |

---

## If successful — architecture notes

1. **Exact successful path:** _fill after 5/5_
2. **Why LiveKit was unnecessary:** _fill_
3. **Signaling component that prevented drop:** _likely Telnyx FQDN 3PCC+PRACK_
4. **Productionization requirements:** _fill_
5. **What stays for AI voice only:** LiveKit worker, generic receptionist
6. **Flow Builder trigger ready?** `call.missed` / `call.forwarded_unanswered` — yes, event shape compatible
7. **Template "Missed Call Text Back":** not added (per scope)

---

## If failed — next experiment

| Item | Detail |
|------|--------|
| Where call died | |
| SIP disconnect code | |
| SDP/PRACK/183 occurred? | |
| What LiveKit provides that direct path lacks | |
| Smallest next experiment | |

---

## Files changed

- `src/lib/mctb/direct-telnyx-test/*`
- `src/app/api/telnyx/voice/mctb-direct-telnyx-test/route.ts`
- `src/lib/messaging/telnyx/config.ts`
- `scripts/mctb-setup-direct-telnyx-test-800.ts`
- `scripts/mctb-rollback-direct-telnyx-test-800.ts`
- `scripts/test-mctb-direct-telnyx-handler.ts`
- `docs/MCTB-DIRECT-TELNYX-*.md`

---

## Commands / env vars

```bash
# Enable (transovo-web)
MCTB_DIRECT_TELNYX_TEST=1
MCTB_DIRECT_TELNYX_TEST_E164S=+18553103375
MCTB_DIRECT_TELNYX_TEST_EMIT_SMS=0

# Telnyx cutover
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
  npx tsx scripts/mctb-setup-direct-telnyx-test-800.ts --apply

# Unit test
npx tsx scripts/test-mctb-direct-telnyx-handler.ts

# Rollback
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
  npx tsx scripts/mctb-rollback-direct-telnyx-test-800.ts --apply
```

---

## Manual testing required

- [ ] Deploy transovo-web with test route
- [ ] Set env flags
- [ ] Run setup script `--apply`
- [ ] Configure conditional forward to 855
- [ ] Execute 5 forwarded PSTN calls per live test runbook
- [ ] Rollback Telnyx + unset env when done
