# Transovo Amy — LiveKit Voice Runtime Migration

## KEEP / ADAPT / RETIRE Matrix

| Component | Verdict | Notes |
|-----------|---------|-------|
| Telnyx PSTN / SIP trunk | **KEEP** | Carrier remains Telnyx; test number routes to LiveKit inbound SIP |
| Telnyx Messaging (SMS) | **KEEP** | Async/queued sends unchanged |
| Telnyx AI Assistant (`syncTelnyxAssistant`) | **RETIRE** (runtime) | Kept behind `VOICE_RUNTIME_PROVIDER=telnyx` |
| `runtime_turn` HTTP webhook | **RETIRE** (LiveKit path) | Not called from LiveKit AgentSession |
| Workflow engine + `continue_workflow` internals | **KEEP** | Domain services reused via `domain-actions/` |
| Field runtime + custom fields | **KEEP** | `record_field` tool → `recordCurrentField` |
| Calendly availability/book/hold | **KEEP** | Via `executeContinueWorkflow` / agent-tool-gateway |
| Operation receipts + idempotency | **KEEP** | Unchanged |
| VoiceCall + transcripts + ANI | **KEEP** | Bootstrap at LiveKit session start |
| Owner Amy / Workflow Architect | **KEEP** | Publish workflow config; not in live call |
| Realtime session cache (`realtime-session/`) | **ADAPT** | Hot state for both Telnyx + LiveKit |
| Caller prompt modules | **ADAPT** | `amy-livekit-prompt.ts` for LiveKit permanent prompt |
| `latency-profiles` Telnyx fillers | **RETIRE** (LiveKit) | LiveKit handles turn-taking natively |

## Architecture

### Before
```
PSTN → Telnyx → Telnyx AI Assistant → HTTP runtime_turn → Transovo
```

### After (LiveKit)
```
PSTN → Telnyx SIP → LiveKit Room → transovo-voice-runtime (AgentSession)
  → task-scoped tools → domain-actions → workflow engine → DB/Calendly
```

## Runtime Provider

```bash
VOICE_RUNTIME_PROVIDER=livekit   # default in dev
VOICE_RUNTIME_PROVIDER=telnyx    # legacy production Amy until cutover
```

Code: `src/lib/voice/runtime-provider/`

## LiveKit Deployment

- **Agent name:** `transovo-voice-runtime` (`LIVEKIT_AGENT_NAME`)
- **Multi-tenant:** room metadata JSON `{ workspaceId, agentId, fromE164, toE164 }`
- **Entry:** `voice-runtime/src/main.ts`

### Local dev
```bash
npm run voice-runtime:dev
```

### LiveKit Cloud deploy
```bash
cd voice-runtime
lk agent create   # first time
lk agent dev      # development
lk agent deploy   # production
```

## Task-Scoped Tools

| Task | Visible tools |
|------|----------------|
| DiscoverIntentTask | record_field, request_human, end_call |
| CollectBookingFieldsTask | record_field, request_human, end_call |
| CheckAvailabilityTask | check_availability, request_human, end_call |
| SelectSlotTask | select_slot, check_availability, request_human, end_call |
| ConfirmBookingTask | confirm_booking, request_human, end_call |
| CompleteCallTask | end_call, request_human |

Backend guard: `src/lib/voice/domain-actions/task-guard.ts`

## Telnyx SIP → LiveKit (manual steps — YOU must complete)

### Telnyx Dashboard
1. Create **FQDN SIP Connection** (not TeXML assistant route for test number).
2. Point connection to LiveKit SIP ingress FQDN from LiveKit project settings.
3. Assign **dedicated test DID** only — do NOT move production Amy +18663464256 yet.
4. Ensure caller ID is sent in **+E.164** format.

### LiveKit Cloud Dashboard
1. Create inbound **SIP trunk** (Telnyx provider docs: https://docs.livekit.io/sip/quickstarts/configuring-telnyx-trunk/)
2. Create **dispatch rule** routing to agent `transovo-voice-runtime`
3. Set dispatch metadata template with `workspaceId`, `agentId`, `fromE164`, `toE164`

## Environment Variables (you provide)

| Variable | Required for |
|----------|----------------|
| `LIVEKIT_URL` | Local dev + deploy |
| `LIVEKIT_API_KEY` | Local dev + deploy |
| `LIVEKIT_API_SECRET` | Local dev + deploy |
| `OPENAI_API_KEY` | LLM (default gpt-4.1-mini) |
| `ELEVENLABS_API_KEY` | TTS if `VOICE_TTS_PROVIDER=elevenlabs` |
| `DATABASE_URL` | Domain services (existing) |
| `REDIS_URL` | Session store at scale (optional) |

LiveKit Cloud injects `LIVEKIT_*` automatically on deployed agents.

## Testing

```bash
npm run test:amy-livekit-preprod
npm run test:caller-amy-preprod   # legacy Telnyx path (still required)
```

## Live Acceptance (after deploy)

1. Route **test number only** to LiveKit SIP.
2. Call: "Hi, I need to make an appointment. My kitchen sink is leaking."
3. Verify: natural response, field collection, availability, slot pick, confirm, single booking, transcript + VoiceCall persisted.
4. Run 10 calls; capture p50/p95 for end-of-speech → first audio via LiveKit Cloud traces.

## NOT complete until

A real PSTN call through LiveKit SIP completes one appointment end-to-end. Code + automated tests alone are not sufficient.
