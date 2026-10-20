# Voice V3 golden era (Sept 2026) vs new-app receptionist — parity audit

**Your reference window:** Late **September 2026** — reliable **Microsoft 365** bookings on PSTN LiveKit while switching delegated backend **Sol → Luna**. Prompt text was the **same** for both models; only `VOICE_V3_ASTRA_MODEL` / bootstrap `backend_model` changed.

**Git anchor (golden era):** commit **`a4a63466c`** (2026-09-24) — documented in `reports/voice-v3-golden-era-vs-recent-prompt-diff.md` with successful `appointmentBooked` clusters on the 571 cert line around that week.

**Monolith today:** Prompts were **restored to golden wording** on branch/PR **`cursor/voice-v3-golden-era-sept-f350`** → **`baffdbf2d`** / **#682** (five files). Current `master` monolith Amy/Astra **prompt modules** are effectively **golden-era text** (only tiny diffs vs `a4a63466c`).

**new-app receptionist:** Uses a **ported copy** of the prompt modules under `new-app/lib/server/voice-v3/prompts/`, but **does not** yet port the full **tool catalog, scheduling semantics, or delegation hydration** that made M365 booking work on the monolith.

---

## Architecture (unchanged conceptually)

```
PSTN → LiveKit → GPTLiveModel(gpt-live-1, voice=liveVoiceId, delegation="responses")
                      ↓
              Responses API (Astra instructions + function tools)
                      ↓
              Node internal voice-runtime → tool executors → M365 / Calendly / etc.
```

Golden era and target state: **not** legacy `gpt-4o-realtime` single-session API.

| Layer | Golden / monolith | new-app (current) |
|--------|-------------------|-------------------|
| Spoken model | `gpt-live-1` | Same (worker) |
| Delegation model | Sol or **Luna** via env (prompts identical) | Publish `astraModel` — now defaults **`gpt-6-luna`** |
| Amy instructions | `buildLiveFrontendInstructions` | Same builder (ported) |
| Astra instructions | `buildAstraBackendInstructions` | Same builder (ported) |

---

## 1. Prompt text — frontend (Amy / GPT-Live)

### Compared: `a4a63466c` monolith ↔ `master` monolith ↔ new-app

| Module | Golden vs monolith `master` | Monolith `master` vs new-app |
|--------|----------------------------|------------------------------|
| `live-frontend-instructions.ts` | ~8 lines delta | **Same content** — static telephony block lives in `prompt-canon-export.ts` (`AMY_LIVE_TELEPHONY_STATIC_CANON`) + same dynamic sections (ROLE, BUSINESS FACTS, PERSONA, delegation, greeting) |
| `live-delegation-policy.ts` | identical | ~2 line whitespace/import path |
| `astra-backend-core-instructions.ts` | identical | **identical** |
| `astra-intake-instructions.ts` | identical | **identical** |
| `astra-cross-tool-instructions.ts` | 1 line | ~2 lines |
| `astra-callback-instructions.ts` | identical | ~1 line |
| `amy-end-call-instructions.ts` | (same family) | ported |
| `live-prompt-controls.ts` | (same family) | ported |

**Verdict — prompts (Amy):** **Yes, essentially the same** as Sept golden era / post-#682 monolith. new-app does **not** include later “broken call” experiment blocks that were reverted on monolith (e.g. huge wizard intake surfacing) — aligned with golden.

**How to see exact strings today**

- Full compiled sample: `docs/voice-v3-prompt-exports/TRANSOVO-NEW-APP-VOICE-V3-PROMPT-CANON-FULL-RUNTIME.txt`
- Hardcoded modules only: `01-amy-hardcoded-modules.txt`, `02-astra-hardcoded-modules.txt`
- Regenerate: `cd new-app && npx tsx scripts/export-voice-v3-prompt-canonical.mjs`

**Sol vs Luna:** At golden era, `delegation-config` defaulted **`gpt-5.6-sol`** with env override; your Luna runs used the **same** `astraInstructions` and **same** `amyInstructions`. Switching Sol/Luna did **not** change prompt files.

---

## 2. Prompt text — backend (Astra / Luna delegation)

Same table as above — **core, intake, cross-tool, callback** match monolith golden within a few lines.

**Verdict — prompts (Astra):** **Yes, same canonical text** as golden-era monolith for the instruction layers.

---

## 3. What is *not* the same (booking & agent runtime) — critical

Golden-era reliable M365 booking depended on **prompts + tool contracts + executors + call context**, not prompts alone.

### 3.1 Luna tool descriptions (`astra-tool-contracts.ts`)

| | Monolith golden / master | new-app |
|---|--------------------------|---------|
| File | `src/lib/voice-v3/tools/astra-tool-contracts.ts` | **Missing** |
| LiveKit session | `buildVoiceV3AstraFunctionToolsFromCatalog` — full OpenAI `FunctionTool` descriptions + JSON schemas | `resolve-livekit-session.ts` builds **stubs**: `description: toolName`, **empty `parameters`** |

**Impact:** Luna sees **none** of the golden-era “when to call / when not to call / never invent ids” contract text that PR #682 restored. Prompts say “follow tool descriptions”; tools have **no** real descriptions on new-app.

### 3.2 `set_scheduling_preference` (scheduling semantics)

