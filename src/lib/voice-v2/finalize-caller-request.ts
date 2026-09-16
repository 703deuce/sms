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
import {
  applyCallerAniToIntakeState,
  resolveCallerAniForSession,
} from "./intake/caller-phone";
import { ensureVoiceV2CallContext, resolveSessionKey } from "./intake/load-call-context";
import { getIntakeReadiness } from "./intake/readiness";
import { getVoiceV2CallContext, setVoiceV2CallContext } from "./intake/session-store";
import type { VoiceV2CallContext } from "./intake/types";
import {
  primaryOutcomeSucceeded,
  resolveVoiceV2PrimaryOutcome,
  type VoiceV2PrimaryOutcome,
} from "./primary-outcome";

export type FinalizeCallerRequestResult =
  | {
      status: "CALLER_REQUEST_ACCEPTED";
      outcome: "MESSAGE_TAKEN" | "APPOINTMENT_REQUESTED";
      record_complete: boolean;
      missing_for_record: string[];
      speak: string;
      voice_v2_status: "CALLER_REQUEST_ACCEPTED";
    }
  | {
      status: "FINALIZED";
      primary_outcome: VoiceV2PrimaryOutcome;
      record_complete: boolean;
      missing_for_record: string[];
      missing_required_action_fields: string[];
      speak: string;
      voice_v2_status: "CALLER_REQUEST_FINALIZED";
    }
  | {
      status: "NOT_READY";
      missing_for_record: string[];
      missing_required_action_fields?: string[];
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

async function persistFinalizeMetadata(input: {
  voiceCallId: string | null;
  workspaceId: string;
  primaryOutcome: VoiceV2PrimaryOutcome;
  recordComplete: boolean;
  missingForRecord: string[];
  fields: Record<string, string>;
  strategy: VoiceV2BookingStrategy;
  structuredOutcome?: "MESSAGE_TAKEN" | "APPOINTMENT_REQUESTED";
  summary?: string;
  pref: string;
}) {
  if (!input.voiceCallId) return;

  const prisma = getPrisma();
  const existing = await prisma.voiceCall.findFirst({
    where: { id: input.voiceCallId, workspaceId: input.workspaceId },
    select: { metadata: true, outcome: true },
  });
  const prevMeta = (existing?.metadata || {}) as Record<string, unknown>;

  let outcome = existing?.outcome;
  if (input.primaryOutcome === "BOOKED") {
    outcome = "booked";
  } else if (input.primaryOutcome === "RESCHEDULED") {
    outcome = "rescheduled";
  } else if (input.primaryOutcome === "CANCELED") {
    outcome = "canceled";
  } else if (input.primaryOutcome === "TRANSFERRED") {
    outcome = "transferred";
  } else if (input.structuredOutcome === "APPOINTMENT_REQUESTED") {
    outcome = "appointment_requested";
  } else if (input.structuredOutcome === "MESSAGE_TAKEN") {
    outcome = "message_taken";
  }

  await prisma.voiceCall
    .update({
      where: { id: input.voiceCallId },
      data: {
        ...(outcome ? { outcome } : {}),
        metadata: {
          ...prevMeta,
          voiceV2PrimaryOutcome: input.primaryOutcome,
          voiceV2RecordComplete: input.recordComplete,
          voiceV2MissingForRecord: input.missingForRecord,
          ...(input.structuredOutcome
            ? {
                voiceV2StructuredOutcome: input.structuredOutcome,
                voiceV2Request: {
                  fields: input.fields,
                  schedulingPreference: input.pref || null,
                  summary: input.summary?.trim() || null,
                  bookingStrategy: input.strategy,
                  acceptedAt: new Date().toISOString(),
                },
              }
            : {}),
        },
      },
    })
    .catch(() => undefined);
}

export async function executeVoiceV2FinalizeCallerRequest(input: {
  workspaceId: string;
  agentId: string;
  callControlId?: string | null;
  conversationId?: string | null;
  voiceCallId?: string | null;
  fromE164?: string | null;
  summary?: string;
}): Promise<FinalizeCallerRequestResult> {
  const sessionKey = resolveSessionKey({
    callControlId: input.callControlId,
    conversationId: input.conversationId,
  });

  const ani = await resolveCallerAniForSession({
    workspaceId: input.workspaceId,
    fromE164: input.fromE164,
    trustedPrismaCallId: input.voiceCallId,
  });

  let ctx =
    (sessionKey ? getVoiceV2CallContext(sessionKey) : null) ||
    (await ensureVoiceV2CallContext({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      callControlId: input.callControlId,
      conversationId: input.conversationId,
      fromE164: ani,
      trustedPrismaCallId: input.voiceCallId,
    }));

  if (!ctx) {
    return {
      status: "SESSION_UNAVAILABLE",
      voice_v2_status: "SESSION_UNAVAILABLE",
      speak: "I could not save that right now. Please try again in a moment.",
    };
  }

  ctx = applyCallerAniToIntakeState(ctx, ani);
  setVoiceV2CallContext(ctx);

  if (ctx.bookingWorkflow?.callerRequestFinalized) {
    return {
      status: "ALREADY_FINALIZED",
      voice_v2_status: "CALLER_REQUEST_ALREADY_FINALIZED",
      speak: "I already sent your request to the team. Is there anything else I can help with?",
    };
  }

  const strategy = await resolveStrategy(ctx, input.workspaceId, input.agentId);
  const readiness = getIntakeReadiness(ctx.intakeSchema, ctx.intakeState);
  const primaryOutcome = resolveVoiceV2PrimaryOutcome(ctx);
  const recordComplete = readiness.missingForRecord.length === 0;

  // Primary provider action already succeeded — finalize with incomplete record if needed.
  if (primaryOutcomeSucceeded(primaryOutcome)) {
    const nextCtx = transitionAfterCallerRequestFinalized(ctx);
    setVoiceV2CallContext(nextCtx);

    const fields = intakeSnapshot(ctx);
    await persistFinalizeMetadata({
      voiceCallId: input.voiceCallId,
      workspaceId: input.workspaceId,
      primaryOutcome,
      recordComplete,
      missingForRecord: readiness.missingForRecord,
      fields,
      strategy,
      summary: input.summary,
      pref: schedulingSummary(ctx),
    });

    const speak =
      primaryOutcome === "BOOKED"
        ? recordComplete
          ? "Thanks for calling. You're all set — we look forward to seeing you."
          : "Thanks for calling. Your appointment is confirmed. Have a great day."
        : primaryOutcome === "BOOKING_LINK_SENT"
          ? "Thanks for calling. I'll text you that link shortly. Goodbye."
          : primaryOutcome === "TRANSFERRED"
            ? "Thanks for calling. Goodbye."
            : primaryOutcome === "RESCHEDULED"
              ? "Thanks for calling. Your appointment has been updated. Goodbye."
              : primaryOutcome === "CANCELED"
                ? "Thanks for calling. Your appointment has been canceled. Goodbye."
                : primaryOutcome === "CALLBACK_REQUESTED"
                  ? "Thanks for calling. We'll call you back soon. Goodbye."
                  : "Thanks for calling. Take care.";

    return {
      status: "FINALIZED",
      primary_outcome: primaryOutcome,
      record_complete: recordComplete,
      missing_for_record: readiness.missingForRecord,
      missing_required_action_fields: [],
      speak,
      voice_v2_status: "CALLER_REQUEST_FINALIZED",
    };
  }

  // No successful primary action yet — hard blockers only (not record-only fields).
  if (strategy === "REQUEST_ONLY" && !ctx.bookingWorkflow?.requestedDate) {
    return {
      status: "NOT_READY",
      missing_for_record: ["scheduling_preference"],
      missing_required_action_fields: ["scheduling_preference"],
      voice_v2_status: "CALLER_REQUEST_NOT_READY",
      speak: "What day or time works best for the appointment?",
    };
  }

  if (strategy === "REQUEST_ONLY" || strategy === "NONE") {
    if (readiness.missingBeforeBooking.length > 0) {
      return {
        status: "NOT_READY",
        missing_for_record: readiness.missingBeforeBooking,
        missing_required_action_fields: readiness.missingBeforeBooking,
        voice_v2_status: "CALLER_REQUEST_NOT_READY",
        speak: "I still need a bit more information before I can send this to the team.",
      };
    }
  }

  const outcome = structuredOutcomeForStrategy(strategy);
  const fields = intakeSnapshot(ctx);
  const callerName = fields.name || fields.full_name || "";
  const callerPhone = fields.phone || "";
  const serviceReason = fields.service_reason || "";
  const pref = schedulingSummary(ctx);

  const nextCtx = transitionAfterCallerRequestFinalized(ctx);
  setVoiceV2CallContext(nextCtx);

  await persistFinalizeMetadata({
    voiceCallId: input.voiceCallId,
    workspaceId: input.workspaceId,
    primaryOutcome: outcome === "APPOINTMENT_REQUESTED" ? "APPOINTMENT_REQUESTED" : "MESSAGE_TAKEN",
    recordComplete: true,
    missingForRecord: [],
    fields,
    strategy,
    structuredOutcome: outcome,
    summary: input.summary,
    pref,
  });

  const runtime = await loadVoiceAgentRuntimeConfig(input.workspaceId, input.agentId);
  const config = parseVoiceAgentConfig(runtime);
  const advanced = (config.advanced || {}) as Record<string, unknown>;
  const receptionistAdvanced = advanced.receptionistAdvanced as {
    notifications?: { messageEmail?: string; messageSms?: string };
  } | undefined;
  const notifications = receptionistAdvanced?.notifications;

  void deliverVoiceV2BusinessRequestNotifications({
    workspaceId: input.workspaceId,
    callId: input.voiceCallId,
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
    record_complete: true,
    missing_for_record: [],
    speak,
    voice_v2_status: "CALLER_REQUEST_ACCEPTED",
  };
}
