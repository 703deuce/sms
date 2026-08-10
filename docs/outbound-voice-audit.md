# Outbound Voice Architecture Audit (Transovo)

**Date:** 2026-08-10  
**Scope:** First outbound agent — New Lead Qualification (LiveKit path)  
**Authority:** Local `/agent/repos/agents` + `/agent/repos/sms`

---

## A. Current inbound telephony architecture

```
PSTN → Telnyx DID
     → Telnyx FQDN connection ("Transovo LiveKit Inbound")
     → LiveKit SIP ingress (*.sip.livekit.cloud)
     → Inbound trunk (transovo-telnyx-inbound)
     → Dispatch rule (transovo-inbound-dispatch, room prefix transovo-call-)
     → Worker LIVEKIT_AGENT_NAME=transovo-voice-runtime
     → voice-runtime/src/main.ts
     → Amy (workflow) OR Frontdesk (Calendly) by agent profile
     → VoiceCall row (direction INBOUND)
```

**Key files:** `voice-runtime/src/main.ts`, `src/lib/telephony/provisioning/`, `src/lib/voice/runtime-provider/livekit.ts`

---

## B. What is missing for Telnyx/LiveKit outbound

| Capability | Inbound | Outbound (needed) |
|------------|---------|-------------------|
| LiveKit SIP trunk | ✅ Inbound trunk | ❌ **No outbound trunk** |
| Telnyx → LiveKit | ✅ FQDN connection | N/A (reverse direction) |
| LiveKit → Telnyx PSTN | N/A | ❌ **Outbound trunk + Telnyx SIP auth** |
| Telnyx Outbound Voice Profile | Partial (Call Control path) | ✅ Exists for human/assistant dial; **not wired to LiveKit SIP** |
| Worker entry | ✅ `main.ts` inbound only | ❌ **Separate outbound worker** |
| Agent dispatch | ✅ Via SIP dispatch rule | ❌ **Explicit `AgentDispatchClient.createDispatch`** |
| SIP participant create | N/A | ❌ **`SipClient.createSipParticipant`** |
| AI outbound runtime | Telnyx Assistant only | ❌ **LiveKit worker path** |

**Existing Telnyx outbound (do not break):** `initiateOutboundCall` → `dialOutboundCall` (Call Control + `assistant_id`). Human softphone uses same Call Control app + OVP.

---

## C. LiveKit TypeScript APIs (installed SDK)

From `livekit-server-sdk` + `@livekit/agents`:

| API | Purpose |
|-----|---------|
| `SipClient.createSipOutboundTrunk(name, address, numbers, opts)` | Provision outbound trunk to carrier |
| `SipClient.listSipOutboundTrunk()` | Inspect trunks |
| `SipClient.createSipParticipant(trunkId, number, roomName, opts)` | **Originate PSTN call into room** |
| `AgentDispatchClient.createDispatch({ agentName, room, metadata })` | Dispatch outbound worker to room |
| `session.start({ agent, room })` **before** `createSipParticipant` | Agent-first pattern (no dead air) |
| `opts.waitUntilAnswered: true`, `opts.fromNumber` | Block until answer; set caller ID |

Reference: `/agent/repos/agents/examples/telephony/amd.py`, `@livekit/agents` `warm_transfer.ts`

---

## D. Telnyx configuration required

1. **Outbound Voice Profile (OVP)** — already provisioned via `telnyx-outbound-voice.ts` for Call Control; verify US destinations whitelisted.
2. **LiveKit outbound trunk** — new; points to Telnyx SIP endpoint (`sip.telnyx.com` or regional) with credential auth from env.
3. **Caller ID** — use an owned Transovo `PhoneNumber.e164` assigned to the outbound agent (not hardcoded).
4. **Do not modify** inbound FQDN connection or inbound LiveKit trunk.

**Env (see `.env.example`):**

- `LIVEKIT_OUTBOUND_TRUNK_ID` — optional; auto-provisioned if missing
- `TELNYX_SIP_OUTBOUND_ADDRESS` — default `sip.telnyx.com`
- `TELNYX_SIP_OUTBOUND_USERNAME` / `TELNYX_SIP_OUTBOUND_PASSWORD` — Telnyx credential connection
- `LIVEKIT_OUTBOUND_AGENT_NAME` — default `transovo-outbound-voice-runtime`
- `OUTBOUND_VOICE_TEST_MODE=1` — required for CLI test dial
- `OUTBOUND_TEST_PHONE` — dev-only destination (e.g. `+15714776175`)

