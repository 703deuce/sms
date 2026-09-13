# After-Hours Voice Pipeline — End-to-End Audit

**Last reviewed:** 2026-09-13  
**Profile:** MCTB same-number `VOICE_AGENT` + TeXML-direct + Telnyx Conversation Workflow

## Intended flow (happy path)

```
PSTN → MCTB DID (+18663464256) → TeXML app → Telnyx AI Assistant (Amy)
  → Workflow node GENERAL (FAQ + booking intake, no tools)
  → Caller agrees to SMS → node ACTION (send_resource only)
  → POST {APP_URL}/api/telnyx/voice/tools  (or narrow route — see below)
  → ensure VoiceCall (or send SMS with ANI + conversation id)
  → SMS From: workspace 571 (not toll-free voice DID)
  → Agent confirms success; call continues in GENERAL
```

## Layer map

| Step | Component | Failure mode we saw |
|------|-----------|-------------------|
| Ingress | `setInboundHandlingMode` → TeXML direct | OK |
| Instructions | `compileVoiceAgentPrompt` + workflow append | Appointment-type wording from old wizard data |
| Workflow routing | `buildAmyConversationWorkflow` | Early jump to ACTION (fixed: consent edge) |
| Tool URL | **Telnyx shared tools** | Was `/api/voice/tools/send-resource` (narrow); now synced to `/api/telnyx/voice/tools` |
| Call row | `ensureVoiceCallForToolWebhook` | Missing on TeXML → `call_not_ready` (fixed: fallback + SMS without row) |
| Tool guard | `assertToolAllowed` | Blocked without callId (fixed: exempt `send_resource`) |
| SMS | `executeSendResource` → `sendQuickSms` | Needs deploy + 571 on workspace |

## Single source of truth

| Concern | Canonical |
|---------|-----------|
| Tool body schema | `catalog.ts` → `builtin-webhook-bodies.ts` |
| Shared Telnyx tools | `shared-tools.ts` (PATCH on each publish) |
| After-hours policy | `wizard-policy-bridge.ts` + `voice-profile.ts` |
| Workflow graph | `conversation-workflow.ts` (receives `config` for after_hours) |
| Outbound SMS From | `voice-outbound-sms-from.ts` |
| Booking link URL | `voice-resource-config.ts` + env `VOICE_BOOKING_LINK_URL` |

## Deploy vs republish

| Change | Republish assistant | Deploy app |
|--------|---------------------|------------|
| Workflow / prompt | Yes | No |
| Shared tool URL/schema | Yes (via `syncConversationWorkflowToTelnyx`) | No |
| `send_resource` / ensure-call logic | No | **Yes** |
| `APP_URL` for webhooks | Env on host | **Yes** |

**Production must have `APP_URL` (or `NEXT_PUBLIC_APP_URL`) set to the HTTPS host Telnyx can reach.**

## Observability gaps (known)

- TeXML-direct may not create `VoiceCall` until tool webhook or `texml-status` — acceptable if tools succeed.
- `voiceToolExecution` rows depend on `/api/telnyx/voice/tools` path; narrow route logs via `providerWebhookEvent` ingress.
- MCTB `voice_agent_selected` audit uses `callId: null` until backend links conversation.

## Regression test

```bash
npx tsx scripts/test-after-hours-voice-pipeline.ts
npx tsx scripts/test-conversation-workflow.ts
npx tsx scripts/test-voice-runtime-policy.ts
```

## Out of scope (V1)

- Live calendar / slot offer on call
- Post-call CRM write during call
- Callback ticket creation tool (conversational capture only unless wired separately)
