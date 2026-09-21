# Voice V3 PSTN — investigation, fixes, deploy, and post-deploy call forensics

**Date (UTC):** 2026-09-21  
**Production host:** Coolify `128.140.102.51` (`ssh coolify-server`)  
**Repo:** `703deuce/sms` @ `master`

This document is a single copy-paste record of what was diagnosed, fixed, deployed, and read back from logs + database for your PSTN test calls on 2026-09-21.

---

## 1. Original problem (first call ~11:31 UTC) — tools never reached calendar

### Symptom

Amy could not “pull up the schedule.” Microsoft/calendar was configured on the web side, but **no** `execute_voice_v3_livekit_tool` / Microsoft FIND ran.

### Root cause (Python voice worker)

LiveKit failed **before** executing any `FunctionTool`:

```text
NameError: name 'VoiceV3CallForensics' is not defined
```

Stack: `prepare_function_arguments` → `get_type_hints()` on tool closures in `voice-runtime-python/transovo_voice/voice_v3/tools.py`.

`VoiceV3CallForensics` was imported only under `TYPE_CHECKING`, but closure kwargs used annotated defaults like `_forensics: "VoiceV3CallForensics | None"`, which LiveKit evaluates at runtime.

### Affected call (broken worker)

| Field | Value |
|--------|--------|
| Room suffix | `RRv9gUcggNAi` |
| LiveKit job | `AJ_U68XYzTFWnzz` |
| Window (UTC) | ~11:31:36 – 11:33:16 |
| Worker image at time | `282a2e48…` (forensics PR, broken typing) |

Tools that failed in logs included `update_intake`, `set_scheduling_preference` (and would have blocked `find_availability` the same way).

### Fix (tools)

**Commit:** `9bdb8b2219d8b344e0f9c46eb2cb748f63865b96`  
**Change:** Runtime import of `VoiceV3CallForensics` in `tools.py` (same pattern as `session.py`); remove `TYPE_CHECKING`-only import.

**File:** `voice-runtime-python/transovo_voice/voice_v3/tools.py`

---

## 2. Secondary problem — transcript persist “integer out of range”

### Symptom

Web logs: `VOICE_V3_FORENSICS_TRANSCRIPT_FAILED` — Postgres `Int` overflow on `VoiceTranscriptSegment.startMs` / `endMs`.

### Root cause

LiveKit conversation metrics expose `started_speaking_at` / `stopped_speaking_at` as **wall-clock epoch seconds** (~1.7e9). `forensics-persist.ts` multiplied by 1000 → ~1.7e12, exceeding PostgreSQL `integer` max (2,147,483,647).

### Fix (transcript timestamps)

**Commit:** `56bda9063dcef0c6eb6fda0246fa2bf2ca16f579`  
**Change:** `speechTimestampToSegmentMs()` — epoch seconds → call-relative ms using anchor; small values → relative seconds × 1000.

**Files:**

- `src/lib/voice-v3/telemetry/forensics-persist.ts`
- `scripts/test-voice-v3-forensics-sol-export.ts` (guards)

---

## 3. Git / deploy state

| Item | Value |
|------|--------|
| `master` after fixes | `56bda9063dcef0c6eb6fda0246fa2bf2ca16f579` (includes `9bdb8b22` tools fix) |
| Voice worker container (post-deploy) | `tgjridm6vrmrgljkfrr0rpjn-113845871330` |
| Voice image tag | `tgjridm6vrmrgljkfrr0rpjn:56bda9063dcef0c6eb6fda0246fa2bf2ca16f579` |
| Web container (example) | `ds8s3hjin60qs6g7s0iqkixs-113909393662` |

### Coolify voice deploy notes

- Voice app id **2** (`transovo-voice`); auto-deploy off — **manual** queue + dispatch required.
- Deploy queue **#3044** failed: commit `9bdb8b22` (short SHA) → `fatal: couldn't find remote ref 9bdb8b22` (use **full** SHA).
- Deploy queue **#3046** queued with full SHA `56bda9063dcef0c6eb6fda0246fa2bf2ca16f579` and dispatched.

**Dispatch pattern (on Coolify host):**

```bash
# Insert queue row (application_id=2), then:
docker exec coolify php artisan tinker --execute="App\\Jobs\\ApplicationDeploymentJob::dispatch(<queue_id>);"
```

See: `docs/COOLIFY-TRANSOVO-VOICE-WORKER.md`, `docs/CURSOR-CLOUD-COOLIFY-DEPLOYMENT.md`

