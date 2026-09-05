import "server-only";

import {
  evaluateCancellationPolicy,
  evaluateReschedulePolicy,
} from "@/lib/appointments/scheduling-policy";
import {
  checkGroupCapacity,
  loadSchedulingContext,
  resolveEligibleStaff,
} from "@/lib/appointments/scheduling-domain";
import { resolveSlotFromConversation } from "./conversation-state";
import type { AppointmentAiContext } from "./context";
import { queryAvailabilityForIntent } from "./availability-bridge";
import type { SchedulingIntent } from "./intent-schema";
import {
  buildIsoFromDateAndTime,
  isPastDate,
  parseExactTime,
  resolveRelativeDatePhrase,
} from "./date-utils";
import type { ProposedWriteAction, ResolverOutcome, UnderstandingResult } from "./schema";

function understandingToLegacyIntent(u: UnderstandingResult): SchedulingIntent {
  const legacyIntent =
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
    intent: legacyIntent,
    appointmentTypeId: u.servicePreference.appointmentTypeId || undefined,
    appointmentTypeName: u.servicePreference.nameMentioned || undefined,
    requestedDate: u.datePreference.date || undefined,
    requestedDateStart: u.datePreference.dateRange?.start,
    requestedDateEnd: u.datePreference.dateRange?.end,
    preferredTime: u.timePreference.exactTime || undefined,
    preferredTimeStart: u.timePreference.range?.start,
    preferredTimeEnd: u.timePreference.range?.end,
    timeOfDay: u.timePreference.period || undefined,
    staffPreference: u.staffPreference.nameMentioned || undefined,
    locationPreference: u.locationPreference.nameMentioned || undefined,
    groupSeats: u.groupSize || undefined,
    recurring: u.recurrence || undefined,
    originalText: u.originalText,
    confidence: u.confidence,
    missingFields: u.requiresClarification ? ["clarification"] : undefined,
    followUpQuestion: u.clarificationReason || undefined,
  };
}

function resolveServiceName(ctx: AppointmentAiContext, u: UnderstandingResult): string | null {
  if (u.servicePreference.appointmentTypeId) {
    const match = ctx.appointmentTypes.find((t) => t.id === u.servicePreference.appointmentTypeId);
    if (match) return match.name;
  }
  if (u.servicePreference.nameMentioned) {
    const match = ctx.appointmentTypes.find(
      (t) => t.name.toLowerCase() === u.servicePreference.nameMentioned!.toLowerCase(),
    );
    if (match) return match.name;
  }
  if (ctx.appointmentTypes.length === 1) return ctx.appointmentTypes[0].name;
  return null;
}

function resolveTargetAppointment(
  ctx: AppointmentAiContext,
  u: UnderstandingResult,
): { id: string; serviceName: string; startsAt: string; status: string } | null {
  if (u.appointmentReference.appointmentId) {
    const match = ctx.customerAppointments.find((a) => a.id === u.appointmentReference.appointmentId);
    if (match) return match;
  }
  if (ctx.customerAppointments.length === 1) return ctx.customerAppointments[0];
  return null;
}

function resolveRequestedDate(ctx: AppointmentAiContext, u: UnderstandingResult): string | undefined {
  if (u.datePreference.date) return u.datePreference.date;
  const phrase = u.datePreference.relative || u.datePreference.raw || u.originalText;
  return resolveRelativeDatePhrase(phrase, new Date(ctx.currentTimestamp), ctx.businessTimezone);
}

function resolveSlotSelection(
  ctx: AppointmentAiContext,
  u: UnderstandingResult,
): { startsAt: string; endsAt: string } | null {
  const fromState = resolveSlotFromConversation(u.originalText, ctx.conversationState);
  if (fromState) return fromState;

  const dateKey = resolveRequestedDate(ctx, u);
  const time = u.timePreference.exactTime || parseExactTime(u.originalText);
  if (!dateKey || !time) return null;
  const iso = buildIsoFromDateAndTime(dateKey, time, ctx.businessTimezone);
  if (!iso) return null;
  const end = new Date(new Date(iso).getTime() + 30 * 60_000).toISOString();
  return { startsAt: iso, endsAt: end };
}