| | Monolith | new-app `execute-tool.ts` |
|---|----------|---------------------------|
| Args | `SchedulingMeaning` (date_relation, weekday, time_kind, …) via Zod | **Only** `service_id` + `timezone` stored |
| Behavior | `mergeSchedulingMeaningIntoContext`, `schedulingMeaningHasSignal`, FIND uses **normalized preference** | `find_availability` uses **fixed window**: now → +14 days, busy/free slot grid — **ignores** “Tuesday afternoon”, “next available”, etc. |

**Impact:** Golden behavior (“next available” without re-asking the day; FIND after SET) **cannot** match on new-app even with identical Astra **prompt** text.

### 3.3 Tool execution stack

| Capability | Monolith path | new-app path |
|------------|---------------|--------------|
| Catalog / gating | `voice-tool-catalog.ts`, capability parity, concurrency policy | `compile-runtime.ts` `enabledTools()` name list only |
| Book / find / reschedule | `src/lib/voice-v3/tools/*-tool.ts` + runtime snapshot | `execute-tool.ts` + simplified `scheduling/service.ts` |
| M365 book | `book-appointment-tool` + provider adapters (certified path) | `microsoft.microsoftCreateEvent` — **real Graph write**, but slot selection pipeline is simplified |
| Operation requirements / booking preconditions | `operation-requirements`, intake merge, book gates | **Not ported** |
| Idempotency / tool traces | `voiceToolExecution`, forensics | Partial Prisma logging in `execute-tool.ts` |

**Impact:** M365 **can** create events if caller picks a slot from the simplified list, but **not** the same FIND/SET/BOOK semantics as Sept stress tests.

### 3.4 Delegation hydration (Amy sees facts after tools)

Golden manifest (`docs/VOICE-V3-GOLDEN-ERA-PARITY-MANIFEST.md`):

- Monolith: `pushDelegatedRuntimeContextToLive`, `session.thinking.append`, `liveContextEvents` on tool execute, `resolve_voice_v3_delegated_runtime_context` with rich events.

| | Monolith | new-app |
|---|----------|---------|
| `resolveDelegatedRuntimeContext` | Full hydration path | **`intake_snapshot` only** (`delegation.ts`) |
| After `update_intake` | Live recovery push to GPT-Live | **No** equivalent push |

**Impact:** Booking ↔ callback ↔ booking switches and “don’t re-ask name” stress behavior from golden era **not** replicated.

### 3.5 Other monolith paths (not in new-app)

Examples still on monolith only (non-exhaustive):

- `src/lib/voice-v3/delegation/push-delegated-runtime-context.ts`
- `src/lib/voice-v3/delegation/conversation-freshness.ts`
- `src/lib/voice-v3/tools/concurrency-policy.ts`
- `src/lib/voice-v3/intake/merge-scheduling-meaning.ts`, `scheduling-meaning-schema.ts`
- `src/lib/voice-v3/live-sideband-session.ts` (PSTN sideband)
- Forensics: `append_voice_v3_forensic_events` on new-app route **not** implemented

---

## 4. Summary table

| Area | Same as Sept golden monolith? |
|------|-------------------------------|
| Amy **instruction document** (compiled `amyInstructions`) | **~Yes** |
| Astra **instruction document** (`astraInstructions`) | **~Yes** |
| Default backend model **Luna** on publish | **Yes** (after `0a51da44c`; republish required) |
| **Tool descriptions** Luna sees | **No** — stubs |
| **set_scheduling_preference** + FIND semantics | **No** — stub / date window |
| **M365 book executor** (Graph create) | **Partial** — create exists, pipeline differs |
| **Delegation / live context recovery** | **No** |
| **Forensics / parity scripts** | Monolith: `verify-voice-v3-golden-era-parity.ts` — not run against new-app |

---

## 5. Recommended parity work (order)

1. **Port `astra-tool-contracts.ts` + `buildVoiceV3AstraFunctionToolsFromCatalog`** (or equivalent) into new-app; return real `toolSchemas` from `resolveNativeVoiceV3LiveKitSession` (mirror `voice-v3-livekit.ts`).
2. **Port `set_scheduling_preference` tool** + `scheduling-meaning-schema` + `merge-scheduling-meaning` + wire `find_availability` to **stored preference** (monolith behavior).
3. **Port delegation hydration** (`pushDelegatedRuntimeContextToLive` pattern) on tool success and `resolveDelegatedRuntimeContext`.
4. **Bridge or reuse** monolith `book-appointment-tool` / `find-availability-tool` executors for M365 instead of simplified `scheduling/service.ts` slot grid — **or** call monolith internal API for tools until parity certified.
5. Run `scripts/verify-voice-v3-golden-era-parity.ts` against new-app bootstrap + PSTN smoke (book → callback → book).

---

## 6. References in repo

| Doc / commit | Purpose |
|--------------|---------|
| `a4a63466c` | Golden-era anchor (Sept 24 2026) |
| `reports/voice-v3-golden-era-vs-recent-prompt-diff.md` | What changed before #682 restore |
| `baffdbf2d` / PR #682 | Golden prompt restore (5 files) |
| `docs/VOICE-V3-GOLDEN-ERA-PARITY-MANIFEST.md` | Runtime invariants |
| `docs/TRANSOVO-NEW-APP-VOICE-V3-PROMPT-CANON.md` | Prompt export index |
| `src/lib/voice/python-runtime-bridge/voice-v3-livekit.ts` | Monolith session bootstrap (tools + prompts) |
| `new-app/lib/server/voice-v3/resolve-livekit-session.ts` | new-app bootstrap (prompts OK, tools stub) |

---

*Generated for parity review — prompts match golden era; booking agent behavior on new-app does not yet.*
