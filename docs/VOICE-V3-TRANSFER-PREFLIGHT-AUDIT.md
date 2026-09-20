# Voice V3 transfer — pre-flight audit (2026-09-20)

Authority: `docs/VOICE-V3-TRANSFER-SYSTEM-IMPLEMENTATION-DIRECTIVE.md` (implementation directive).

This audit was run **before** transfer implementation edits, per directive §0.

---

## Installed LiveKit Agents **1.8.2**

| Capability | Status | Notes |
|------------|--------|--------|
| `WarmTransferTask` | **Present** | `livekit.agents.beta.workflows.WarmTransferTask` |
| `WarmTransferResult` | **Present** | `human_agent_identity` |
| `JobContext.transfer_sip_participant` | **Present** | `(participant, transfer_to, play_dialtone=False) → Future[SIPParticipantInfo]` |
| `ringing_timeout` on cold transfer | **API only** | `api.TransferSIPParticipantRequest` has `ringing_timeout`; **JobContext wrapper does not pass it** — executor must call `job_ctx.api.sip.transfer_sip_participant(TransferSIPParticipantRequest(...))` or extend bridge |
| `LIVEKIT_SIP_OUTBOUND_TRUNK` | **Documented in WarmTransferTask** | Falls back when `sip_trunk_id` not passed |

### WarmTransferTask installed signature (1.8.2)

Key kwargs: `sip_call_to`, `sip_trunk_id`, `sip_connection`, `ringing_timeout`, `hold_audio`, `instructions`, `chat_ctx`, `extra_instructions` (deprecated), STT/VAD/LLM/TTS optional.

**Do not** paste current online docs blindly; use installed `livekit/agents/beta/workflows/warm_transfer.py`.

---

## Current Transovo transfer path (preserve)

```
Amy (GPT-Live) → Astra → transfer_call FunctionTool
  → TransovoV3ToolClient (HTTP) → transfer-call-tool.ts execute
  → { status: transfer_requested, data: { destination E164, destination_id } }
  → Python tools.py _maybe_execute_livekit_transfer
  → job_ctx.transfer_sip_participant(sip_identity, tel:+E164, play_dialtone=False)
```

Files:

| Layer | Path |
|-------|------|
| Tool definition + auth | `src/lib/voice-v3/tools/transfer-call-tool.ts` |
| Astra description | `src/lib/voice-v3/tools/astra-tool-contracts.ts` (`TRANSFER_CALL_TOOL_DESCRIPTION`) |
| Catalog gate | `src/lib/voice-v3/tools/voice-tool-catalog.ts` |
| LiveKit bridge | `voice-runtime-python/transovo_voice/voice_v3/tools.py` |
| Server-side SIP (non-worker) | `src/lib/voice/livekit/sip-transfer.ts` |
| Outbound trunk provisioning | `src/lib/telephony/provisioning/livekit/outbound-trunk.ts` |

**Gap vs directive:** only **DIRECT/cold** is implemented; no `WarmTransferTask`, no waterfall orchestration, no structured `transfer_authorized` plan, tool args use `destination` not `route_id` / `destination_id`, phone resolved in TS and returned to Python (correct for execution; must not appear in Astra schema).

---

## Wizard / compiler (partial foundation exists)

Wizard state (`AppointmentReceptionistWizardState`) already includes:

- `transferDestinations[]` (id, label, phoneE164, enabled)
- `transferRouting`: `single` \| `waterfall`
- `transferPlanSteps[]` (destinationId, transferMode `BASIC`\|`WARM`, timeoutSeconds)
- `warmTransfer`, `transferRingSeconds`, `transferFallback`
- `transferTriggers`, legacy single phone fields

Compiled into `VoiceV3AgentConfig`:

- `transferDestinations` via `transferDestinationsFromWizard()` (phones only — **no per-destination mode** in compiled destination rows)
- `callHandling.transferPlanSteps`, `transferRouting`, `warmTransfer`, etc. via `compile-voice-v3-agent-config.ts`

UI: `src/components/solutions/appointment-receptionist/steps/call-handling-step.tsx` (routing, warm, voicemail detect, destinations).

**Gap vs directive:**

- No **transfer routes** with semantic `description` for Astra route selection (only triggers + default plan)
- No per-destination **DIRECT/WARM** in `VoiceV3TransferDestination` type
- No **availability** flags (after-hours / emergency / normal) on destinations
- Wizard UX not reorganized into “Transfer settings → Destinations → Routes” per directive §9–12 (extend, don’t duplicate)
- V2 helper `after-hours-handling-config.ts` builds plans for V2 publish — **reuse patterns**, wire into V3 `transfer_call` authorization

---

## Tool contract gaps

| Directive | Current |
|-----------|---------|
| `route_id` + optional `destination_id` + `reason` | `destination` + `reason` |
| Waterfall: one tool call per route | Not implemented |
| Astra never sees phone/mode | Enum of destination ids only; phones in execute result `data.destination` for Python (OK for runtime, strip from model-visible tool output if leaked) |
| `transfer_authorized` + targets[] plan | `transfer_requested` + single E164 |

---

## Telnyx / LiveKit infra (audit checklist — no secrets)

- Confirm Telnyx SIP trunk **REFER enabled** for cold transfer (LiveKit docs requirement).
- Confirm **outbound** FQDN trunk + LiveKit outbound trunk for warm transfer (`LIVEKIT_SIP_OUTBOUND_TRUNK` or workspace-scoped trunk id).
- Audit existing Coolify env / `src/lib/telephony/provisioning/livekit/*` before adding duplicate trunks.

---

## Observability / DB

- LiveKit V3 calls often **do not** populate `voice_calls` / `voice_tool_executions` (see cancel/reschedule forensics 2026-09-20).
- Directive §31: add structured `VOICE_V3_TRANSFER_*` log events; do not block on legacy audit rebuild.

---

## Recommended implementation order

1. **Types + compiler** — `VoiceV3TransferConfig` (destinations with mode/timeout/eligibility, routes with descriptions, fallback); publish validation.
2. **transfer_call** — resolve route/destination → authorized plan; idempotency; telemetry events.
3. **Python** — `transfer_executor.py`: DIRECT (REFER + ringing_timeout via API request), WARM (`WarmTransferTask`), WATERFALL sequential loop; preserve existing cold path behavior.
4. **Prompts** — Amy + Astra per directive §27–28; expand `TRANSFER_CALL_TOOL_DESCRIPTION`.
5. **Wizard** — extend call-handling step (route editor, per-destination mode); no parallel settings system.
6. **Tests** — config matrix, executor unit tests with fakes, then PSTN cert scripts on `+15717491060`.

---

## Incompatibilities to report (not blockers)

1. **Cold `ringing_timeout`**: supported on `TransferSIPParticipantRequest`, not on `JobContext.transfer_sip_participant` — use direct API call in Python executor.
2. **Multiple transfer routes with semantic descriptions**: schema/UI work required; wizard has single default plan pattern today.

---

## Do not regress (directive §44)

Microsoft book/find/cancel/reschedule, SEND_LINK, `request_callback`, intake, OfferSets, conversation freshness, idempotency, GPT-Live delegation, LiveKit session lifecycle, `EndCallTool`.