---

## 4. Post-deploy success call — full forensics (~11:50–11:53 UTC)

This is the call you made **after** the voice worker was on `56bda906`.

### Call identity

| Field | Value |
|--------|--------|
| **Live session / `VoiceCall` id** | `lk_transovo-call-<caller_e164>_YUoMbNMpscEF` |
| **Room suffix** | `YUoMbNMpscEF` |
| **LiveKit job** | `AJ_Gm49cC9T83Gs` |
| **Workspace / agent** | `ws_1` / `cmshz2lc25c622c4i58303501` |
| **Dialed line** | `+15717491060` |
| **GPT-Live session** | `live_u1_EQWpLp3oMnE5c16ewwK9pR2ItHUyDYxg` |
| **DB status** | `COMPLETED` |

### End-to-end timing (wall clock, UTC)

| Milestone | Time (UTC) |
|-----------|------------|
| LiveKit job received | **11:50:20.202** |
| `VoiceCall.startedAt` | **11:50:22.709** |
| Session bootstrap (worker `voice_v3_session_starting`) | **11:50:23.013** |
| Caller disconnect (`VOICE_V3_CALLER_DISCONNECTED`) | **11:53:09.835** |
| `VoiceCall.endedAt` | **11:53:33.807** |

**Duration**

- Caller on line (job → disconnect): **~2 min 50 sec**
- DB record (startedAt → endedAt): **~191.1 sec (~3 min 11 sec)**

### Models

| Layer | Model / voice |
|--------|----------------|
| Realtime (phone / Amy) | **`gpt-live-1`**, voice **`vesper`** |
| Backend delegated tools | **`gpt-5.6-sol`** (`reasoning.effort=none` per delegation config) |

Forensics bootstrap events include: `backend_model: "gpt-5.6-sol"`, `live_voice_id: "vesper"`.

### Tools — did calendar work?

**Yes.** No `NameError`. Worker logs show `execute_voice_v3_livekit_tool` with HTTP 200. Web logs show `provider: 'microsoft'` for booking path.

| Tool | Result | Latency (forensics) |
|------|--------|---------------------|
| `update_intake` | OK (`INTAKE_UPDATED`) | ~10–25 ms (multiple) |
| `set_scheduling_preference` | OK | ~4–36 ms |
| **`find_availability`** | **`available`** | **~1503 ms** |
| `book_appointment` (early) | `not_ready` / `MISSING_REQUIRED_INFORMATION` | ~5–17 ms |
| **`book_appointment` (final)** | **`confirmed`** | **~1748 ms** (Node), ~1762 ms (worker) |

**Monotonic ms from call start (forensics):**

- ~**79,607** — `find_availability` started  
- ~**81,110** — find completed (`available`)  
- ~**94,818** — first `book_appointment` failed (not ready)  
- ~**151,150** — **`book_appointment` → `confirmed`**

Function call IDs (from forensics):

- Find: `call_xq0LGfhLbaiTsFJIvqZXnLBL`
- Failed book: `call_MQbbvUPqwkd3j9dCTX8329aa`
- Successful book: `call_1BDkxWt1avDQjx2NRq2WzCRY`

### Caller turn spacing (gaps between committed caller turns)

Monotonic ms from session start; 21 caller commits:

| Turn transition | Gap (ms) | Gap (approx sec) |
|-----------------|----------|------------------|
| 1 → 2 | 8559 | 8.6 s |
| 2 → 3 | 8333 | 8.3 s |
| 3 → 4 | 11411 | 11.4 s |
| 4 → 5 | 2232 | 2.2 s |
| 5 → 6 | 8725 | 8.7 s |
| 6 → 7 | 6376 | 6.4 s |
| 7 → 8 | 1631 | 1.6 s |
| 8 → 9 | 1196 | 1.2 s |
| 9 → 10 | 12615 | 12.6 s |
| 10 → 11 | 1741 | 1.7 s |
| 11 → 12 | 22924 | 22.9 s |
| 12 → 13 | 12177 | 12.2 s |
| 13 → 14 | 2147 | 2.1 s |
| 14 → 15 | 3696 | 3.7 s |
| 15 → 16 | 5553 | 5.6 s |
| 16 → 17 | 8216 | 8.2 s |
| 17 → 18 | 1180 | 1.2 s |
| 18 → 19 | 1402 | 1.4 s |
| 19 → 20 | 17206 | 17.2 s |
| 20 → 21 | 19116 | 19.1 s |

