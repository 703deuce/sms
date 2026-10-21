# Voice V3 golden era (Sept 2026) vs new-app receptionist — parity audit

**Your reference window:** Late **September 2026** — reliable **Microsoft 365** bookings on PSTN LiveKit while switching delegated backend **Sol → Luna**. Prompt text was the **same** for both models; only `VOICE_V3_ASTRA_MODEL` / bootstrap `backend_model` changed.

**Git anchor (golden era):** commit **`a4a63466c`** (2026-09-24) — documented in `reports/voice-v3-golden-era-vs-recent-prompt-diff.md` with successful `appointmentBooked` clusters on the 571 cert line around that week.

**Monolith today:** Prompts were **restored to golden wording** on branch/PR **`cursor/voice-v3-golden-era-sept-f350`** → **`baffdbf2d`** / **#682** (five files). Current `master` monolith Amy/Astra **prompt modules** are effectively **golden-era text** (only tiny diffs vs `a4a63466c`).

**new-app receptionist:** Uses a **ported copy** of the prompt modules under `new-app/lib/server/voice-v3/prompts/`, plus a **ported tool catalog** (`astra-tool-contracts.ts`, `voice-tool-catalog.ts`, scheduling tools, delegation hydration). Remaining gaps are mostly **product-mode gating** (Conversational IVR), **Amy delegation compliance** (GPT-Live can speak before delegating), and **LiveKit bootstrap parity** (intake tool merge — see §3.6).

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

| | Monolith golden / master | new-app (current `master`) |
|---|--------------------------|---------------------------|
| File | `src/lib/voice-v3/tools/astra-tool-contracts.ts` | **Present** — `new-app/lib/server/voice-v3/tools/astra-tool-contracts.ts` (identical) |
| LiveKit session | `buildVoiceV3AstraFunctionToolsFromCatalog` | **Same** in `resolve-livekit-session.ts` (filtered by published `toolNames`) |

**Impact:** Luna **does** receive full contract descriptions on new-app when tools are enabled for the published profile. Stale audits claiming stub tools are incorrect.

### 3.2 `set_scheduling_preference` (scheduling semantics)

| | Monolith | new-app |
|---|----------|---------|
| Args | `SchedulingMeaning` via Zod | **Ported** — `set-scheduling-preference-tool.ts` + `scheduling-meaning-schema.ts` |
| Behavior | `mergeSchedulingMeaningIntoContext`, FIND uses normalized preference | **Ported** — `find-availability-tool.ts` gates on stored preference |

**Impact:** SET→FIND semantics **match** golden monolith for Full Receptionist + live calendar. Residual risk is **executor/provider** differences (M365 adapter paths), not missing SET schema.

### 3.3 Tool execution stack

| Capability | Monolith path | new-app path |
|------------|---------------|--------------|
| Catalog / gating | `voice-tool-catalog.ts`, capability parity, concurrency policy | `compile-runtime.ts` `enabledTools()` name list only |
| Book / find / reschedule | `src/lib/voice-v3/tools/*-tool.ts` + runtime snapshot | `execute-tool.ts` + simplified `scheduling/service.ts` |
| M365 book | `book-appointment-tool` + provider adapters (certified path) | `microsoft.microsoftCreateEvent` — **real Graph write**, but slot selection pipeline is simplified |
| Operation requirements / booking preconditions | `operation-requirements`, intake merge, book gates | **Not ported** |
| Idempotency / tool traces | `voiceToolExecution`, forensics | Partial Prisma logging in `execute-tool.ts` |

**Impact:** Residual differences are **operation-requirements / book gates** and provider adapters — not missing SET/FIND tool wiring on Full Receptionist.

### 3.4 Delegation hydration (Amy sees facts after tools)

Golden manifest (`docs/VOICE-V3-GOLDEN-ERA-PARITY-MANIFEST.md`):

- Monolith: `pushDelegatedRuntimeContextToLive`, `session.thinking.append`, `liveContextEvents` on tool execute, `resolve_voice_v3_delegated_runtime_context` with rich events.

