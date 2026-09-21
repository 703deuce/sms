# Read-only forensics report: ~12.7s pre-`find_availability` delay

**Date:** 2026-09-21  
**Mode:** Evidence and source review only — no code, instrumentation, deploy, or new test calls.

**Call:** `vcrbyQoJ7aLi`  
**GPT-Live session:** `live_u1_EQXyQp3oNLUlkOZ40P012CFGt7hb74Qr`  
**Backend:** `gpt-5.6-sol`

**Related artifacts:**

- `docs/VOICE-V3-GPT-LIVE-SOL-DELEGATION-TIMING-AUDIT-2026-09-21.md`
- `docs/VOICE-V3-LAST-CALL-TOOL-CHAIN-vcrbyQoJ7aLi.md`
- `docs/VOICE-V3-LAST-CALL-TOOL-CHAIN-vcrbyQoJ7aLi.backend-events.json`
- `docs/VOICE-V3-DUAL-PSTN-DELEGATION-EXPORT-2026-09-21.json`
- `docs/VOICE-V3-PSTN-CALL-FORENSICS-REPORT-INFO-DUMP-2026-09-21.md`

---

## 1. What existing evidence PROVES

| Fact | Source |
|------|--------|
| Node/tool path is fast | `set_scheduling_preference` Node ~6 ms; `find_availability` Node ~1.47 s (Microsoft), not ~12 s |
| Gap is **after SET, before FIND** | SET `FUNCTION_TOOL_COMPLETED` **2026-09-21T13:05:33.717Z** → FIND `FUNCTION_TOOL_STARTED` **2026-09-21T13:05:47.980Z** ≈ **14.26 s** (wall UTC, production DB `voiceV3Forensics.events`) |
| Seven delegated `resp_*` completions, four tools | `backendLlmUsage` + timing audit; `LLMMetrics.duration=0`, `ttft=-1` (LiveKit constants on this path) |
| **~12.718 s** is **`response.created` → `find_availability` `function_call`** on a sibling call with full delegation telemetry | **`BRMzndUiiSem`**: `GPT_LIVE_DELEGATION_RESPONSE_CREATED` **2026-09-21T14:40:11.781Z** (`…8a59c42c`) → `GPT_LIVE_DELEGATION_FUNCTION_CALL_EMITTED` **2026-09-21T14:40:24.499Z** → **12.718 s** (`docs/VOICE-V3-DUAL-PSTN-DELEGATION-EXPORT-2026-09-21.json`) |
| Post-SET continuation is quick to **start** the next backend turn | BRMz: SET emitted → `response.create` **+0.293 s** → `response.created` **+0.679 s** — not a multi-second barrier before a new `resp_*` exists |
| `vcrby` has **no** `GPT_LIVE_DELEGATION_*` in DB | **0** delegation kinds vs **68** on BRMz/dYDML (same Sol backend); worker image at call time lacked persisted delegation telemetry |
| Full forensics for `vcrby` is **259** events in DB (not the 23-event tool-only export); repo JSON exports redact tokens in event payloads | DB `metadata.voiceV3Forensics.backendLlmUsage` has **unredacted** token fields |
| Coolify forensics for `vcrby` reported normal worker/web tool HTTP 200s, no tool failures | `docs/VOICE-V3-PSTN-CALL-FORENSICS-REPORT-INFO-DUMP-2026-09-21.md` |
| Both “fast” and “slow” PSTN calls in the dual export use **`gpt-5.6-sol`** | DB bootstrap `backend_model` for `dYDMLQvxF9xC`, `BRMzndUiiSem`, `vcrbyQoJ7aLi` |

---

## 2. What it STRONGLY SUGGESTS

- The audible/tool silence is dominated by **one delegated Responses turn** (the continuation after SET tool output) spending **~12–14 s** before emitting `find_availability`, not by Transovo Node or calendar FIND.
- On BRMz, provider timestamps on that slow `resp_*` show **~13 s** server-side (`provider_created_at` → `provider_completed_at` **1790001611 → 1790001624**), aligned with worker-observed **12.718 s** created→function_call.
- On `vcrby`, **resp #3** completes **13:05:34.326Z** (SET continuation); **FIND** starts **13:05:47.980Z** (**13.65 s**). **resp #4** (`…8bacd5c4`) completes **13:05:48.149Z** (169 ms after FIND start) — consistent with FIND being issued on that in-flight turn, same pattern as BRMz.
- **Cache / token shape does not distinguish** slow vs fast FIND continuation: BRMz slow turn **97.5%** cached (12450 prompt / 12139 cached); fast `dYDML` FIND turn **~98%** cached; `vcrby` resp #4 **90.8%** cached, in line with neighbors #2–#3 (~93%).

