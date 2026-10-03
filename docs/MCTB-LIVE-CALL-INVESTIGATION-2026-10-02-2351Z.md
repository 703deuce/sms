# MCTB live call investigation — 2026-10-02 ~23:51 UTC

Copy-paste report for the test call after setup (“voicemail worked, no recovery text”).

---

## What your last test call did (production DB)

Most recent call: **~7:51 PM ET** (2026-10-02T23:51:02Z).

| Field | Value |
|--------|--------|
| **Your cell** | +1 (703) 816-6017 |
| **Number you reached (MCTB ingress)** | +1 (866) 602-0680 |
| **Workspace** | `ws_1` (cert / primary MCTB workspace) |
| **Consent mode** | **Existing permission** (`existing_consent`, not Press-1) |
| **Call length** | ~17 seconds, answered (voicemail greeting played) |
| **Telnyx call id** | `v3:sv4RQTAiTbJo-c-yiE2gJMpDsI7pdNUD6pEn7bX36_M9AZEByRnzdg` |

**Voicemail worked as designed.** A voicemail row was created at **2026-10-02T23:51:22Z** with a ~13s recording and `forwardedTo: +15714776175` (business line **571-477-6175**). That shows the call hit Transovo’s ingress and ran the existing-consent voicemail path.

Hangup webhook: `texml.call.hangup` at **2026-10-02T23:51:20.039Z**, processed at **23:51:21.155Z**.

Payload summary:

- `From`: +17038166017  
- `To`: +18666020680  
- `CallStatus`: completed  
- `CallDuration`: 17  
- `HangupCause`: normal_clearing  

---

## Was it the “wrong” forward number?

**Probably not wrong for voice** — the call reached the correct **toll-free CFNA ingress** for this workspace: **(866) 602-0680**.

That same number is also the **platform text-back sender** on `ws_1`, so setup UI can look like “forward to the texting number.” For MCTB, **forwarding destination = hidden ingress** is intentional; it’s easy to confuse with “the number customers get texts from,” but the call path was correct (voicemail proves it).

On hangup, the webhook did **not** include a carrier **Forwarded-From** / diversion header (`forwardedFromE164: null` on the capture job). Recovery metadata initially used the ingress as `businessE164` until voicemail stored `forwardedTo: +15714776175` correctly.

Ingress phone in DB:

- `+18666020680` → workspace `ws_1` only (no other workspace owns that E.164 in this snapshot).

---

## Why you didn’t get a text

The voice/SMS pipeline **did the right thing up to the queue**, then **stopped because background workers couldn’t run**.

### Timeline

1. **23:51:20Z** — Hangup webhook processed.  
2. **23:51:21Z** — Job enqueued: `mctb_texml_existing_consent_capture` on queue **`voice-calls`**.  
   - Idempotency key: `mctb-texml-capture:ws_1:v3:sv4RQTAiTbJo-c-yiE2gJMpDsI7pdNUD6pEn7bX36_M9AZEByRnzdg`  
   - Status: **`pending`**, **0 attempts**, never completed.  
3. **No `missedCallEvent`** at hangup time (0 recent events for that caller until manual replay).  
4. Worker heartbeat (`sms-dispatch` / `mctb-interactive`):  
   - **`voice-calls` BullMQ metrics: 0 received / 0 completed**  
   - Last dispatch activity ~**23:08:55Z** (before this call)  
   - **`queuedCount`: ~989** pending jobs in cycle metrics  
5. **37** jobs pending on `voice-calls` queue (among broader backlog).

### Root cause (infrastructure)

On Coolify host **`128.140.102.51`**:

- Container **`transovo-bullmq-redis`**: status **unhealthy**  
- Redis logs: **`Write error while saving DB to the disk(rdbSaveRio): No space left on device`**  
- **`df -h /`**: **150G used, 0 bytes available (100% full)**

BullMQ depends on that Redis; with disk full, Redis cannot persist, workers stop draining **`voice-calls`** (and related queues). The MCTB capture job was **never executed**, so no missed-call processing → no recovery SMS.

**Not** the primary explanation: wrong forward number, Press-1 vs existing-consent mismatch on this call (mode was **existing_consent** and voicemail path matched), or TeXML hangup not received.

### Manual replay (agent run, same incident)

After hangup, capture was run once manually against production DB:

- Eligibility: **ELIGIBLE** (`existing_consent`, attestation valid).  
- **Missed call** created: id `cmurmixjf2b314u096z3d5003`, `detectedAt` **2026-10-02T23:58:21.862Z**, `eligible: true`.  
- SMS scheduling still blocked: **BullMQ Redis reconnect loop** (`bullmq_redis_connection_closed` / `No space left on device` from app side).

Voicemail id from the live call: `cmurm9xnh0i6s4y5v2u421h3g` (transcription job also queued).

---

## What to do next (ops)

1. **Free disk on the Coolify server** (`128.140.102.51`) — Docker images/logs, old artifacts, etc. — until Redis can write RDB/AOF again.  
2. **Restart `transovo-bullmq-redis`** and confirm **healthy** (no RDB/AOF write errors in logs).  
3. **Restart SMS/BullMQ worker** (and scheduler if it processes `voice-calls`) so pending jobs drain, including the pending capture job if still `pending`.  
4. **Retest**: call **571-477-6175**, let it ring through to voicemail on ingress; recovery SMS should follow within a short window once workers run.

Optional: after workers are healthy, replay or re-run capture for call sid above if the missed call exists but SMS never sent.

---

## Reference commands (for engineers)

```bash
# Inspect pending capture job
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-check-capture-job.ts

# Quick trace (caller / texml hangups)
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-trace-call-quick.ts

# Dump hangup window
AT=2026-10-02T23:51 NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-dump-texml-hangup.ts

# Post-live SMS inspect (after workers fixed)
WORKSPACE_ID=ws_1 CUSTOMER_PHONE=+17038166017 npx tsx scripts/mctb-lead-recovery-live-inspect.ts
```

Server checks:

```bash
ssh coolify-server 'df -h /'
ssh coolify-server 'docker inspect transovo-bullmq-redis --format "{{.State.Health.Status}}"'
ssh coolify-server 'docker logs transovo-bullmq-redis --tail 30'
```

---

## Governing product note (forwarding vs sender)

Three roles (do not conflate in UI copy):

| Role | This incident |
|------|----------------|
| **Business line** | +15714776175 (on voicemail `forwardedTo`) |
| **Forwarding destination (ingress)** | +18666020680 (what CFNA should target) |
| **Text-back sender** | Often same toll-free on `ws_1` for platform sender — confusing but can be correct |

---

*Generated from production DB + Coolify read-only inspection, 2026-10-03 UTC.*