| | Monolith | new-app |
|---|----------|---------|
| `resolveDelegatedRuntimeContext` | Full hydration via `pushDelegatedRuntimeContextToLive` | **Ported** — `live-context.ts` + `push-delegated-runtime-context.ts` |
| After tool execute | `liveContextEvents` on tool result | **Ported** — `execute-tool.ts` + Python `apply_live_context_from_tool_result` |

**Impact:** Hydration **largely matches** golden era. Conversational IVR skips `buildIntakeObjectiveContext` in the thinking push (by design).

### 3.6 LiveKit session bootstrap (intake tools + metadata)

| | Monolith `voice-v3-livekit.ts` | new-app `resolve-livekit-session.ts` |
|---|-------------------------------|--------------------------------------|
| Catalog tools | `buildVoiceV3AstraFunctionToolsFromCatalog` + allowlist | Same |
| Per-field intake tools | `buildLiveKitIntakeFunctionTools` merged into `toolSchemas` | **Was missing** — restored to match monolith merge |
| `intakeFields` for Python | `buildLiveKitIntakeFieldMetadata` (`liveKitToolName`, collection strategy) | **Was simplified editor rows** — restored |

**Impact:** Golden-era multi-field intake (`set_intake_*`, `collect_intake_field`) and Python routing depend on this merge. Missing merge does **not** remove `book_appointment` from the catalog, but it **does** weaken intake/tool routing parity.

### 3.7 Conversational IVR (new — not in Sept golden PSTN cert)

`voice-tool-catalog.ts` on new-app strips all tools except `end_call`, `search_business_knowledge`, `transfer_call`, `take_message` when `runtimeProfile !== full_receptionist`. Golden-era monolith had **no** this gate.

**Impact:** A number published as **Conversational IVR** will never expose booking tools to Luna — Amy may still improvise booking language (GPT-Live has no tools). Verify **live published mode** on failing lines.

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
| **Tool descriptions** Luna sees | **Yes** (catalog + contracts) when Full Receptionist + capabilities on |
| **set_scheduling_preference** + FIND semantics | **Yes** (ported tools) |
| **M365 book executor** (Graph create) | **Partial** — real Graph path exists; certify per workspace |
| **Delegation / live context recovery** | **Mostly yes** (push + post-tool events) |
| **LiveKit intake tool merge** | **Fixed** — match monolith merge in `resolve-livekit-session.ts` |
| **Amy delegates before claiming “booked”** | **Behavioral** — same architecture as golden; enforce via `live-delegation-policy.ts` + PSTN forensics |
| **Forensics / parity scripts** | `verify-voice-v3-golden-era-parity.ts` — monolith tests; new-app bootstrap should be covered by publish/simulate scripts |

---

## 5. Recommended parity work (order)

1. **Confirm published `runtimeProfile`** is `full_receptionist` on lines that must book (not Conversational IVR).
2. **PSTN forensics** on booking calls: require `set_scheduling_preference` → `find_availability` → `book_appointment` before any “you’re booked” TTS; investigate **zero delegation** vs **delegation with wrong tool choice**.
3. **Amy policy** — keep `live-delegation-policy.ts` aligned with golden “delegate before authoritative claims”; consider hard gates if model skips delegation again.
4. **M365 live cert** per workspace (`scripts/cert-voice-v3-microsoft-appointment-live.ts`) — provider truth separate from tool surface parity.
5. Extend golden parity gate to run new-app `resolve-livekit-session` intake merge assertions (monolith gate currently fails MODULE_NOT_FOUND in cloud CI without full graph).

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
| `new-app/lib/server/voice-v3/resolve-livekit-session.ts` | new-app bootstrap (catalog tools + intake merge) |

---

*Updated Oct 2026 — prompts and Luna tool contracts match golden era; Sept “tools never fired” regressions on new-app are usually **Amy not delegating** or **wrong published mode**, not missing `astra-tool-contracts`.*
