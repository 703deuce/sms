# Voice V3 inbound agent resolution trace (Call Handling blocker)

**Status:** Read-only trace — no code changes, no merge/deploy implication.

**Scenario:**

- Canonical voice ingress = PhoneNumber / DID **A**
- Selected AI Receptionist = **Agent #123**
- Agent #123 remains associated with separate DID **B**
- Call Handling changes DID **A** `connection_id` → Voice V3 Basic
- PSTN call arrives **To = DID A**

**Question:** Does production deterministically launch Agent #123 without reassigning the agent to DID A?

---

## Voice V3 inbound trace (To = canonical ingress DID A, agent on DID B)

**Path:** Call Handling routes DID A to Voice V3 Basic → Telnyx `call.initiated` → `POST /api/telnyx/voice/v3-basic` → OpenAI Live accept.

### Flow (production)

1. **`src/app/api/telnyx/voice/v3-basic/route.ts`** — `handleVoiceV3BasicTelnyxWebhook({ eventType, eventPayload })`.

2. **`src/lib/voice-v3-basic/telnyx-webhook-handler.ts`** (`call.initiated`):
   - `noteTelnyxPstnReceived(callControlId, from)` — sets in-memory `lastPstnLeg` (no agent yet).
   - **`tryNotePstnWizardBindingFromToE164({ callControlId, toE164: payload.to, fromE164 })`** — binds workspace + agent before SIP forward.
   - `forwardInboundCallToOpenAiLiveSip(callControlId)` — answer + transfer to OpenAI SIP.

3. **`src/lib/voice-v3/resolve-pstn-wizard-binding.ts`** — `tryNotePstnWizardBindingFromToE164`:
   - `phoneNumber.findFirst({ where: { e164: toE164 } })` → **`workspaceId`** (DID A).
   - `voiceAgent.findMany({ workspaceId, publishedVersionId: { not: null }, orderBy: { updatedAt: "desc" }, take: 12 })`.
   - For each row (newest first): `loadVoiceAgentRuntimeConfig` + **`isAppointmentReceptionistAgent(cfg)`**; on first match → **`notePstnLegWizardContext({ workspaceId, agentId: row.id, ... })`** and **return** (no further agents considered).
   - **Does not read** `voiceAgent.phoneNumberId`, **`VoiceAgentPhoneNumber`**, or **`parkedAiReceptionistAgentId`**.

4. **`src/lib/voice-v3/telemetry/call-trace.ts`** — `notePstnLegWizardContext` overwrites `lastPstnLeg` with `workspaceId` + `agentId`.

5. **`src/app/api/openai/live/incoming/route.ts`** → **`src/lib/voice-v3-basic/openai-live-webhook.ts`** (`handleOpenAiLiveIncomingWebhook`):
   - `pstnLeg = consumeRecentPstnLeg()` (single global “most recent PSTN leg”, max age 120s).
   - If `pstnLeg.workspaceId && pstnLeg.agentId` → **`resolveVoiceV3AgentConfigForAgent({ workspaceId, agentId })`** (`src/lib/voice-v3/config/from-published-agent.ts`).
   - `buildBasicLiveSessionAcceptParams` + `client.live.sessions.accept(sessionId, acceptParams)`.
   - Optional: `createVoiceV3CallRuntime` with that config.

**Not on this path:** `src/lib/voice/inbound.ts`, `src/lib/voice/routing.ts` (`evaluateInboundRouting` + `voiceAgentPhoneNumber` / `voiceAgent.phoneNumberId === pn.id`). Those apply to other Telnyx ingresses, not the isolated v3-basic webhook.

---

## Answers 1–10

| # | Answer |
|---|--------|
| **1. DID A → workspace** | `to` E.164 → `PhoneNumber.e164` → `workspaceId` in `tryNotePstnWizardBindingFromToE164`. |
| **2. How Agent #123 is selected** | Only if #123 is the **first** published agent in the workspace list (up to 12, **`updatedAt` desc**) whose runtime config passes **`isAppointmentReceptionistAgent`**. There is **no** lookup by agent id #123 from Call Handling. |
| **3. `voiceAgent.phoneNumberId === DID A`?** | **No** on the v3-basic PSTN path. |
| **4. `VoiceAgentPhoneNumber` join for DID A?** | **No** on this path (contrast: `routing.ts` lines 100–128 for legacy inbound routing). |
| **5. `tryNotePstnWizardBindingFromToE164`** | **Yes.** Resolves workspace from **To**; picks **one** appointment-receptionist agent by recency; writes context via `notePstnLegWizardContext`. |
| **6. `parkedAiReceptionistAgentId`** | **Call Handling only** (`src/lib/call-handling/*`). **Not referenced** anywhere under `voice-v3` / `voice-v3-basic` inbound. |
| **7. Call on A with agent only on B → launch #123?** | **Can** launch **an** appointment receptionist without reassigning DID B. **Cannot guarantee #123** unless #123 wins the recency loop (typically **only one** published appointment receptionist, or #123 is newest among receptionists). |
| **8. Two published AI Receptionists** | First receptionist in **`updatedAt` desc** order among the 12 published agents wins; the other is ignored for that call. |
| **9. Deterministic for “intended” agent?** | **No** — selection is **workspace + receptionist type + `updatedAt`**, not explicit handler ownership or parked agent id. |
| **10. Proof files** | `route.ts`, `telnyx-webhook-handler.ts`, `resolve-pstn-wizard-binding.ts`, `call-trace.ts`, `openai-live-webhook.ts`, `from-published-agent.ts` (`resolveVoiceV3AgentConfigForAgent`); legacy DID join: `routing.ts`, `agent-phone.ts` (not used on v3-basic). |

---

## Verdict

**AMBIGUOUS** — DID A can reach Voice V3 and start a published appointment receptionist **without** `voiceAgent.phoneNumberId === A` or a join on A (so this is **not** the “NOT SAFE — must establish DID association” failure mode). It does **not** deterministically select **Agent #123** from Call Handling; inbound uses **newest published appointment receptionist in the workspace**, and **`parkedAiReceptionistAgentId` does not participate**. Fine when there is exactly one such agent; **ambiguous / wrong agent** with multiple published receptionists.

A surgical fix at the **orchestration boundary** (still without changing Voice V3 internals) would be to pass the intended `agentId` into the same mechanism `tryNotePstnWizardBindingFromToE164` already uses (`notePstnLegWizardContext`), e.g. from `parkedAiReceptionistAgentId` on the ingress phone — that wiring does **not** exist today.

---

## Platform vs customer SMS (separate from PR #483)

Confirmed: **platform/customer SMS sender semantics remain a separate MCTB launch item**. PR #483 does not touch outbound SMS; the earlier “split sender wins when ingress isn’t authorized” behavior is existing `resolveMctbOutboundSmsRoute` logic, not introduced by Call Handling.
