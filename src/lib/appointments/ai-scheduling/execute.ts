import "server-only";

import {
  cancelPlatformAppointment,
  createPlatformAppointment,
  reschedulePlatformAppointment,
  updatePlatformAppointmentStatus,
} from "@/lib/appointments/booking-platform";
import { joinWaitlist } from "@/lib/appointments/waitlist";
import type { AppointmentAiContext } from "./context";
import {
  buildAppointmentAiMutationIdempotencyKey,
  claimAppointmentAiMutation,
  completeAppointmentAiMutation,
  failAppointmentAiMutation,
  inProgressResolverOutcome,
} from "./mutation-idempotency";
import type { ProposedWriteAction, ResolverOutcome } from "./schema";

const MUTATION_KINDS_REQUIRING_DURABLE_IDEMPOTENCY = new Set<ProposedWriteAction["kind"]>([
  "BOOK",
  "RESCHEDULE",
  "CANCEL",
  "CONFIRM",
  "JOIN_WAITLIST",
]);

function requiresDurableIdempotency(action: ProposedWriteAction): boolean {
  return MUTATION_KINDS_REQUIRING_DURABLE_IDEMPOTENCY.has(action.kind);
}

async function runMutationBody(
  ctx: AppointmentAiContext,
  action: ProposedWriteAction,
): Promise<ResolverOutcome> {
  if (ctx.channel === "public_booking") {
    return {
      status: "CLARIFICATION_REQUIRED",
      reason: "Please complete booking using the form to confirm your appointment.",
      requiresVerifier: false,
      mutationExecuted: false,
    };
  }

  if (!ctx.customerId) {
    return {
      status: "CLARIFICATION_REQUIRED",
      reason: "I need to identify your contact record before making that change.",
      requiresVerifier: false,
      mutationExecuted: false,
    };
  }

  switch (action.kind) {
    case "BOOK": {
      const prisma = (await import("@/lib/db")).getPrisma();
      const contact = await prisma.contact.findFirst({
        where: { id: ctx.customerId, workspaceId: ctx.workspaceId },
        select: { phone: true, firstName: true, lastName: true, email: true },
      });
      if (!contact?.phone) {
        return {
          status: "CLARIFICATION_REQUIRED",
          reason: "I need a phone number on file to complete the booking.",
          requiresVerifier: false,
          mutationExecuted: false,
        };
      }

      const result = await createPlatformAppointment(ctx.workspaceId, {
        serviceName: action.serviceName,
        serviceId: action.appointmentTypeId,
        startsAt: action.startsAt,
        phone: contact.phone,
        firstName: contact.firstName || undefined,
        lastName: contact.lastName || undefined,
        email: contact.email || undefined,
        source: "public_booking",
      });

      const appointmentId = String(
        (result as { appointmentId?: string; id?: string }).appointmentId ||
          (result as { id?: string }).id ||
          "",
      );

      const matchedType = ctx.appointmentTypes.find((t) => t.name === action.serviceName);
      const typeRow = matchedType
        ? await prisma.voiceService.findFirst({
            where: { id: matchedType.id, workspaceId: ctx.workspaceId },
          })
        : null;
      const payment = (typeRow?.config as { payment?: { mode?: string } } | null)?.payment;
      const requiresPayment = payment?.mode === "deposit" || payment?.mode === "full";

      if (requiresPayment) {
        return {
          status: "PAYMENT_REQUIRED",
          reason: "Your time is held pending secure payment.",
          appointment: {
            id: appointmentId,
            serviceName: action.serviceName,
            startsAt: action.startsAt,
            status: "pending_payment",
          },
          paymentMode: payment?.mode === "deposit" ? "deposit" : "full",
          requiresVerifier: false,
          mutationExecuted: true,
        };
      }

      return {
        status: "BOOKING_CONFIRMED",
        appointment: {
          id: appointmentId,
          serviceName: action.serviceName,
          startsAt: action.startsAt,
          status: "scheduled",
        },
        requiresVerifier: false,
        mutationExecuted: true,
      };
    }
    case "RESCHEDULE": {
      const prisma = (await import("@/lib/db")).getPrisma();
      const row = await prisma.voiceAppointment.findFirst({
        where: { id: action.appointmentId, workspaceId: ctx.workspaceId },
      });
      const { providerRefFromAppointment } = await import(
        "@/lib/appointment-reminders/ai-rescheduler/provider-mutations"
      );
      const { commitArReschedule } = await import(
        "@/lib/appointment-reminders/ai-rescheduler/commit-reschedule"
      );
      const { isAiAutomaticCalendarMutation, resolveAiReschedulerConfig } = await import(
        "@/lib/appointment-reminders/ai-rescheduler/types"
      );
      const { queueArRescheduleBusinessApproval } = await import(
        "@/lib/appointment-reminders/ai-rescheduler/business-approval"
      );
      const { isAiBusinessApprovalMode } = await import(
        "@/lib/appointment-reminders/ai-rescheduler/types"
      );
      const ar = resolveAiReschedulerConfig(ctx.platform);
      const providerRef = row ? providerRefFromAppointment(row) : null;
      const durationMs =
        row?.endsAt && row?.startsAt
          ? row.endsAt.getTime() - row.startsAt.getTime()
          : 30 * 60_000;
      const endsAtIso = new Date(new Date(action.startsAt).getTime() + durationMs).toISOString();

      if (providerRef && isAiBusinessApprovalMode(ar)) {
        const operationId = `${ctx.requestId}:reschedule:${action.appointmentId}`;
        await queueArRescheduleBusinessApproval({
          workspaceId: ctx.workspaceId,
          appointmentId: action.appointmentId,
          contactId: ctx.customerId,
          proposedStartsAt: action.startsAt,
          proposedEndsAt: endsAtIso,
          operationId,
        });
        return {
          status: "RESCHEDULED",
          appointment: {
            id: action.appointmentId,
            serviceName: row?.serviceName || "Appointment",
            startsAt: action.startsAt,
            status: "reschedule_requested",
          },
          requiresVerifier: false,
          mutationExecuted: true,
        };
      }

      if (isAiAutomaticCalendarMutation(ar)) {
        const operationId = `${ctx.requestId}:reschedule:${action.appointmentId}`;
        const committed = await commitArReschedule({
          workspaceId: ctx.workspaceId,
          appointmentId: action.appointmentId,
          startsAt: action.startsAt,
          initiatedBy: "customer",
          operationId,
        });
        if (!committed.ok) {
          return {
            status: "CLARIFICATION_REQUIRED",
            reason: committed.message,
            requiresVerifier: false,
            mutationExecuted: false,
          };
        }
        const updated = await prisma.voiceAppointment.findFirst({
          where: { id: action.appointmentId, workspaceId: ctx.workspaceId },
        });
        return {
          status: "RESCHEDULED",
          appointment: {
            id: action.appointmentId,
            serviceName: updated?.serviceName || "Appointment",
            startsAt: updated?.startsAt.toISOString() || action.startsAt,
            status: updated?.status || "scheduled",
          },
          requiresVerifier: false,
          mutationExecuted: true,
        };
      }

      const appt = await reschedulePlatformAppointment(
        ctx.workspaceId,
        action.appointmentId,
        action.startsAt,
        "customer",
      );
      return {
        status: "RESCHEDULED",
        appointment: {
          id: appt.id,
          serviceName: appt.serviceName || "Appointment",
          startsAt: appt.startsAt.toISOString(),
          status: appt.status,
        },
        requiresVerifier: false,
        mutationExecuted: true,
      };
    }
    case "CANCEL": {
      const { resolveAiReschedulerConfig } = await import(
        "@/lib/appointment-reminders/ai-rescheduler/types"
      );
      const { cancelProviderEvent } = await import(
        "@/lib/appointment-reminders/ai-rescheduler/provider-mutations"
      );
      const ar = resolveAiReschedulerConfig(ctx.platform);
      if (ar.mode === "ai" && ar.allowProviderCancel) {
        const provider = await cancelProviderEvent({
          workspaceId: ctx.workspaceId,
          appointmentId: action.appointmentId,
          reason: "Customer confirmed cancellation via SMS AI",
        });
        if (!provider.ok) {
          return {
            status: "CLARIFICATION_REQUIRED",
            reason: provider.message,
            requiresVerifier: false,
            mutationExecuted: false,
          };
        }
      }
      await cancelPlatformAppointment(ctx.workspaceId, action.appointmentId, "customer");
      return {
        status: "CANCELED",
        appointment: {
          id: action.appointmentId,
          serviceName: "",
          startsAt: "",
          status: "canceled",
        },
        requiresVerifier: false,
        mutationExecuted: true,
      };
    }
    case "CONFIRM": {
      await updatePlatformAppointmentStatus(ctx.workspaceId, action.appointmentId, "confirmed", {
        type: "confirmed_via_ai",
        label: "Customer confirmed via appointment AI",
      });
      return {
        status: "CONFIRMED",
        requiresVerifier: false,
        mutationExecuted: true,
      };
    }
    case "JOIN_WAITLIST": {
      const prisma = (await import("@/lib/db")).getPrisma();
      const contact = await prisma.contact.findFirst({
        where: { id: ctx.customerId, workspaceId: ctx.workspaceId },
        select: { phone: true, email: true },
      });
      await joinWaitlist({
        workspaceId: ctx.workspaceId,
        contactId: ctx.customerId,
        appointmentTypeId: action.appointmentTypeId,
        serviceName: action.serviceName,
        phone: contact?.phone || undefined,
        email: contact?.email || undefined,
      });
      return {
        status: "WAITLIST_JOINED",
        serviceName: action.serviceName,
        requiresVerifier: false,
        mutationExecuted: true,
      };
    }
    default:
      return {
        status: "ERROR",
        requiresVerifier: false,
        mutationExecuted: false,
      };
  }
}

