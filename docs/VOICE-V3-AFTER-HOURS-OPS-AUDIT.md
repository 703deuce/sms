# Voice V3 — After-Hours Operations & Call Experience (audit)

## EXISTS_AND_REUSE

| Area | Location |
|------|----------|
| `request_callback` tool + executor | `src/lib/voice-v3/tools/request-callback-tool.ts`, `callback/execute-request-callback.ts` |
| Callback persistence | `callback/persist-voice-v3-callback-request.ts` → `callbackRequest` |
| Intake / collect fields | `collectFields`, `callbackRequiredCollectFieldIds`, `wizard-collect-fields-v3.ts` |
| Calls API + detail | `src/app/api/voice/calls/*`, `voiceCall` + events/transcripts/recordings |
| Calls UI shell | `/voice/calls`, `/voice/calls/[id]` (was mixing mock when API empty) |
| Outcome badges | `src/lib/voice/calls/display.ts`, `detail.ts` |
| SMS / email infra | `sendQuickSms`, `sendTransactionalEmail` |
| Transfer telemetry | `src/lib/voice-v3/transfer/*` |
| Post-call | `src/lib/voice/post-call.ts` |

## PARTIAL_EXTEND (this pass)

| Item | Change |
|------|--------|
| `callbackRequiredCollectFieldIds` manifest | Mapped in `wizard-v3-manifest-builder.ts` |
| Wizard UX | Messages & callbacks + after-hours notifications editor |
| Notification layer | `src/lib/voice-v3/notifications/*` (policy → dispatch) |
| Callback post-persist | Project call outcome + notify (async, non-blocking) |
| Calls list | No mock fallback when API returns empty |
| Astra callback copy | Covers “leave a message” without new tool |

## MISSING_ADD (follow-up, not in this pass)

| Item | Notes |
|------|-------|
| Transfer/booking notification hooks | Event types defined; wire at transfer/booking boundaries next |
| Emergency classification notifications | Depends on authoritative emergency event source |
| Post-call LLM summary job | Audit `post-call.ts`; async only |
| Full Call Detail V3 timeline | API has events; UI polish ongoing |
| PSTN CERT A–D | Manual on +15717491060 |

## LEGACY_DO_NOT_TOUCH

- MCTB engines, Mass Texting, Microsoft booking pipeline core, Transfer executor Python path
- No `take_message` / `notify_owner` tools

## Take message = callback

Customer copy: **Take messages and callback requests** → runtime remains **`request_callback`** only.