export async function resolveAppointmentIntent(
  ctx: AppointmentAiContext,
  understanding: UnderstandingResult,
): Promise<ResolverOutcome> {
  if (!ctx.bookingEnabled && understanding.intent !== "OUT_OF_SCOPE") {
    return {
      status: "ERROR",
      reason: "Online booking is not available right now.",
      requiresVerifier: false,
      mutationExecuted: false,
    };
  }

  if (understanding.intent === "OUT_OF_SCOPE") {
    return { status: "OUT_OF_SCOPE", requiresVerifier: false, mutationExecuted: false };
  }

  if (understanding.requiresClarification || understanding.intent === "CLARIFY") {
    return {
      status: "CLARIFICATION_REQUIRED",
      reason:
        understanding.clarificationReason ||
        "Could you tell me a bit more about what you'd like to do with your appointment?",
      appointments:
        ctx.customerAppointments.length > 1 ? ctx.customerAppointments : undefined,
      requiresVerifier: false,
      mutationExecuted: false,
    };
  }

  const serviceName = resolveServiceName(ctx, understanding);
  const targetAppt = resolveTargetAppointment(ctx, understanding);
  const requestedDate = resolveRequestedDate(ctx, understanding);

  if (requestedDate && isPastDate(requestedDate, new Date(ctx.currentTimestamp), ctx.businessTimezone)) {
    return {
      status: "CLARIFICATION_REQUIRED",
      reason: "That date has already passed. What future day works for you?",
      requiresVerifier: false,
      mutationExecuted: false,
    };
  }

  if (understanding.intent === "APPOINTMENT_DETAILS") {
    if (!targetAppt && ctx.customerAppointments.length > 1) {
      return {
        status: "CLARIFICATION_REQUIRED",
        reason: "You have multiple upcoming appointments. Which one would you like details for?",
        appointments: ctx.customerAppointments,
        requiresVerifier: false,
        mutationExecuted: false,
      };
    }
    if (targetAppt) {
      return {
        status: "APPOINTMENT_DETAILS",
        appointment: targetAppt,
        requiresVerifier: false,
        mutationExecuted: false,
      };
    }
    return {
      status: "CLARIFICATION_REQUIRED",
      reason: "I couldn't find an upcoming appointment on file.",
      requiresVerifier: false,
      mutationExecuted: false,
    };
  }

  if (understanding.intent === "ANSWER_BOOKING_QUESTION") {
    return {
      status: "POLICY_ANSWER",
      reason: "Please visit our booking page or contact us for policy details.",
      requiresVerifier: false,
      mutationExecuted: false,
    };
  }

  if (understanding.intent === "CONFIRM") {
    if (!targetAppt) {
      return {
        status: "CLARIFICATION_REQUIRED",
        reason: "Which appointment would you like to confirm?",
        appointments: ctx.customerAppointments,
        requiresVerifier: false,
        mutationExecuted: false,
      };
    }
    return {
      status: "NO_OP",
      proposedWrite: { kind: "CONFIRM", appointmentId: targetAppt.id },
      requiresVerifier: false,
      mutationExecuted: false,
    };
  }

  if (understanding.intent === "CANCEL") {
    if (!targetAppt && ctx.customerAppointments.length > 1) {
      return {
        status: "CLARIFICATION_REQUIRED",
        reason: "You have multiple upcoming appointments. Which one should I cancel?",
        appointments: ctx.customerAppointments,
        requiresVerifier: false,
        mutationExecuted: false,
      };
    }
    if (!targetAppt) {
      return {
        status: "CLARIFICATION_REQUIRED",
        reason: "I couldn't find an upcoming appointment to cancel.",
        requiresVerifier: false,
        mutationExecuted: false,
      };
    }
    if (!understanding.explicitMutationRequested) {
      return {
        status: "CLARIFICATION_REQUIRED",
        reason: "Just to confirm — would you like me to cancel that appointment?",
        appointment: targetAppt,
        requiresVerifier: false,
        mutationExecuted: false,
      };
    }
    const policy = evaluateCancellationPolicy(
      undefined,
      new Date(targetAppt.startsAt),
    );
    if (!policy.allowed) {
      return {
        status: "CLARIFICATION_REQUIRED",
        reason: policy.reason,
        requiresVerifier: false,
        mutationExecuted: false,
      };
    }
    return {
      status: "NO_OP",
      proposedWrite: { kind: "CANCEL", appointmentId: targetAppt.id },
      appointment: targetAppt,
      requiresVerifier: true,
      mutationExecuted: false,
    };
  }

  if (understanding.intent === "RESCHEDULE") {
    const slot = resolveSlotSelection(ctx, understanding);
    if (!targetAppt && ctx.customerAppointments.length > 1) {
      return {
        status: "CLARIFICATION_REQUIRED",
        reason: "Which appointment would you like to reschedule?",
        appointments: ctx.customerAppointments,
        requiresVerifier: false,
        mutationExecuted: false,
      };
    }
    if (!targetAppt) {
      return {
        status: "CLARIFICATION_REQUIRED",
        reason: "What day or time would work better for you?",
        requiresVerifier: false,
        mutationExecuted: false,
      };
    }
    if (!slot || !understanding.explicitMutationRequested) {
      const legacy = understandingToLegacyIntent(understanding);
      const availability = await queryAvailabilityForIntent(
        ctx.workspaceId,
        legacy,
        targetAppt.serviceName,
      );
      return {
        status: "AVAILABLE_OPTIONS",
        reason: "Here are some alternative times:",
        slots: availability.slots,
        serviceName: targetAppt.serviceName,
        appointment: targetAppt,
        requiresVerifier: false,
        mutationExecuted: false,
      };
    }
    const policy = evaluateReschedulePolicy(
      undefined,
      new Date(targetAppt.startsAt),
    );
    if (!policy.allowed) {
      return {
        status: "CLARIFICATION_REQUIRED",
        reason: policy.reason,
        requiresVerifier: false,
        mutationExecuted: false,
      };
    }
    return {
      status: "NO_OP",
      proposedWrite: {
        kind: "RESCHEDULE",
        appointmentId: targetAppt.id,
        startsAt: slot.startsAt,
      },
      appointment: targetAppt,
      slots: [slot],
      requiresVerifier: true,
      mutationExecuted: false,
    };
  }

  if (understanding.intent === "JOIN_WAITLIST") {
    if (!ctx.waitlistEnabled) {
      return {
        status: "CLARIFICATION_REQUIRED",
        reason: "Waitlist isn't available right now. Would you like to check other times?",
        requiresVerifier: false,
        mutationExecuted: false,
      };
    }
    if (!serviceName) {
      return {
        status: "CLARIFICATION_REQUIRED",
        reason: "What type of appointment would you like to waitlist for?",
        requiresVerifier: false,
        mutationExecuted: false,
      };
    }
    if (!understanding.explicitMutationRequested) {
      return {
        status: "CLARIFICATION_REQUIRED",
        reason: `Would you like me to add you to the waitlist for ${serviceName}?`,
        serviceName,
        requiresVerifier: false,
        mutationExecuted: false,
      };
    }
    const type = ctx.appointmentTypes.find((t) => t.name === serviceName);
    return {
      status: "NO_OP",
      proposedWrite: {
        kind: "JOIN_WAITLIST",
        serviceName,
        appointmentTypeId: type?.id,
      },
      serviceName,
      requiresVerifier: true,
      mutationExecuted: false,
    };
  }

  if (understanding.intent === "BOOK" || understanding.intent === "FIND_AVAILABILITY") {
    if (!serviceName) {
      return {
        status: "CLARIFICATION_REQUIRED",
        reason: "What type of appointment would you like?",
        requiresVerifier: false,
        mutationExecuted: false,
      };
    }

    const schedulingCtx = await loadSchedulingContext(ctx.workspaceId, serviceName);
    if (understanding.staffPreference.nameMentioned) {
      const eligible = resolveEligibleStaff(schedulingCtx, understanding.staffPreference.nameMentioned);
      if (!eligible.length) {
        return {
          status: "CLARIFICATION_REQUIRED",
          reason: `${understanding.staffPreference.nameMentioned} isn't available for ${serviceName}. Would you like another staff member?`,
          requiresVerifier: false,
          mutationExecuted: false,
        };
      }
      const dupes = ctx.staff.filter(
        (s) => s.name.toLowerCase() === understanding.staffPreference.nameMentioned!.toLowerCase(),
      );
      if (dupes.length > 1) {
        return {
          status: "CLARIFICATION_REQUIRED",
          reason: "Multiple staff members match that name. Which one did you mean?",
          requiresVerifier: false,
          mutationExecuted: false,
        };
      }
    }

    const legacy = understandingToLegacyIntent(understanding);
    const availability = await queryAvailabilityForIntent(ctx.workspaceId, legacy, serviceName);

    if (understanding.groupSize && understanding.groupSize > 1) {
      const capacity = schedulingCtx.svcCfg.groupCapacity || 1;
      if (understanding.groupSize > capacity) {
        return {
          status: "CLARIFICATION_REQUIRED",
          reason: `This service supports up to ${capacity} attendees.`,
          requiresVerifier: false,
          mutationExecuted: false,
        };
      }
    }

    const selectedSlot = resolveSlotSelection(ctx, understanding);
    if (understanding.intent === "BOOK" && selectedSlot && understanding.explicitMutationRequested) {
      if (ctx.channel === "public_booking") {
        return {
          status: "AVAILABLE_OPTIONS",
          reason: "Please choose a time below to continue booking:",
          slots: [selectedSlot],
          serviceName,
          requiresVerifier: false,
          mutationExecuted: false,
        };
      }
      if (understanding.groupSize && understanding.groupSize > 1) {
        const cap = await checkGroupCapacity(
          ctx.workspaceId,
          serviceName,
          new Date(selectedSlot.startsAt),
          schedulingCtx.svcCfg.groupCapacity || 1,
        );
        if (!cap.available || cap.remaining < understanding.groupSize) {
          return {
            status: "CLARIFICATION_REQUIRED",
            reason: `Only ${cap.remaining} spot(s) remain at that time.`,
            slots: availability.slots,
            serviceName,
            requiresVerifier: false,
            mutationExecuted: false,
          };
        }
      }
      const type = ctx.appointmentTypes.find((t) => t.name === serviceName);
      return {
        status: "NO_OP",
        proposedWrite: {
          kind: "BOOK",
          serviceName,
          startsAt: selectedSlot.startsAt,
          appointmentTypeId: type?.id,
        },
        slots: [selectedSlot],
        serviceName,
        requiresVerifier: true,
        mutationExecuted: false,
      };
    }

    if (!availability.slots.length && ctx.waitlistEnabled) {
      return {
        status: "CLARIFICATION_REQUIRED",
        reason:
          "No matching times are available. I can add you to the waitlist or show nearby options.",
        slots: availability.slots,
        serviceName,
        requiresVerifier: false,
        mutationExecuted: false,
      };
    }

    return {
      status: "AVAILABLE_OPTIONS",
      reason: availability.message,
      slots: availability.slots,
      serviceName,
      requiresVerifier: false,
      mutationExecuted: false,
    };
  }

  return {
    status: "OUT_OF_SCOPE",
    requiresVerifier: false,
    mutationExecuted: false,
  };
}
