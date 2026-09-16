/**
 * AI Call Recovery — durable cold hydration (no L1 cache required).
 * Run: VOICE_V2_ACR_HEADLESS=1 NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v2-ai-call-recovery-cold-hydration-headless.ts
 */
import assert from "node:assert/strict";
import type { VoiceV2AiCallRecoverySession } from "@prisma/client";

import {
  clearVoiceV2SmsContinuationCache,
  getVoiceV2SmsContinuation,
  mergeVoiceContinuationIntoConversationTurns,
  resolveVoiceV2SmsContinuation,
} from "../src/lib/voice-v2/ai-call-recovery/continuation-hydration";
import { buildVoiceV2SmsContinuationBundleFromSession } from "../src/lib/voice-v2/ai-call-recovery/durable-continuation";
import {
  setHeadlessRecoverySessionFixture,
  setHeadlessRecoverySessionFixtures,
} from "../src/lib/voice-v2/ai-call-recovery/session-store";
import { registerVoiceV2SmsContinuation } from "../src/lib/voice-v2/ai-call-recovery/continuation-hydration";
import type { VoiceV2RecoveryStructuredState } from "../src/lib/voice-v2/ai-call-recovery/types";

process.env.VOICE_V2_ACR_HEADLESS = "1";

async function main(): Promise<void> {
const workspaceId = "ws_acr_cold_hydration";
const conversationId = "conv_sms_1";
const callerE164 = "+15551234567";
const sendingE164 = "+15559876543";

function fixtureSession(overrides?: Partial<VoiceV2AiCallRecoverySession>): VoiceV2AiCallRecoverySession {
  const structuredState: VoiceV2RecoveryStructuredState = {
    primaryOutcome: "NONE",
    resolutionStatus: "UNRESOLVED_ABANDONED",
    recoverySubtype: "BOOKING_INTERRUPTED",
    callerFields: { name: "Patrice", service_reason: "leak repair" },
    customFields: {
      mother_s_name: "Susan",
      dinosaury: "T-Rex",
      purple_monkey_count: "4",
    },
    schedulingPreference: { requestedDate: "2026-09-17" },
    booking: {
      offerSetId: "offer_voice_1",
      selectedSlotId: "slot_4pm",
      strategy: "MICROSOFT",
    },
    unresolvedAction: "BOOK_SELECTED_SLOT",
    urgencyStatus: "HIGH",
    qualificationStatus: "QUALIFIED",
  };

  const voiceTranscript = [
    { role: "caller", text: "I already shut the main water off." },
    { role: "business", text: "Thanks — I can help schedule a visit." },
    { role: "caller", text: "Tomorrow afternoon works." },
    { role: "business", text: "I have 1 PM, 2 PM, 3 PM, or 4 PM." },
    { role: "caller", text: "Four." },
  ];

  const base: VoiceV2AiCallRecoverySession = {
    id: "sess_1",
    workspaceId,
    voiceCallId: "call_1",
    agentId: "agent_1",
    callerE164,
    sendingPhoneNumberId: "pn_1",
    sendingE164,
    resolutionStatus: "UNRESOLVED_ABANDONED",
    primaryOutcome: "NONE",
    deliveryDecision: "SEND_RECOVERY_SMS",
    recoverySubtype: "BOOKING_INTERRUPTED",
    continuationEnabled: true,
    structuredState: structuredState as object,
    voiceTranscriptTurns: voiceTranscript as object,
    actionTimeline: [{ kind: "booking", summary: "Offered afternoon slots." }] as object,
    callSummary: "Caller chose 4 PM then disconnected.",
    smsConversationId: conversationId,
    recoverySmsSentAt: new Date(),
    recoverySmsStatus: "sent",
    recoveryIdempotencyKey: "voice-v2-acr-send:call_1",
    callerRepliedAt: null,
    continuationStartedAt: null,
    expiresAt: new Date(Date.now() + 86400000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return { ...base, ...overrides };
}

// A–D: durable session → clear L1 → resolve from DB fixture only
{
  setHeadlessRecoverySessionFixture(fixtureSession());
  const warm = buildVoiceV2SmsContinuationBundleFromSession(fixtureSession());
  registerVoiceV2SmsContinuation(conversationId, warm);
  clearVoiceV2SmsContinuationCache();
  assert.equal(getVoiceV2SmsContinuation(conversationId), null);

  const hydrated = await resolveVoiceV2SmsContinuation({
    workspaceId,
    conversationId,
    callerE164,
    sendingE164,
  });
  assert.ok(hydrated);
  assert.equal(hydrated!.recoverySessionId, "sess_1");
  assert.equal(hydrated!.structuredState.customFields.mother_s_name, "Susan");
  assert.equal(hydrated!.structuredState.customFields.dinosaury, "T-Rex");
  assert.equal(hydrated!.structuredState.customFields.purple_monkey_count, "4");
  assert.equal(hydrated!.structuredState.booking?.selectedSlotId, "slot_4pm");
  assert.equal(hydrated!.structuredState.unresolvedAction, "BOOK_SELECTED_SLOT");
  assert.equal(hydrated!.voiceTranscript.length, 5);
}

// Unstructured transcript survives cold hydration (not summary-only)
{
  clearVoiceV2SmsContinuationCache();
  const hydrated = await resolveVoiceV2SmsContinuation({
    workspaceId,
    conversationId,
    callerE164,
    sendingE164,
  });
  const merged = mergeVoiceContinuationIntoConversationTurns({
    voiceTurns: hydrated!.voiceTranscript,
    smsTurns: [
      { role: "business", text: "Sorry we got disconnected — want to finish?" },
      { role: "customer", text: "Yeah, let's continue." },
    ],
  });
  const transcriptText = merged.map((t) => t.text).join("\n");
  assert.match(transcriptText, /main water off/i);
  assert.match(transcriptText, /Yeah, let's continue/);
  assert.ok(hydrated!.callSummary?.includes("4 PM"));
}

// Multiple sessions: smsConversationId wins over same caller/sending recency
{
  const older = fixtureSession({
    id: "sess_stale",
    smsConversationId: "conv_other",
    voiceCallId: "call_stale",
    recoverySmsSentAt: new Date("2026-09-16T12:00:00Z"),
    structuredState: {
      ...(fixtureSession().structuredState as VoiceV2RecoveryStructuredState),
      customFields: { dinosaury: "WRONG" },
    } as object,
  });
  const bound = fixtureSession({
    id: "sess_active",
    smsConversationId: conversationId,
    recoverySmsSentAt: new Date("2026-09-16T11:00:00Z"),
  });
  setHeadlessRecoverySessionFixtures([older, bound]);
  clearVoiceV2SmsContinuationCache();
  const right = await resolveVoiceV2SmsContinuation({
    workspaceId,
    conversationId,
    callerE164,
    sendingE164,
  });
  assert.equal(right?.recoverySessionId, "sess_active");
  assert.notEqual(right?.structuredState.customFields.dinosaury, "WRONG");
}

setHeadlessRecoverySessionFixture(null);
console.log("test-voice-v2-ai-call-recovery-cold-hydration-headless: PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
