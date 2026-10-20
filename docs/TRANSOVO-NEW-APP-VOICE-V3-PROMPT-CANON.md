# Transovo new-app — Voice V3 prompt canon (Amy + Astra)

**Authority:** Same prompt modules as legacy monolith Voice V3, compiled on receptionist **Publish** into `voiceAgentVersion.config.newAppReceptionist.runtime`.

## Models on PSTN (not OpenAI Realtime API)

| Layer | Model | Where set |
|-------|--------|-----------|
| **Spoken (Amy)** | `gpt-live-1` | LiveKit `GPTLiveModel` in `voice-runtime-python` — fixed |
| **Voice timbre** | `liveVoiceId` (e.g. `marin`, `gleam`) | Editor → publish → `runtime.liveVoiceId` |
| **Delegation (Astra)** | **`gpt-6-luna`** default | `compile-runtime.ts` → `runtime.astraModel` (override: `VOICE_V3_ASTRA_MODEL`) |

Worker wiring: `amyInstructions` → `Agent(instructions=…)`; `astraInstructions` → `GPTLiveModel` `responses_options.instructions` with `delegation="responses"`.

This is **GPT-Live + Responses delegation**, not the older single-session **`gpt-4o-realtime`** product path.

## What gets injected at publish (dynamic)

Prepended/appended around the hardcoded canon:

**Amy (`buildLiveFrontendInstructions`):**

- `# ROLE` — agent name, business name, job role line
- `# BUSINESS FACTS` — knowledge profile, hours, services, FAQs, file-search summaries
- `# PERSONA` — tone, guardrails, conversation behaviors
- Capability summary, live prompt controls, transfer/end-call blocks (when enabled)
- `# DELEGATION POLICY` — capability-specific delegate / do-not-delegate rules
- `# GREETING` — opening line from editor

**Astra (`buildAstraBackendInstructions`):**

- Core + intake + cross-tool canon (always)
- Business timezone, local time, intake field catalog, service catalog, booking strategy
- Callback, transfer, knowledge (file search), spam/solicitor sections when configured

## Files with **exact** prompt text

Regenerate after prompt edits:

```bash
cd new-app && npx tsx scripts/export-voice-v3-prompt-canonical.mjs
```

| File | Contents |
|------|-----------|
| **`docs/voice-v3-prompt-exports/TRANSOVO-NEW-APP-VOICE-V3-PROMPT-CANON-FULL-RUNTIME.txt`** | **One file:** full Amy + full Astra as compiled for `DEFAULT_AGENT` (what runtime stores, plus your business-specific blocks for that sample). |
| `docs/voice-v3-prompt-exports/01-amy-hardcoded-modules.txt` | Hardcoded Amy modules only (delegation policy, end-call, tuning, telephony law). |
| `docs/voice-v3-prompt-exports/02-astra-hardcoded-modules.txt` | Hardcoded Astra modules (core, intake, cross-tool). |
| `docs/voice-v3-prompt-exports/03-amy-full-runtime-default-agent.txt` | Full Amy only. |
| `docs/voice-v3-prompt-exports/04-astra-full-runtime-default-agent.txt` | Full Astra only. |
| `docs/voice-v3-prompt-exports/05-runtime-metadata.json` | `astraModel`, `liveVoiceId`, char counts, tools. |

## Source code map

| Piece | Path |
|-------|------|
| Amy assembler | `new-app/lib/server/voice-v3/prompts/live-frontend-instructions.ts` |
| Delegation policy | `new-app/lib/server/voice-v3/prompts/live-delegation-policy.ts` |
| Telephony static canon | `new-app/lib/server/voice-v3/prompts/prompt-canon-export.ts` → `AMY_LIVE_TELEPHONY_STATIC_CANON` |
| End call / transfer (Amy) | `amy-end-call-instructions.ts`, `amy-transfer-instructions.ts` |
| Astra assembler | `new-app/lib/server/voice-v3/prompts/astra-backend-instructions.ts` |
| Astra core | `new-app/lib/server/voice-v3/prompts/astra-backend-core-instructions.ts` |
| Publish compile | `new-app/lib/server/receptionist/compile-runtime.ts` |

Your **live** published agent replaces business facts, greeting, capabilities, and tools — the hardcoded modules stay the same.
