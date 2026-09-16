import "server-only";

import { getPrisma } from "@/lib/db";
import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import {
  resolveVoiceV2BookingStrategy,
  structuredOutcomeForStrategy,
  type VoiceV2BookingStrategy,
} from "@/lib/voice-v2/booking-strategy";
import { deliverVoiceV2BusinessRequestNotifications } from "./business-request-notifications";
import { transitionAfterCallerRequestFinalized } from "./booking-workflow";
import { ensureVoiceV2CallContext, resolveSessionKey } from "./intake/load-call-context";
import { getIntakeReadiness } from "./intake/readiness";
import { getVoiceV2CallContext, setVoiceV2CallContext } from "./intake/session-store";
import type { VoiceV2CallContext } from "./intake/types";

export type FinalizeCallerRequestResult =
  | {
      status: "CALLER_REQUEST_ACCEPTED";
      outcome: "MESSAGE_TAKEN" | "APPOINTMENT_REQUESTED";
      speak: string;
      voice_v2_status: "CALLER_REQUEST_ACCEPTED";
    }
  | {
      status: "NOT_READY";
      missing_for_record: string[];
      voice_v2_status: "CALLER_REQUEST_NOT_READY";
      speak: string;
    }
  | { status: "SESSION_UNAVAILABLE"; voice_v2_status: "SESSION_UNAVAILABLE"; speak: string }
  | { status: "ALREADY_FINALIZED"; voice_v2_status: "CALLER_REQUEST_ALREADY_FINALIZED"; speak: string };

function schedulingSummary(ctx: VoiceV2CallContext): string {
  const wf = ctx.bookingWorkflow;
  const date = wf?.requestedDate;
  if (date) return date;
  return "";
}

function intakeSnapshot(ctx: VoiceV2CallContext): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, field] of Object.entries(ctx.intakeState)) {
    const v = field?.value?.trim();
    if (v) out[key] = v;
  }
  return out;
}

async function resolveStrategy(
  ctx: VoiceV2CallContext,
  workspaceId: string,
  agentId: string,
): Promise<VoiceV2BookingStrategy> {
  if (ctx.capabilities?.bookingStrategy) return ctx.capabilities.bookingStrategy;
  const runtime = await loadVoiceAgentRuntimeConfig(workspaceId, agentId);
  return resolveVoiceV2BookingStrategy(parseVoiceAgentConfig(runtime));
}

export async function executeVoiceV2FinalizeCallerRequest(input: {
  workspaceId: string;
  agentId: string;
  callControlId?: string | null;
  conversationId?: string | null;
  voiceCallId?: string | null;
  summary?: string;
}): Promise<FinalizeCallerRequestResult> {
  const sessionKey = resolveSessionKey({
    callControlId: input.callControlId,
    conversationId: input.conversationId,
  });
  const ctx =
    (sessionKey ? getVoiceV2CallContext(sessionKey) : null) ||
    (await ensureVoiceV2CallContext({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      callControlId: input.callControlId,
      conversationId: input.conversationId,
    }));

  if (!ctx) {
    return {
      status: "SESSION_UNAVAILABLE",
      voice_v2_status: "SESSION_UNAVAILABLE",
      speak: "I could not save that right now. Please try again in a moment.",
    };
  }

  if (ctx.bookingWorkflow?.callerRequestFinalized) {
    return {
      status: "ALREADY_FINALIZED",
      voice_v2_status: "CALLER_REQUEST_ALREADY_FINALIZED",
      speak: "I already sent your request to the team. Is there anything else I can help with?",
    };
  }

  const strategy = await resolveStrategy(ctx, input.workspaceId, input.agentId);
  const readiness = getIntakeReadiness(ctx.intakeSchema, ctx.intakeState);
  if (readiness.missingForRecord.length > 0) {
    return {
      status: "NOT_READY",
      missing_for_record: readiness.missingForRecord,
      voice_v2_status: "CALLER_REQUEST_NOT_READY",
      speak: "I still need a bit more information before I can send this to the team.",
    };
  }
  if (strategy === "REQUEST_ONLY" && !ctx.bookingWorkflow?.requestedDate) {
    return {
      status: "NOT_READY",
      missing_for_record: ["scheduling_preference"],
      voice_v2_status: "CALLER_REQUEST_NOT_READY",
      speak: "What day or time works best for the appointment?",
    };
  }

  const outcome = structuredOutcomeForStrategy(strategy);
  const fields = intakeSnapshot(ctx);
  const callerName = fields.name || fields.full_name || "";
  const callerPhone = fields.phone || "";
  const serviceReason = fields.service_reason || "";
  const pref = schedulingSummary(ctx);

  const nextCtx = transitionAfterCallerRequestFinalized(ctx);
  setVoiceV2CallContext(nextCtx);

  const voiceCallId = input.voiceCallId?.trim() || null;
  if (voiceCallId) {
    const prisma = getPrisma();
    const existing = await prisma.voiceCall.findFirst({
      where: { id: voiceCallId, workspaceId: input.workspaceId },
      select: { metadata: true },
    });
    const prevMeta = (existing?.metadata || {}) as Record<string, unknown>;
    const voiceOutcome =
      outcome === "APPOINTMENT_REQUESTED" ? "appointment_requested" : "message_taken";
    await prisma.voiceCall
      .update({
        where: { id: voiceCallId },
        data: {
          outcome: voiceOutcome,
          metadata: {
            ...prevMeta,
            voiceV2StructuredOutcome: outcome,
            voiceV2Request: {
              fields,
              schedulingPreference: pref || null,
              summary: input.summary?.trim() || null,
              bookingStrategy: strategy,
              acceptedAt: new Date().toISOString(),
            },
          },
        },
      })
      .catch(() => undefined);
  }

  const runtime = await loadVoiceAgentRuntimeConfig(input.workspaceId, input.agentId);
  const config = parseVoiceAgentConfig(runtime);
  const advanced = (config.advanced || {}) as Record<string, unknown>;
  const receptionistAdvanced = advanced.receptionistAdvanced as {
    notifications?: { messageEmail?: string; messageSms?: string };
  } | undefined;
  const notifications = receptionistAdvanced?.notifications;

  void deliverVoiceV2BusinessRequestNotifications({
    workspaceId: input.workspaceId,
    callId: voiceCallId,
    outcome,
    callerName,
    callerPhone,
    serviceReason,
    schedulingSummary: pref,
    customFields: fields,
    summary: input.summary,
    messageEmail: notifications?.messageEmail,
    messageSms: notifications?.messageSms,
  });

  const speak =
    outcome === "APPOINTMENT_REQUESTED"
      ? "Got it. I'll send the team your appointment request so they can confirm the time with you."
      : "Thanks — I'll make sure the team gets your message and follows up.";

  return {
    status: "CALLER_REQUEST_ACCEPTED",
    outcome,
    speak,
    voice_v2_status: "CALLER_REQUEST_ACCEPTED",
  };
}
