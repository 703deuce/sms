import "server-only";

import { randomBytes } from "crypto";
import { assembleAppointmentAiContext, applyStateHintsToUnderstanding } from "./context";
import { composeAppointmentResponse } from "./compose-response";
import { applyVerifiedWrite } from "./execute";
import { logAppointmentAiEvent } from "./observability";
import { resolveAppointmentIntent } from "./resolver";
import { stateFromUnderstanding } from "./conversation-state";
import {
  emptyUnderstanding,
  type AppointmentAiChannel,
  type AppointmentAiResult,
  type AppointmentAiResultType,
  type ResolverOutcome,
  type UnderstandingResult,
} from "./schema";
import { runUnderstandingAgent } from "./understand";
import { verifyWriteAction, writeActionRequiresVerifier } from "./verify-action";
import type { SchedulingIntent } from "./intent-schema";

const WORKSPACE_RATE_LIMIT = new Map<string, number[]>();

function enforceRateLimit(workspaceId: string, maxPerMinute = 20): boolean {
  const now = Date.now();
  const list = (WORKSPACE_RATE_LIMIT.get(workspaceId) || []).filter((t) => t >= now - 60_000);
  if (list.length >= maxPerMinute) return false;
  list.push(now);
  WORKSPACE_RATE_LIMIT.set(workspaceId, list);
  return true;
}

function createRequestId(requestId?: string): string {
  return requestId || randomBytes(12).toString("hex");
}

function mapResultType(outcome: ResolverOutcome): AppointmentAiResultType {
  switch (outcome.status) {
    case "AVAILABLE_OPTIONS":
      return "AVAILABLE_SLOTS";
    case "CLARIFICATION_REQUIRED":
      return "CLARIFICATION";
    case "BOOKING_CONFIRMED":
      return "BOOKED";
    case "RESCHEDULED":
      return "RESCHEDULED";
    case "CANCELED":
      return "CANCELED";
    case "PAYMENT_REQUIRED":
      return "PAYMENT_REQUIRED";
    case "OUT_OF_SCOPE":
      return "OUT_OF_SCOPE";
    default:
      return "MESSAGE";
  }
}

function legacyIntentFromUnderstanding(u: UnderstandingResult): SchedulingIntent {
  const intent =
    u.intent === "FIND_AVAILABILITY"
      ? "availability_request"
      : u.intent === "BOOK"
        ? "new_booking"
        : u.intent === "RESCHEDULE"
          ? "reschedule"
          : u.intent === "CANCEL"
            ? "cancel"
            : u.intent === "CONFIRM"
              ? "confirm"
              : "availability_request";
  return {
    intent,
    appointmentTypeId: u.servicePreference.appointmentTypeId || undefined,
    appointmentTypeName: u.servicePreference.nameMentioned || undefined,
    requestedDate: u.datePreference.date || undefined,
    preferredTime: u.timePreference.exactTime || undefined,
    timeOfDay: u.timePreference.period || undefined,
    staffPreference: u.staffPreference.nameMentioned || undefined,
    locationPreference: u.locationPreference.nameMentioned || undefined,
    originalText: u.originalText,
    confidence: u.confidence,
    missingFields: u.requiresClarification ? ["clarification"] : undefined,
    followUpQuestion: u.clarificationReason || undefined,
  };
}

export type HandleAppointmentAIRequestInput = {
  workspaceId: string;
  message: string;
  channel: AppointmentAiChannel;
  customerId?: string;
  conversationId?: string;
  customerTimezone?: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  contactCustomFields?: unknown;
  requestId?: string;
  useResponseComposerLlm?: boolean;
};

/**
 * Canonical appointment AI entry point — shared by public booking, SMS, and conversations.
 */
