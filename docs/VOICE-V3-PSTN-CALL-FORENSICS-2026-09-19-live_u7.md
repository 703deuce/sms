# Voice V3 PSTN call forensics — 2026-09-19

**Purpose:** Full trace of the post–PR #431 (`59744238`) PSTN booking smoke call.  
**Sources:** Coolify container logs (`ds8s3hjin60qs6g7s0iqkixs-073532389098`), production DB via `docker exec`, `src/lib/voice-v3` telemetry/tool logging.

---

## Executive answer

**Yes — the booking was real.** Runtime logs show a successful `book_appointment` (`confirmed`), `BOOKING_REVALIDATION_PASSED`, `MICROSOFT_EVENT_CREATED`, and `BOOKING_CONFIRMED`, with Microsoft Graph `provider_event_id`:

`AQMkADAwATM0MDAAMi1hOWY1LTY3MzEtMDACLTAwCgBGAAADxtFon5XuVEalmlhPr1nWBgcAs2vWk3hKT02vN5c-Q6OlzQAAAgENAAAAs2vWk3hKT02vN5c-Q6OlzQAAAEiPQ9oAAAA=`

Amy’s “you’re booked” matched backend state.

**All 8 tool runs succeeded** (0 `VOICE_TOOL_EXECUTION_FAILED`). The new scheduling path worked: `set_scheduling_preference` → normalize → `find_availability` (Microsoft ~2.1s) → intake → book (~2.5s total, ~1.6s Graph create).

**Nothing critical failed.** Five `Unknown client delegation` sideband errors occurred right after `update_intake` continuations; tools still completed and outputs were submitted.

**DB gap:** Production Postgres has **no** `voiceCall` row for `v3:j8l…`, **no** `voice_appointments` since 07:45 UTC, and no row for `bka_cmu8385m215094u0r6s3o325d`. Forensics for this call are **container logs**, not CRM tables.

---

## Call identity