---

## E. Reusable Transovo modules

- `VoiceCall`, `VoiceTranscript`, `VoiceToolExecution`, `VoiceConversationInsight.qualification`
- `Contact` (lead record)
- `RuntimeFieldManifestEntry` / field collection patterns
- `resolveBusinessAnswer` / `get_business_answer`
- `livekit-call-telemetry.ts`, transcript persistence
- `buildAmyVoicePipeline`, turn config
- `telnyx-outbound-voice.ts` (OVP readiness audit)
- Compliance: `voiceComplianceProfile`, `suppression`

---

## F. New modules (this PR)

| Module | Role |
|--------|------|
| `src/lib/telephony/provisioning/livekit/outbound-trunk.ts` | Outbound trunk ensure/list |
| `src/lib/voice/outbound/*` | Types, evaluator, `OutboundCallService`, persistence |
| `voice-runtime/src/outbound/*` | Agent, task, userdata |
| `voice-runtime/src/outbound-main.ts` | Outbound worker entry (separate agent name) |
| `scripts/audit-outbound-telephony.ts` | Pre-flight audit |
| `scripts/test-outbound-qualification.ts` | Unit tests |
| `scripts/outbound-lead-smoke-call.ts` | Manual test trigger |

---

## G. OutboundCallService API

```typescript
startOutboundCall({
  workspaceId,
  agentId,
  destinationPhone,
  leadId?,
  contactId?,
  trigger: { source, reason },
  qualification: QualificationDefinition,
  leadContext: { name?, phone, source?, ... },
  metadata?,
}): Promise<{
  callId,
  roomName,
  dispatchId,
  status: "dispatching" | "dialing" | "failed",
}>
```

Worker completes dial after `session.start()` (agent-first).

---

## H. NewLeadQualificationAgent structure

```
NewLeadQualificationAgent (voice.Agent)
  instructions: outbound warm-lead, no booking
  tools: end_call
  onEnter: run QualifyLeadTask
```

---

## I. QualifyLeadTask structure

```
QualifyLeadTask (AgentTask)
  tools:
    - record_qualification_fields (batch authoritative update)
    - set_qualification_outcome (wrong_number | not_interested | callback_requested | complete)
    - get_business_answer (optional knowledge)
  memory:
    - ChatContext: conversation
    - userData.collectedFields: authoritative
  on complete: evaluate rules → LeadQualificationResult → persist
```

---

## J. DB models

**Reuse (no schema migration):**

- `VoiceCall` — `direction: OUTBOUND`, `metadata.outbound`, `metadata.qualification`
- `VoiceConversationInsight.qualification` — structured result JSON
- `Contact` — update `customFields` with collected qualification fields

---

## K. Test strategy

1. **Unit:** `test-outbound-qualification.ts` — evaluator, field merge, outcome mapping, request validation
2. **Static:** `test-outbound-lead-agent.ts` — agent wiring, no booking tools
3. **Audit:** `audit-outbound-telephony.ts` — trunk, OVP, caller ID
4. **PSTN:** `outbound-lead-smoke-call.ts` — one call when `OUTBOUND_VOICE_TEST_MODE=1`

---

## L. Steps before first real call

1. Run `npx tsx scripts/audit-outbound-telephony.ts`
2. Set Telnyx SIP outbound credentials in env
3. Run `ensureLiveKitOutboundTrunk` (via audit or smoke script)
4. Deploy **outbound worker** (`voice-runtime:outbound`) alongside inbound worker
5. Create/configure outbound qualification agent (`livekitProfile: outbound_lead_qualification`)
6. Assign caller ID number to agent
7. `OUTBOUND_VOICE_TEST_MODE=1 npx tsx scripts/outbound-lead-smoke-call.ts --phone=+15714776175`
8. Answer phone; verify greeting, qualification, persistence

**Inbound unchanged:** same `transovo-voice-runtime` worker, same inbound trunk/dispatch.