---

## 3. What it RULES OUT (for this interval)

| Ruled out | Why |
|-----------|-----|
| Microsoft FIND / Node executor as ~12 s blocker | FIND Node slice ~1.5 s; starts only after model emits tool |
| “Sol vs Astra model” as root cause for this gap | Compared PSTN calls all **`gpt-5.6-sol`**; fast SET→FIND on `dYDMLQvxF9xC` is also Sol |
| Prompt-cache **miss** as primary explanation for the slow FIND turn | Slow BRMz turn has **very high** `prompt_cached_tokens`; `vcrby` FIND `resp_*` cache ratio normal vs prior turns |
| Abnormal **reasoning token** load | All seven `vcrby` usages: **`reasoning_tokens: 0`** |
| Waiting **seconds** for `response.create` / new `response.created` after SET (when telemetry exists) | BRMz: **<1 s** from SET emission to `response.created` |
| Derived report’s missing `response.created` meaning “not stored anywhere” for all calls | **Present** in DB for builds with delegation telemetry (BRMz/dYDML); **absent** for `vcrby` only |

**Not ruled out:** variable **OpenAI/GPT-Live delegated latency** on the continuation turn; intermittent worker event-loop warnings (seen at session start in saved logs, not correlated to SET→FIND window).

---

## 4. Cache behavior vs delay

### `vcrby` — `backendLlmUsage` (production DB)

| # | `resp_*` (suffix) | Completed (UTC) | prompt | cached | cached/prompt | cache_create | out | reasoning |
|---|-------------------|-----------------|--------|--------|---------------|--------------|-----|-----------|
| 1 | `…79ab76` | 2026-09-21T13:04:41.429Z | 11825 | 4971 | **42.0%** | 6854 | 67 | 0 |
| 2 | `…ea389` | 2026-09-21T13:05:04.427Z | 11964 | 11115 | **92.9%** | 265 | 23 | 0 |
| 3 | `…3189ee8` | 2026-09-21T13:05:34.326Z | 12108 | 11115 | **91.8%** | 144 | 71 | 0 |
| 4 | `…8bacd5c4` | 2026-09-21T13:05:48.149Z | 12239 | 11115 | **90.8%** | 131 | 22 | 0 |
| 5 | `…35c34c` | 2026-09-21T13:06:01.126Z | 12551 | 12139 | **96.7%** | 312 | 22 | 0 |
| 6 | `…08e624` | 2026-09-21T13:06:19.364Z | 12674 | 12139 | **95.8%** | 123 | 35 | 0 |
| 7 | `…02b975c` | 2026-09-21T13:06:29.468Z | 12826 | 12139 | **94.6%** | 152 | 27 | 0 |

**Conclusion:** The pre-FIND slow window aligns with **resp #3 → FIND**, not with a collapse in cache reuse on the FIND-bearing response (#4 looks like a normal high-cache turn). Only resp #1 is a heavy cache-miss turn (post–`update_intake`), earlier in the call.

### Delegated response chain mapping (`vcrby`, evidence-based)

| # | Completed (UTC) | Δ from previous | Likely tool / outcome |
|---|-----------------|-----------------|------------------------|
| 1 | 13:04:41.429Z | — | `update_intake` |
| 2 | 13:05:04.427Z | +22.998 s | No tool until SET (~29 s later) |
| 3 | 13:05:34.326Z | +29.899 s | `set_scheduling_preference` |
| 4 | 13:05:48.149Z | +13.823 s | `find_availability` (overlaps FIND execution) |
| 5 | 13:06:01.126Z | +12.977 s | Post-FIND speech / no new tool |
| 6 | 13:06:19.364Z | +18.238 s | `book_appointment` |
| 7 | 13:06:29.468Z | +10.104 s | Post-book wrap |

---

## 5. Sequential SET → FIND and extra backend turns

### Protocol + config (read-only)

- `parallel_tool_calls` defaults **false** in `voice-runtime-python/transovo_voice/voice_v3/session.py`.
- Prompts **require** SET then FIND, not parallel: `src/lib/voice-v3/prompts/astra-cross-tool-instructions.ts` — *“Do not call find_availability in parallel with set_scheduling_preference.”*
- Tool copy: FIND waits on stored preference from SET (`src/lib/voice-v3/tools/astra-tool-contracts.ts`).
- LiveKit Responses delegation: SET completes → tool output → **`response.create`** → **new** `resp_*` → model emits function call (observed on BRMz).

