import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { appendTraceEvent } from "@/lib/voice/workflow-engine/trace";
import type {
  LeadQualificationResult,
  OutboundCallStartResult,
  OutboundCallTrigger,
  OutboundJobMetadata,
  OutboundLeadContext,
  QualificationDefinition,
  TelephonyOutcome,
} from "./types";

import { TRANSOVO_OUTBOUND_AGENT_NAME } from "@/lib/telephony/provisioning/config";

export const TRANSOVO_OUTBOUND_ROOM_PREFIX =
  process.env.LIVEKIT_OUTBOUND_ROOM_PREFIX?.trim() || "transovo-outbound-";

/** @deprecated Outbound uses dedicated outbound worker — not the inbound Python agent. */
export const TRANSOVO_OUTBOUND_AGENT_NAME_EXPORT = TRANSOVO_OUTBOUND_AGENT_NAME;

const E164_RE = /^\+[1-9]\d{6,14}$/;

export function validateOutboundDestination(phone: string): string {
  const normalized = normalizeE164(phone);
  if (!E164_RE.test(normalized)) {
    throw new Error(`Invalid destination phone: ${phone}`);
  }
  return normalized;
}

export function assertOutboundTestModeEnabled(): void {
  const enabled =
    process.env.OUTBOUND_VOICE_TEST_MODE === "1" ||
    process.env.OUTBOUND_VOICE_TEST_MODE === "true";
  if (!enabled) {
    throw new Error(
      "Outbound test mode is disabled. Set OUTBOUND_VOICE_TEST_MODE=1 for manual test dials.",
    );
  }
}

async function resolveOutboundCallerId(input: {
  workspaceId: string;
  agentId: string;
  fromE164?: string;
}): Promise<{ e164: string; phoneNumberId: string | null }> {
  const prisma = getPrisma();
  if (input.fromE164?.trim()) {
    return { e164: normalizeE164(input.fromE164), phoneNumberId: null };
  }

  const join = await prisma.voiceAgentPhoneNumber.findFirst({
    where: {
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      outboundEnabled: true,
    },
    orderBy: { isDefault: "desc" },
  });
  if (join) {
    const phone = await prisma.phoneNumber.findFirst({
      where: { id: join.phoneNumberId, workspaceId: input.workspaceId },
      select: { id: true, e164: true },
    });
    if (phone?.e164) {
      return { e164: phone.e164, phoneNumberId: phone.id };
    }
  }

  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
    select: { phoneNumberId: true },
  });
  if (agent?.phoneNumberId) {
    const pn = await prisma.phoneNumber.findFirst({
      where: { id: agent.phoneNumberId, workspaceId: input.workspaceId },
      select: { e164: true },
    });
    if (pn?.e164) {
      return { e164: pn.e164, phoneNumberId: agent.phoneNumberId };
    }
  }

  throw new Error(
    "No outbound caller ID configured — assign a phone number to this agent with outbound enabled",
  );
}

