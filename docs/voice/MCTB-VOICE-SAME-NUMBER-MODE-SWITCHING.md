# MCTB + After-Hours Voice Agent — Same-Number Mode Switching

## Product rule

One forwarded Transovo ingress number per business line. Carrier forwarding is unchanged when switching between:

- `MCTB_RECOVERY` — Press-1 / recovery / voicemail path (`/api/telnyx/voice/mctb-entry`)
- `VOICE_AGENT` — Telnyx AI assistant on the **same DID** (`routePhoneToTexmlAssistant`)

## Canonical field

Stored on `PhoneNumber.settingsJson.mctbInbound`:

| Field | Purpose |
|-------|---------|
| `inboundHandlingMode` | `MCTB_RECOVERY` \| `VOICE_AGENT` |
| `voiceAgentId` | Linked voice agent |
| `voiceAgentEnabled` | Runtime flag |
| `texmlAppId` | MCTB TeXML app (restore target) |
| `voiceTexmlAppId` | Assistant TeXML app when voice mode on |

## Router

`resolveInboundHandlingDecision()` in `src/lib/mctb/inbound-handling/router.ts`

- Exactly one `primaryHandler` per call policy evaluation
- Voice mode with unreadiness → `voice_agent_unavailable_fallback_mctb` (MCTB answers)

## Switch API

`GET/PATCH /api/mctb/inbound-handling`

Activation on MCTB workspaces calls `setInboundHandlingMode({ mode: VOICE_AGENT })` after successful Telnyx publish.

Turning voice off via UI calls `MCTB_RECOVERY` — restores MCTB TeXML connection on the same number.

## UI

- Voice Agent page: `CallHandlingModeSwitch`
- Wizard phone step (MCTB): reuses MCTB line + forwarding status

## Tests

`npx tsx scripts/test-mctb-inbound-handling-mode.ts`