### Question checklist

| Question | Answer |
|----------|--------|
| **A.** Another backend turn after SET? | **Yes** — mandatory continuation after `function_call_output`, not optional. |
| **B.** `parallel_tool_calls=false` forces two turns for SET+FIND? | **Effectively yes** for “SET completes, then FIND” — two tool-emission cycles minimum. |
| **C.** Prompts cause sequential SET→FIND? | **Yes**, explicitly. |
| **D.** Deterministic ops require SET before FIND? | **Yes** — `mayFindAvailability` / `hasSchedulingPreference` in `src/lib/voice-v3/state/call-rules.ts`; FIND tool can return `SCHEDULING_PREFERENCE_REQUIRED` without SET. |
| **E.** Could one delegated response legally do both without an extra **model decision** turn? | **Not under current prompt + sequential tool protocol**; Node already knows `safeNextActions` can include `FIND_AVAILABILITY` after SET (`src/lib/voice-v3/agent/evaluate-operations.ts`), but the **LiveKit/Sol path still waits for the model** to emit FIND on the continuation turn. |

SET→FIND adds an **architecturally required** continuation **turn**; the pathology is **latency inside that turn** (~12.7 s), not an extra unnecessary turn beyond SET/FIND sequencing itself.

---

## 6. “Astra” / slow call — same lifecycle position?

- Documented **long** gaps (e.g. ~26 s info-dump → scheduling question on `dYDMLQvxF9xC`) sit **earlier** (first delegation / conversation), not SET→FIND.
- **SET→FIND on `dYDMLQvxF9xC`:** `response.created` → FIND **~1.48 s** (delegation export).
- **Same position, slow:** **`BRMzndUiiSem`** SET → FIND **13.397 s** total wall from SET emission; **12.718 s** `response.created`→FIND — **same lifecycle slot** as `vcrby`, also **Sol**.
- **Insufficient** to claim a separate historical **non-Sol “Astra model”** slow SET→FIND from repo data alone; compared calls are all `gpt-5.6-sol`.

---

## 7. Raw events / logs vs derived report

| Asset | `response.created` / delegation | Token detail |
|--------|----------------------------------|--------------|
| Tool-chain JSON in repo (`vcrby`) | **No** | Redacted in export |
| DB `voiceV3Forensics.events` (`vcrby`, 259 events) | **No** `GPT_LIVE_DELEGATION_*` | Redacted in event payloads |
| DB `backendLlmUsage` (`vcrby`) | N/A (completion only) | **Full** |
| `VOICE-V3-DUAL-PSTN-DELEGATION-EXPORT-2026-09-21.json` | **Yes** (BRMz, dYDML) | Match via DB `backendLlmUsage` per call |
| Saved worker log snippet (`docs/VOICE-V3-DUAL-PSTN-voice-worker-logs-2026-09-21.txt`) | No `vcrby` lines; BRMz/dYDML only | N/A |

**Derived timing reports understate** per-turn duration because they only have **`response.completed`** timestamps and `duration=0`. **Delegation export proves** start (`response.created`) and function_call timing exist in raw forensics when telemetry is enabled.

### Raw forensic search (`vcrby` DB events)

**Present kinds (sample):** `CALLER_UTTERANCE_*`, `USER_TURN_COMMITTED`, `AGENT_TURN_COMMITTED`, `FUNCTION_TOOL_*`, `NODE_TOOL_*`, `BACKEND_LLM_METRICS_COLLECTED`, `GPT_LIVE_METRICS_COLLECTED`, session bootstrap — **259** total rows (with duplicates from flush).

**Absent for `vcrby`:** `GPT_LIVE_DELEGATION_RESPONSE_CREATED`, `GPT_LIVE_DELEGATION_RESPONSE_CREATE`, `GPT_LIVE_DELEGATION_FUNCTION_CALL_EMITTED`, `response.output_item.*` as persisted kinds, errors/warnings/cancellations tied to delegation.

**Present on BRMz/dYDML (when telemetry attached):** `response.created`, `response.completed`, `response.create`, `response.item.create` (tool output), `function_call` emissions — see dual-PSTN export.

---

## 8. Single most likely cause (evidence-based)