First caller utterance committed ~**6.8 s**; first agent greeting ~**14.0 s** monotonic (~7 s after first speech).

Turn 11 forensics note: `backendOperationsDispatched` includes a **find** operation for today’s window (13:00–21:00Z range in timing payload).

### Conversation summary (transcript on `VoiceCall`)

Caller booked for toilet leak; agent offered **10 AM today**; caller accepted; collected name **Anthony Johnson**, phone, email **deuce@gmail.com**, address **123 Main Street, Alexandria, Virginia**; security question mother’s name **Harriet**. Transcript stored on call record.

### Did it really book?

| Source | Verdict |
|--------|---------|
| `book_appointment` tool result | **`confirmed`** (Microsoft provider in web logs) |
| `VoiceCall.appointmentBooked` | **`false`** (flag not updated) |
| `voice_appointments` row for `callId` | **None found** in queried window |
| `voiceToolExecution` rows for this `callId` | **0** (tool trace may use different persistence path) |

**Practical check:** Microsoft 365 calendar for WS1 Cert — Anthony Johnson, today 10:00, deuce@gmail.com, 123 Main St Alexandria VA, created ~**11:52 UTC**.

### Forensics package

Stored under `VoiceCall.metadata.voiceV3Forensics`:

- Large `events` array (node + python duplicates on some kinds)
- `canonicalTurns`, `callerTurnTiming` (21 rows)
- `gptLiveUsage` / session usage for `gpt-live-1`
- Bootstrap: `VOICE_V3_SESSION_BOOTSTRAP_START` with Sol + vesper

---

## 5. Other calls same day (context)

### Failed SIP wait (not calendar)

| Field | Value |
|--------|--------|
| Room suffix | `AfS4d7Bg7GaC` |
| Job | `AJ_CKUrjMMBW54Q` |
| Issue | `TimeoutError` waiting for SIP participant (20 s) |

### Broken tools call (pre-hotfix)

| Field | Value |
|--------|--------|
| Room suffix | `RRv9gUcggNAi` |
| Job | `AJ_U68XYzTFWnzz` |
| Window | ~11:31 – 11:33 UTC |
| Issue | `VoiceV3CallForensics` NameError — no backend tools |

---

## 6. Commands used for investigation (repro)

```bash
# Voice worker logs
ssh coolify-server 'docker ps --filter name=tgjridm6vrmrgljkfrr0rpjn --format "{{.Names}} {{.Image}}"'
ssh coolify-server 'docker logs --since 2h <voice-container> 2>&1 | grep -E "voice_v3_session_starting|execute_voice|NameError|VOICE_V3_CALLER_DISCONNECTED"'

# Web logs
ssh coolify-server 'docker logs --since 2h <web-container> 2>&1 | grep -E "find_availability|book_appointment|gpt-5.6-sol|microsoft"'

# DB (from dev/CI machine with DATABASE_URL)
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/inspect-last-voice-v3-call.ts
```

Local unit check (no full server build):

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-forensics-sol-export.ts
cd voice-runtime-python && python3 -c "from transovo_voice.voice_v3.tools import build_livekit_tools; print('ok')"
```

---

## 7. Short checklist answers

| Question | Answer |
|----------|--------|
| Original tool failure fixed? | **Yes** — `9bdb8b22` / in worker `56bda906` |
| Transcript integer overflow fixed? | **Yes** — `56bda906` |
| Post-deploy call used calendar? | **Yes** — find + book confirmed |
| Backend model | **`gpt-5.6-sol`** (tools); **`gpt-live-1`** + **vesper** (voice) |
| Call length | **~3 min 11 s** (DB); **~2 min 50 s** on line |
| Book confirmed at runtime? | **Yes** (`book_appointment` → `confirmed`, Microsoft) |
| `appointmentBooked` / `voice_appointments` | **Not updated** — follow-up persistence gap |

---

## 8. Optional follow-up (not done in this pass)

- Wire `VoiceCall.appointmentBooked` (and/or `voice_appointments`) when `book_appointment` returns `confirmed`.
- Ensure `voiceToolExecution` rows attach to V3 `callId` for ops UI.
- Coolify deploy: always pass **full** git SHA in `application_deployment_queues.commit`.

---

*Generated from production SSH logs, Coolify container tags, and `VoiceCall` + forensics metadata queries on 2026-09-21.*