export async function startOutboundLeadQualificationCall(input: {
  workspaceId: string;
  agentId: string;
  destinationPhone: string;
  qualification: QualificationDefinition;
  lead: OutboundLeadContext;
  trigger: OutboundCallTrigger;
  fromE164?: string;
  isTest?: boolean;
  /** When true (default for isTest), requires OUTBOUND_VOICE_TEST_MODE in env (CLI safety). */
  requireTestModeEnv?: boolean;
  /** Per-call OpenAI Realtime native voice (marin, coral, etc.). */
  realtimeVoice?: string;
}): Promise<OutboundCallStartResult> {
  if (input.isTest && input.requireTestModeEnv !== false) {
    assertOutboundTestModeEnabled();
  }

  const destinationE164 = validateOutboundDestination(input.destinationPhone);
  const { e164: callerIdE164, phoneNumberId } = await resolveOutboundCallerId({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    fromE164: input.fromE164,
  });

  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
    select: { id: true, publishedVersionId: true, status: true },
  });
  if (!agent) throw new Error("Agent not found");

  const suppressed = await prisma.suppression.findFirst({
    where: { workspaceId: input.workspaceId, phone: destinationE164 },
  });
  if (suppressed) throw new Error("Destination is on suppression list");

  const compliance = await prisma.voiceComplianceProfile.findUnique({
    where: { workspaceId: input.workspaceId },
  });
  if (compliance?.emergencyStop) {
    throw new Error("Voice emergency stop is active");
  }

  const call = await prisma.voiceCall.create({
    data: {
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      agentVersionId: agent.publishedVersionId,
      phoneNumberId,
      contactId: input.lead.contactId || undefined,
      direction: "OUTBOUND",
      status: "QUEUED",
      fromE164: callerIdE164,
      toE164: destinationE164,
      isTest: Boolean(input.isTest),
      metadata: {
        source: "livekit_outbound",
        outbound: {
          kind: "lead_qualification",
          trigger: input.trigger,
          lead: input.lead,
          qualificationId: input.qualification.id,
        },
      } as object,
    },
  });

  const roomName = `${TRANSOVO_OUTBOUND_ROOM_PREFIX}${call.id}`;
  const calleeParticipantIdentity = `callee-${call.id}`;

  const jobMetadata: OutboundJobMetadata = {
    kind: "outbound_lead_qualification",
    callId: call.id,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    destinationE164,
    callerIdE164,
    calleeParticipantIdentity,
    lead: input.lead,
    trigger: input.trigger,
    qualification: input.qualification,
    ...(input.realtimeVoice?.trim() ? { realtimeVoice: input.realtimeVoice.trim() } : {}),
  };

  await prisma.voiceCall.update({
    where: { id: call.id },
    data: {
      metadata: {
        source: "livekit_outbound",
        livekitRoomName: roomName,
        outbound: jobMetadata,
      } as object,
    },
  });

  await appendTraceEvent(call.id, {
    kind: "outbound_request_created",
    detail: {
      destinationE164,
      callerIdE164,
      roomName,
      agentName: TRANSOVO_OUTBOUND_AGENT_NAME,
      realtimeVoice: jobMetadata.realtimeVoice || null,
    },
  }).catch(() => undefined);

  const { AgentDispatchClient } = await import("livekit-server-sdk");
  const { requireLiveKitEnv } = await import("@/lib/voice/runtime-provider/config");
  const { url, apiKey, apiSecret } = requireLiveKitEnv();
  const dispatchClient = new AgentDispatchClient(url, apiKey, apiSecret);

  let dispatchId: string | null = null;
  try {
    const dispatch = await dispatchClient.createDispatch(
      roomName,
      TRANSOVO_OUTBOUND_AGENT_NAME,
      { metadata: JSON.stringify(jobMetadata) },
    );
    dispatchId = dispatch.id || null;

    await prisma.voiceCall.update({
      where: { id: call.id },
      data: { status: "RINGING" },
    });

    await appendTraceEvent(call.id, {
      kind: "agent_dispatch_created",
      detail: { dispatchId, roomName },
    }).catch(() => undefined);

    return {
      callId: call.id,
      roomName,
      dispatchId,
      status: "dispatching",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.voiceCall.update({
      where: { id: call.id },
      data: {
        status: "FAILED",
        errorMessage: message,
        endedAt: new Date(),
      },
    });
    return {
      callId: call.id,
      roomName,
      dispatchId,
      status: "failed",
      error: message,
    };
  }
}

export async function persistLeadQualificationResult(input: {
  callId: string;
  workspaceId: string;
  result: LeadQualificationResult;
  telephonyOutcome: TelephonyOutcome;
}): Promise<void> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
    select: { contactId: true, metadata: true },
  });
  if (!call) return;

  const isQualified = ["QUALIFIED", "HOT", "COMPLETED_INTAKE"].includes(input.result.outcome);

  const existingInsight = await prisma.voiceConversationInsight.findFirst({
    where: { callId: input.callId },
  });
  if (existingInsight) {
    await prisma.voiceConversationInsight.update({
      where: { id: existingInsight.id },
      data: {
        summary: input.result.summary,
        isLead: isQualified,
        leadScore: input.result.score ?? (isQualified ? 80 : 20),
        qualification: input.result as object,
        customFields: input.result.collectedFields as object,
      },
    });
  } else {
    await prisma.voiceConversationInsight.create({
      data: {
        workspaceId: input.workspaceId,
        callId: input.callId,
        summary: input.result.summary,
        isLead: isQualified,
        leadScore: input.result.score ?? (isQualified ? 80 : 20),
        qualification: input.result as object,
        customFields: input.result.collectedFields as object,
      },
    });
  }

  if (call.contactId) {
    const existing = await prisma.contact.findFirst({
      where: { id: call.contactId, workspaceId: input.workspaceId },
      select: { customFields: true },
    });
    const prev = (existing?.customFields || {}) as Record<string, unknown>;
    await prisma.contact.update({
      where: { id: call.contactId },
      data: {
        customFields: {
          ...prev,
          lastOutboundQualification: input.result,
        } as object,
      },
    });
  }

  const meta = (call.metadata || {}) as Record<string, unknown>;
  await prisma.voiceCall.update({
    where: { id: input.callId },
    data: {
      outcome: input.result.outcome,
      leadScore: input.result.score ?? undefined,
      appointmentBooked: false,
      metadata: {
        ...meta,
        telephonyOutcome: input.telephonyOutcome,
        qualificationResult: input.result,
      } as object,
    },
  });

  await appendTraceEvent(input.callId, {
    kind: "outbound_result_persisted",
    detail: {
      outcome: input.result.outcome,
      telephonyOutcome: input.telephonyOutcome,
    },
  }).catch(() => undefined);
}

export function mapSipErrorToTelephonyOutcome(err: unknown): TelephonyOutcome {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  if (/busy/i.test(lower)) return "BUSY";
  if (/no.?answer|timeout|unanswered/i.test(lower)) return "NO_ANSWER";
  if (/reject/i.test(lower)) return "REJECTED";
  if (/cancel/i.test(lower)) return "CANCELLED";
  if (/voicemail|machine/i.test(lower)) return "VOICEMAIL";
  return "FAILED";
}