**~12.7 s of OpenAI delegated Responses work on the mandatory post-`set_scheduling_preference` continuation turn**, from **`response.created` until `find_availability` is emitted** — reproduced at **12.718 s** on `BRMzndUiiSem`, with matching wall-clock gaps on `vcrbyQoJ7aLi`, with **normal cache ratios and zero reasoning tokens**, and **without** a multi-second delay starting that turn.

---

## 9. Single best potential fix (current architecture; not implemented)

**Deterministic FIND dispatch after successful SET** when `mayFindAvailability` is already true — Node already computes `safeNextActions` including `FIND_AVAILABILITY` (`evaluate-operations.ts`). A narrow hook (worker or coordinated path) to **trigger FIND without waiting for Sol to re-decide** on the continuation turn would remove the **~13 s model beat** while keeping SET as the authority for scheduling semantics.

Evidence supports this as the highest-leverage architectural lever, not a Sol model swap or cache tuning alone.

---

## 10. What remains impossible without new instrumentation

- **`response.created` timestamps for `vcrby` specifically** (delegation telemetry not persisted on that worker build).
- **TTFT / in-turn phase split** (reasoning vs output vs queue) for the slow `resp_*`; plugin does not record them (`ttft=-1`, `duration=0`).
- **Correlating Coolify worker logs** in the exact SET→FIND window for `vcrby` (not in saved log bundle; prior SSH grep only showed healthy tool HTTP).
- **Proving** whether the delay is retry/throttle vs pure generation (no rate-limit/error lines in delegation export for BRMz slow turn).
- **Whether every slow booking call** hits ~12 s vs sometimes ~2 s (need delegation telemetry on all production calls or centralized WS capture).

---

## FAST vs SLOW comparison (same lifecycle: post-SET continuation → FIND)

| | **SLOW** (`BRMz` / `vcrby`) | **FAST** (`dYDMLQvxF9xC`) |
|--|---------------------------|---------------------------|
| Backend model | `gpt-5.6-sol` | `gpt-5.6-sol` |
| `response.create` after SET | ~0.3 s (BRMz) | ~0.24 s |
| `response.created` → FIND | **12.72 s** (BRMz, measured) | **~1.48 s** |
| SET tool done → FIND start (`vcrby`) | **~14.26 s** | **~2.03 s** (DB tool timestamps) |
| Cache on FIND `resp_*` | ~91–98% | ~98% |
| Node FIND execution | ~1 s | ~1 s |

---

## BRMz delegation chronology (after successful SET, excerpt)

Wall times UTC, deltas from SET `function_call` emission **2026-09-21T14:40:11.102Z**:

| Δ (s) | Event |
|-------|--------|
| 0.000 | SET `function_call` emitted |
| 0.028 | `response.item.create` (tool result queued) |
| 0.291 | `response.completed` (SET turn) |
| 0.293 | `response.create` (continuation) |
| 0.679 | `response.created` (`…8a59c42c`) |
| **13.397** | FIND `function_call` emitted |
| — | **12.718 s** from `response.created` to FIND |

---

## Coolify / worker logs (existing artifacts)

- **Info-dump call `vcrby`:** Documented grep commands in `VOICE-V3-PSTN-CALL-FORENSICS-REPORT-INFO-DUMP-2026-09-21.md`; voice worker job `AJ_ww2YDEac8PWh`, no forensics/tool failures reported.
- **Saved log file:** `docs/VOICE-V3-DUAL-PSTN-voice-worker-logs-2026-09-21.txt` — covers `dYDMLQvxF9xC` and `BRMzndUiiSem` only; event-loop block warnings at **session start**, not correlated to SET→FIND window; no `invalid_request_error`, rate limit, or websocket errors in that slice during FIND delay.

**Retroactive `vcrby` delegation timing without new build:** grep Coolify voice worker logs **2026-09-21 ~13:05:33–13:05:48 UTC** for `vcrbyQoJ7aLi` / `AJ_ww2YDEac8PWh` if log retention still allows.

---

## Investigation scope reminder

This report used:

1. Production DB `VoiceCall.metadata.voiceV3Forensics` (including `backendLlmUsage` and full `events` for `vcrbyQoJ7aLi`).
2. Repo exports and dual-PSTN delegation JSON.
3. Source read-only trace for sequential tools and `parallel_tool_calls`.
4. Existing forensics docs and partial worker logs.

**No code changes, instrumentation, commits, deploys, or new PSTN calls.**

---

*End of report.*
