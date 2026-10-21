# Voice V3 golden-era runtime parity matrix (Full Receptionist)

**Golden reference:** commit `a4a63466c` (2026-09-24) · monolith `src/lib/voice-v3/`  
**Current:** `new-app/lib/server/voice-v3/` + shared `voice-runtime-python/`  
**Automated gate:** `new-app/scripts/verify-golden-runtime-parity.ts` (23 byte-identical core files + smoke tests)

Legend: **Match** · **Intentional** · **Gap** · **Verify live**

| Area | Golden behavior | New-App before / now | Classification | Fix / test |
|------|-----------------|----------------------|----------------|------------|
| Amy instructions | Golden prompt modules | Same modules (+ canon export split, FAQ facts) | **Match** | Prompt export script |
| Luna/Astra instructions | Golden stack | Same (+ 6b/6c, IVR strategy append) | **Match** / minor **Intentional** | Do not roll back golden text |
| Delegation policy | Golden | Same + booking guard lines | **Intentional** (incident) | Runtime delegation, not more prompt |
| GPT-Live model | `gpt-live-1` | Same (worker) | **Match** | — |
| Delegated model | Env `VOICE_V3_ASTRA_MODEL` | Published `astraModel` + env | **Intentional** (Phone arch) | Log on `VOICE_V3_SESSION_TOOL_SURFACE` |
| Tool descriptions | `astra-tool-contracts.ts` | Ported | **Match** | Gate includes contracts file |
| Tool gating | Capability catalog | `toolNames` + `runtimeProfile` | **Intentional** | **Fixed:** profile coalesce from editor |
| Intake field tools | Merged at LiveKit bootstrap | Was missing → **restored** | Was **Gap** → fixed | `resolve-livekit-session.ts` |
| Intake metadata | `buildLiveKitIntakeFieldMetadata` | Was simplified → **restored** | Was **Gap** → fixed | Same |
| SET/FIND/BOOK executors | `book-dispatch`, `find-dispatch`, tools | **Byte-identical** to monolith | **Match** | Parity gate |
| `scheduling/service.ts` | N/A in monolith | new-app-only helper for tests | **Intentional** | FIND/BOOK use `*-dispatch`, not service.ts |
| Operation requirements | `operation-requirements.ts` | Ported (import path only) | **Match** | Smoke: `getMissingFieldsForOperation` |
| Booking preconditions | `book-appointment-tool` + rules | Ported | **Match** | `test-voice-v3-runtime-parity-smoke` |
| M365 adapter | `book-dispatch` + microsoft resolve | Same dispatch; resolve accepts `active`/`ok` status | **Match** + minor **Intentional** | Live Graph cert |
| Delegation hydration | `push-delegated-runtime-context` | Ported; IVR skips intake objective block | **Match** / **Intentional** | `delegation_runtime_hydration.py` |
| Conversation freshness | `conversation-freshness.ts` | **Byte-identical** | **Match** | Smoke classifications |
| Concurrency policy | `concurrency-policy.ts` | **Byte-identical** | **Match** | Gate |
| Idempotency | Tool + finalize idempotency keys | `execute-voice-tool`, `finalizeVoiceV3Call` | **Mostly match** | **Verify live** duplicate tool calls |
| Forensics append | Python → Node append + persist | `voice-v3-forensics-bridge.ts` + `forensics-persist.ts` | **Match** (import paths only) | Flush on worker |
| Post-call webhooks | `emit-post-call-webhooks` | **Ported** + wired on flush finalize | Was **Gap** → fixed | `test-voice-v3-post-call-parity.ts` |
| Post-call knowledge gaps | `run-post-call-side-effects` | **Ported** (webhooks + insight candidates) | Was **Gap** → fixed | Flush finalize → `run-post-call-after-finalize` |
| Post-call notifications | `notify-call-completed` on pipeline | **Wired** after flush finalize | Was **Gap** → fixed | Same hook |
| Live sideband | Monolith sideband session | LiveKit worker + internal API | **Intentional** path | Compare worker § below |
| Operating modes | Full receptionist only | Full + Conversational IVR (4 tools) | **Intentional** | Tests in `test-receptionist-config-source` |
| Phone Call Control ingress | N/A | Supported | **Intentional** | Separate test matrix |
| Transfer | SIP REFER + auth | Ported + Phone foundation executor | **Intentional** extension | `test-voice-v3-transfer-*` (monolith) |
| False booking claim | Golden: delegate then confirm | Oct regression: Amy spoke without tools | **Regression (A)** | Profile fix + forensics; **Verify live** |

## Python LiveKit worker

Shared `voice-runtime-python/transovo_voice/voice_v3/`. Intentional additions: `delegation_runtime_hydration.py`, Phone transfer executor. **Verify live:** delegation telemetry, tool step limits.

## Failed call (Oct 2026) — required evidence

See `docs/VOICE-V3-FAILED-CALL-BOOKING-INVESTIGATION.md`. After deploy, use `VOICE_V3_SESSION_TOOL_SURFACE` + `diagnose-voice-v3-call-booking.ts`.

## What this gate does *not* prove

- PSTN audio behavior, barge-in, or model compliance  
- Microsoft Graph writes on production tenant  
- Webhook HTTP delivery to customer endpoints (requires live URL)  

## Commands

```bash
cd new-app && NODE_OPTIONS='--import ../scripts/preload-server-only.mjs' npx tsx scripts/verify-golden-runtime-parity.ts
```
