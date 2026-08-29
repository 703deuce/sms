# AI After Hours restore — implementation audit

## WORKING — preserve

| Area | Location |
|------|----------|
| Python LiveKit runtime | `voice-runtime-python/` (`TransovoReceptionistAgent`, templates) |
| Voice agent CRUD API | `/api/voice/agents/**` |
| Agent service | `src/lib/voice/agent-service.ts` |
| Inbound routing | `resolveAgentByCalledNumber()` → `resolveInboundAiAgent()` in `agent-routing.ts` / `agent-phone.ts` |
| Agent UI | `/voice/agents`, `/voice/agents/new`, `/voice/agents/[id]/*` |
| Calls, knowledge, inbound routing | `/voice/calls`, `/voice/knowledge`, `/voice/inbound-routing` |
| After-hours schedule logic | `resolveEffectiveAction()` in `src/lib/voice/inbound.ts` |
| SMS from voice (TS gateway) | `runSendSms` → `voice_send_sms` → `sendQuickSms` |
| MCTB runtime | `src/lib/mctb/`, `voice-runtime-python/transovo_voice/session/mctb_*` |

## PARTIAL — extended this pass

| Area | Change |
|------|--------|
| Product switcher | Restored 3-product switcher (SMS / MCTB / AI After Hours) |
| AI product visibility | `isAiAfterHoursEntitled(hasVoice)` — internal key `ai_receptionist` |
| AI nav | `buildAiAfterHoursNav()` reuses existing routes |
| LiveKit default | `DEFAULT_MEDIA_BACKEND_MODE=livekit_cloud` |
| Python `send_sms` | New tool → internal `send_sms` action |
| Number capabilities | `readPhoneCapabilities()` — independent flags |
| MCTB + AI config | Removed hard block on AI agent assign for MCTB SIP numbers |

## DEAD/LEGACY — do not route production through

| Area | Notes |
|------|-------|
| `voice-runtime/src/main.ts` | Exits immediately; use `voice-runtime-python` only |
| Self-hosted LiveKit (`voice.transovo.ai`) | Frozen constants remain for reference; not production default |

## MISSING / MANUAL_PENDING

| Gate | Status |
|------|--------|
| Real PSTN inbound to LiveKit Cloud agent | MANUAL_PENDING — run cert script then place test call |
| ws_1 number AI binding | Audit via `npx tsx scripts/test-ai-after-hours-cert.ts` |

## LiveKit Cloud (this environment)

- `LIVEKIT_URL` host pattern: **livekit.cloud** (verified, secrets not logged)
- `MEDIA_BACKEND_MODE` unset → defaults to **livekit_cloud** after this change
- SIP trunk IDs: frozen in `src/lib/voice/media-backend/constants.ts` (`LIVEKIT_CLOUD_*`)

## Routing precedence (MCTB vs AI)

- MCTB SIP ingress: `check_mctb_sip_ingress` in Python dispatch (Call Control path)
- AI receptionist: LiveKit SIP dispatch → `resolveAgentByCalledNumber`
- Same number may store both capability flags; ingress path selects behavior per call