export async function executeAppointmentMutation(
  ctx: AppointmentAiContext,
  action: ProposedWriteAction,
  requestId: string,
): Promise<ResolverOutcome> {
  if (!requiresDurableIdempotency(action)) {
    try {
      return await runMutationBody(ctx, action);
    } catch (err) {
      return {
        status: "ERROR",
        reason: err instanceof Error ? err.message : "Action failed",
        requiresVerifier: false,
        mutationExecuted: false,
      };
    }
  }

  if (!requestId?.trim()) {
    return {
      status: "ERROR",
      reason: "A stable request identifier is required before executing this action.",
      requiresVerifier: false,
      mutationExecuted: false,
    };
  }

  const idempotencyKey = buildAppointmentAiMutationIdempotencyKey({
    workspaceId: ctx.workspaceId,
    requestId,
    action,
  });

  const claim = await claimAppointmentAiMutation({
    workspaceId: ctx.workspaceId,
    idempotencyKey,
    requestId,
    contactId: ctx.customerId,
    channel: ctx.channel,
    action,
  });

  if (claim.kind === "duplicate") {
    return claim.outcome;
  }
  if (claim.kind === "in_progress") {
    return inProgressResolverOutcome();
  }

  try {
    const outcome = await runMutationBody(ctx, action);
    if (outcome.mutationExecuted) {
      await completeAppointmentAiMutation(claim.recordId, outcome);
      return outcome;
    }
    await failAppointmentAiMutation(
      claim.recordId,
      outcome.reason || "Mutation did not execute",
      outcome,
    );
    return outcome;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Action failed";
    await failAppointmentAiMutation(claim.recordId, message, {
      status: "ERROR",
      reason: message,
      requiresVerifier: false,
      mutationExecuted: false,
    });
    return {
      status: "ERROR",
      reason: message,
      requiresVerifier: false,
      mutationExecuted: false,
    };
  }
}

export async function applyVerifiedWrite(
  ctx: AppointmentAiContext,
  preliminary: ResolverOutcome,
  requestId: string,
): Promise<ResolverOutcome> {
  if (!preliminary.proposedWrite) return preliminary;
  const executed = await executeAppointmentMutation(ctx, preliminary.proposedWrite, requestId);
  return executed;
}