export async function handleAppointmentAIRequest(
  input: HandleAppointmentAIRequestInput,
): Promise<AppointmentAiResult> {
  const started = Date.now();
  const requestId = createRequestId(input.requestId);
  const presentationPhases: AppointmentAiResult["presentationPhases"] = ["understanding"];

  if (!enforceRateLimit(input.workspaceId)) {
    return {
      type: "MESSAGE",
      message:
        "We're receiving a lot of requests right now. Please try again in a moment or choose a time manually.",
      requiresFollowUp: false,
      requiresConfirmation: false,
      requiresBookingDetails: false,
      presentationPhases,
    };
  }

  const ctx = await assembleAppointmentAiContext({
    requestId,
    workspaceId: input.workspaceId,
    channel: input.channel,
    message: input.message,
    customerId: input.customerId,
    conversationId: input.conversationId,
    customerTimezone: input.customerTimezone,
    conversationHistory: input.conversationHistory,
    contactCustomFields: input.contactCustomFields,
  });

  const hinted = applyStateHintsToUnderstanding(emptyUnderstanding(input.message), ctx.conversationState);

  const { understanding, fallbackUsed, modelFailure } = await runUnderstandingAgent(ctx, hinted);
  presentationPhases.push("checking_availability");

  let outcome = await resolveAppointmentIntent(ctx, understanding);
  let verifierVerdict: "MATCH" | "NEEDS_CLARIFICATION" | "MISMATCH" | undefined;

  if (
    outcome.proposedWrite &&
    outcome.requiresVerifier &&
    writeActionRequiresVerifier(outcome.proposedWrite)
  ) {
    presentationPhases.push("verifying");
    const verification = await verifyWriteAction({
      originalMessage: input.message,
      recentTurns: ctx.recentTurns,
      understanding,
      proposedAction: outcome.proposedWrite,
      appointmentSummary: outcome.appointment
        ? `${outcome.appointment.serviceName} at ${outcome.appointment.startsAt}`
        : undefined,
    });
    verifierVerdict = verification.verdict;

    if (verification.verdict === "MATCH") {
      outcome = await applyVerifiedWrite(ctx, outcome, requestId);
    } else if (verification.verdict === "NEEDS_CLARIFICATION") {
      outcome = {
        status: "CLARIFICATION_REQUIRED",
        reason:
          verification.reason ||
          "I want to make sure I have this right — can you confirm what you'd like me to do?",
        requiresVerifier: false,
        mutationExecuted: false,
      };
    } else {
      outcome = {
        status: "CLARIFICATION_REQUIRED",
        reason:
          verification.reason ||
          "I don't think that's what you asked for. Could you clarify?",
        requiresVerifier: false,
        mutationExecuted: false,
      };
    }
  } else if (outcome.proposedWrite?.kind === "CONFIRM") {
    outcome = await applyVerifiedWrite(ctx, outcome, requestId);
  }

  const message = await composeAppointmentResponse(outcome, {
    channel: input.channel,
    useLlm: input.useResponseComposerLlm ?? false,
  });

  const legacyIntent = legacyIntentFromUnderstanding(understanding);
  const slots = outcome.slots?.map((s) => ({ startsAt: s.startsAt, endsAt: s.endsAt }));

  logAppointmentAiEvent({
    requestId,
    workspaceId: input.workspaceId,
    channel: input.channel,
    intent: understanding.intent,
    confidence: understanding.confidence,
    clarificationRequired: understanding.requiresClarification,
    verifierVerdict,
    deterministicOutcome: outcome.status,
    durationMs: Date.now() - started,
    modelFailure,
    fallbackUsed,
    mutationExecuted: outcome.mutationExecuted,
  });

  const requiresPayment = outcome.status === "PAYMENT_REQUIRED";

  return {
    type: mapResultType(outcome),
    message,
    data: {
      requestId,
      outcome: outcome.status,
      conversationState: stateFromUnderstanding(understanding, slots),
      appointments: outcome.appointments,
      appointment: outcome.appointment,
      checkoutUrl: outcome.checkoutUrl,
    },
    slots,
    serviceName: outcome.serviceName,
    requiresFollowUp:
      outcome.status === "CLARIFICATION_REQUIRED" || (slots && slots.length > 1) || false,
    requiresConfirmation:
      outcome.status === "AVAILABLE_OPTIONS" && slots?.length === 1 && !requiresPayment,
    requiresBookingDetails:
      understanding.intent === "BOOK" && input.channel === "public_booking",
    requiresPayment,
    paymentMode: outcome.paymentMode,
    understanding,
    presentationPhases,
  };
}

/** @deprecated Use handleAppointmentAIRequest — kept for public booking API compatibility */
export type AiSchedulingResponse = {
  intent: SchedulingIntent;
  slots?: Array<{ startsAt: string; endsAt: string }>;
  message: string;
  serviceName?: string;
  requiresFollowUp: boolean;
  requiresConfirmation: boolean;
  requiresBookingDetails: boolean;
  requiresPayment?: boolean;
  paymentMode?: "deposit" | "full";
};

export async function processAiSchedulingRequest(input: {
  workspaceId: string;
  text: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<AiSchedulingResponse> {
  const result = await handleAppointmentAIRequest({
    workspaceId: input.workspaceId,
    message: input.text,
    channel: "public_booking",
    conversationHistory: input.conversationHistory,
  });

  return {
    intent: legacyIntentFromUnderstanding(
      result.understanding || {
        intent: "CLARIFY",
        confidence: 0,
        requiresClarification: true,
        clarificationReason: null,
        appointmentReference: { appointmentId: null, description: null },
        servicePreference: { appointmentTypeId: null, nameMentioned: null },
        datePreference: { raw: null, relative: null, date: null, dateRange: null },
        timePreference: { raw: null, exactTime: null, period: null, range: null },
        staffPreference: { staffId: null, nameMentioned: null },
        locationPreference: { locationId: null, nameMentioned: null },
        groupSize: null,
        recurrence: null,
        bookingAnswers: {},
        explicitMutationRequested: false,
        notesForResolver: [],
        originalText: input.text,
      },
    ),
    slots: result.slots,
    message: result.message,
    serviceName: result.serviceName,
    requiresFollowUp: result.requiresFollowUp,
    requiresConfirmation: result.requiresConfirmation,
    requiresBookingDetails: result.requiresBookingDetails,
    requiresPayment: result.requiresPayment,
    paymentMode: result.paymentMode,
  };
}