| Field | Value |
|--------|--------|
| **When (UTC)** | `2026-09-19T07:49:08.458Z` → ~96s (`duration_ms: 96119`) |
| **Deploy** | Image/commit **59744238** (post PR #431 scheduling-preference) |
| **Live session** | `live_u7_EPk6lp3oMdWQ5CilFbpLcfWnhc3ovPuq` |
| **Telnyx call control** | `v3:j8lDApIiI0HegFSEd6vubC3-hTcx7VDw2cAsUacS7n3OBfPlwi-jxg` |
| **Business line (to)** | `+15717491060` |
| **Workspace / agent** | `ws_1` / `cmshz2lc25c622c4i58303501` |
| **Stack** | Frontend **gpt-live-1**, backend **gpt-6-astra** |
| **Timezone** | `America/Los_Angeles` |
| **Service** | `service-visit` |
| **Intake fields configured** | name, email, phone, service_reason, notes, mother_s_name |

Caller ANI is redacted in logs (`[REDACTED]`).

---

## End-to-end latency (call-level)

From `VOICE_V3_CALL_SUMMARY` + pipeline:

| Metric | Value |
|--------|--------|
| Incoming → session accepted | **1339 ms** |
| Incoming → first agent audio (greeting) | **3107 ms** |
| **Median turn latency (Astra)** | **1503 ms** |
| **Max turn latency (Astra)** | **3412 ms** |
| Delegations | **8** |
| Interruptions | **0** |
| `meaning_received` (legacy CallerMeaning) | **0** (expected on V3) |
| Hangup | `normal_clearing` |

Individual Astra latencies recorded in the trace (16 completion events):

`909, 931, 948, 1143, 1185, 1234, 1254, 1489, 1516, 1540, 1609, 1669, 1863, 2093, 2356, 3412` ms — **median 1516 ms**, matches summary.

**Per-delegation** (first `astra.response.completed` after each `delegation.created`):

| # | ~Offset from call start | Astra latency | What happened |
|---|-------------------------|---------------|----------------|
| 1 | +5.3s | **1185 ms** | Conversation only — **no tools** (post-greeting turn) |
| 2 | +16.6s | **1669 ms** | **`set_scheduling_preference` + `find_availability`** (same delegation) |
| 3 | +33.2s | **1143 ms** | **`update_intake`** (name) |
| 4 | +40.0s | **2093 ms** | **`update_intake`** |
| 5 | +50.0s | **1516 ms** | **`update_intake`** |
| 6 | +58.0s | **1863 ms** | **`update_intake`** |
| 7 | +69.6s | **1540 ms** | **`update_intake`** → **`INTAKE_OBJECTIVE_COMPLETED`** |
| 8 | +79.0s | **1254 ms** | **`book_appointment`** → Microsoft confirm |

---

## Tool timeline (authoritative)

| UTC | Tool | Status | Tool time |
|-----|------|--------|-----------|
| 07:49:24.984 | `set_scheduling_preference` | `SCHEDULING_PREFERENCE_SET` | **13 ms** |
| 07:49:29.806 | `find_availability` | `available` | **2099 ms** |
| 07:49:48.796 | `update_intake` | `INTAKE_UPDATED` | **5 ms** |
| 07:49:58.209 | `update_intake` | `INTAKE_UPDATED` | **3 ms** |
| 07:50:06.556 | `update_intake` | `INTAKE_UPDATED` | **2 ms** |
| 07:50:17.853 | `update_intake` | `INTAKE_UPDATED` | **3 ms** |
| 07:50:26.974 | `update_intake` | `INTAKE_UPDATED` | **1 ms** |
| 07:50:31.468 | `book_appointment` | **`confirmed`** | **2501 ms** |

### Scheduling + FIND (delegation 2)

- Normalizer: `THIS_WEEKDAY`, exact time, **`local_date: 2026-09-21`**, display **“Monday two o'clock”**, **generation 1**.
- Microsoft window: `2026-09-21T21:00:00.000Z`–`22:00:00.000Z` (60 min), primary calendar.
- **Offer set:** `offer_set_b1dfb05bb501`, **1 slot:** `slot_1` @ **`2026-09-21T14:00:00-07:00`** (Monday 2:00 PM Pacific).

### Intake (delegations 3–7)

- After first `update_intake`, objective was **IN_PROGRESS** with missing: email, phone, service_reason, mother_s_name (name already collected).
- After the fifth `update_intake` (~07:50:26): **`INTAKE_OBJECTIVE_COMPLETED`**, `missing_required_field_names: []`.

**Ordering note:** Scheduling + FIND ran **~24s before** the first `update_intake` (~07:49:29 vs ~07:49:48). Slot was held in offer-set state; book ran only after intake **COMPLETE**. Worked on this call; worth watching if you want “intake before FIND” policy.

### BOOK (delegation 8)

1. `BOOKING_REVALIDATION_STARTED` → **`BOOKING_REVALIDATION_PASSED`** (~554 ms)
2. `ASYNC_ACTION_STARTED` / `BOOK_APPOINTMENT` — `bka_cmu8385m215094u0r6s3o325d`
3. **`MICROSOFT_EVENT_CREATED`** (~1621 ms)
4. **`BOOKING_CONFIRMED`** — same offer set, `slot_1`, provider **microsoft**
5. Tool JSON included **`provider_event_id`** (Graph id above).
6. Sideband thinking told Live: **“You MAY tell the caller the appointment is confirmed.”**

**No failed tools** on this `call_id`.

---

## What did not work (non-fatal)

### `Unknown client delegation` (×5)

Logged as `VOICE_V3_BASIC_SIDEBAND_ERROR` / pipeline `error`, e.g.:

- `2026-09-19T07:49:49.049Z` (right after first `update_intake`)
- Similar at ~07:49:58, ~07:50:06, ~07:50:17, ~07:50:26

These align with **delegated continuation** after tool output back to **gpt-live-1**. String is from the **OpenAI Live/sideband client**, not in-repo. Effect: noise in `VOICE_V3_CALL_SUMMARY.errors`; **tool execution and `DELEGATED_FUNCTION_OUTPUT_SUBMITTED` still succeeded**.

### Database / audit trail

Queried **inside the Coolify app container** (production `DATABASE_URL`):

- `voiceCall` with `telnyxCallControlId` containing `j8lDApIi` → **null**
- `voiceAppointment` for `bka_cmu8385m215094u0r6s3o325d` or `externalId` containing `AEiPQ9o` → **null**
- `voice_appointments` with `createdAt >= 07:45 UTC` → **[]**

So **Voice V3 Basic PSTN** did not leave the same `voiceCall` / `voice_appointments` footprint as Voice V2/Caller Amy. **Proof of book = runtime logs + Microsoft calendar** (event id above).

### Hangup line in logs

Summary also references `callControlId: v3:jaa4Lmjvsc5noQ7d3HnSaRZHMEEmZqUg_K2qplOd6rLotbwChhRs1Q` once at hangup — likely a **secondary Telnyx leg**; the correlated session and tools use **`j8lDApIi…`**.

---

## How this was traced

1. **Coolify SSH** → `docker logs` on `ds8s3hjin60qs6g7s0iqkixs-073532389098` (59744238).
2. **Parsed** `VOICE_TOOL_*`, `BOOKING_*`, `SCHEDULING_NORMALIZED`, `VOICE_V3_CALL_SUMMARY`, and the printed **human timeline** (`+NNNNms delegation.created` / `astra.response.*`).
3. **Production DB** via `docker exec` + Prisma (no matching rows).
4. **Code context:** turn latency = `src/lib/voice-v3/telemetry/call-trace.ts` Astra start→complete; tools = `src/lib/voice-v3/tools/execute-voice-tool.ts` logging.

---

## Bottom line

| Question | Answer |
|----------|--------|
| Did scheduling preference + FIND work? | **Yes** — Monday 2 PM PT, one slot, Microsoft FIND ~2.1s. |
| Did tools fail? | **No** — 8/8 succeeded. |
| Did it really book? | **Yes** — revalidation passed, Graph event created, `BOOKING_CONFIRMED`, real `provider_event_id`. |
| Did Amy’s confirmation match reality? | **Yes** — backend authorized confirmation text. |
| Per-turn latency? | **~1.1–2.1s per delegation**; summary **median 1503 ms**, **max 3412 ms**. |
| What’s broken? | **Sideband “Unknown client delegation”** on intake continuations (cosmetic in summary); **no DB call/appointment row** for this V3 PSTN path. |

---

## Reference IDs (quick copy)

```
live_session_id:     live_u7_EPk6lp3oMdWQ5CilFbpLcfWnhc3ovPuq
call_control_id:     v3:j8lDApIiI0HegFSEd6vubC3-hTcx7VDw2cAsUacS7n3OBfPlwi-jxg
offer_set_id:        offer_set_b1dfb05bb501
slot_id:             slot_1
slot_local_start:    2026-09-21T14:00:00-07:00
booking_attempt_id:  bka_cmu8385m215094u0r6s3o325d
provider_event_id:   AQMkADAwATM0MDAAMi1hOWY1LTY3MzEtMDACLTAwCgBGAAADxtFon5XuVEalmlhPr1nWBgcAs2vWk3hKT02vN5c-Q6OlzQAAAgENAAAAs2vWk3hKT02vN5c-Q6OlzQAAAEiPQ9oAAAA=
```
