import type { AppointmentMetadata } from "@/lib/appointments/types";
import { normalizeAppointmentStatus } from "@/lib/appointments/types";
import type { AppointmentWorkflowTrigger, WorkflowCondition, WorkflowConditionGroup } from "./types";

export type AppointmentConditionContext = {
  appointmentId: string;
  workspaceId: string;
  serviceName: string | null;
  serviceId?: string | null;
  status: string;
  startsAt: Date;
  endsAt?: Date | null;
  staffName?: string | null;
  location?: string | null;
  metadata: AppointmentMetadata;
  contactPhone?: string | null;
  contactEmail?: string | null;
  contactId?: string | null;
  paymentStatus?: string | null;
  hasFutureAppointment?: boolean;
  workflowTrigger?: AppointmentWorkflowTrigger;
};

function normalizeInitiatedBy(value: unknown): string {
  return String(value || "").toLowerCase();
}

function evaluateCondition(
  condition: WorkflowCondition,
  ctx: AppointmentConditionContext,
): boolean {
  const status = normalizeAppointmentStatus(ctx.status);
  switch (condition.operator) {
    case "equals":
      return String(condition.value) === ctx.status;
    case "not_equals":
      return String(condition.value) !== ctx.status;
    case "is_confirmed":
      return status === "confirmed";
    case "not_confirmed":
      return status !== "confirmed";
    case "is_canceled":
      return status === "canceled";
    case "not_canceled":
      return status !== "canceled";
    case "is_completed":
      return status === "completed";
    case "not_completed":
      return status !== "completed";
    case "is_no_show":
      return status === "no_show";
    case "not_no_show":
      return status !== "no_show";
    case "has_phone":
      return Boolean(ctx.contactPhone || ctx.metadata.inviteePhone);
    case "has_email":
      return Boolean(ctx.contactEmail || ctx.metadata.inviteeEmail);
    case "has_sms_consent":
      return ctx.metadata.smsConsent !== false;
    case "reminder_sent":
      return (ctx.metadata.reminderSentKeys || []).includes(String(condition.value || ""));
    case "reminder_not_sent":
      return !(ctx.metadata.reminderSentKeys || []).includes(String(condition.value || ""));
    case "is_upcoming":
      return ctx.startsAt.getTime() > Date.now() && status !== "canceled" && status !== "completed";
    case "was_rescheduled": {
      const timeline = ctx.metadata.timeline || [];
      return timeline.some((e) => e.type === "rescheduled");
    }
    case "appointment_type_equals":
      return ctx.serviceName === String(condition.value || "");
    case "appointment_type_not_equals":
      return ctx.serviceName !== String(condition.value || "");
    case "payment_status_equals":
      return (ctx.paymentStatus || "") === String(condition.value || "");
    case "deposit_paid":
      return Boolean(
        ctx.metadata.depositPaidCents &&
          ctx.metadata.depositPaidCents > 0 &&
          (ctx.metadata.balanceDueCents ?? 0) > 0,
      );
    case "balance_due":
      return (ctx.metadata.balanceDueCents ?? 0) > 0;
    case "payment_failed":
      return ctx.paymentStatus === "failed";
    case "customer_has_future_appointment":
      return ctx.hasFutureAppointment === true;
    case "customer_no_future_appointment":
      return ctx.hasFutureAppointment === false;
    case "change_initiated_by_equals":
      return (
        normalizeInitiatedBy(ctx.metadata.lastChangeInitiatedBy || ctx.metadata.initiatedBy) ===
        normalizeInitiatedBy(condition.value)
      );
    case "is_recurring":
      return Boolean(ctx.metadata.recurringSeriesId);
    case "not_recurring":
      return !ctx.metadata.recurringSeriesId;
    case "is_first_recurring_occurrence":
      return Boolean(ctx.metadata.recurringSeriesId) && ctx.metadata.recurringOccurrenceIndex === 1;
    default:
      return true;
  }
}

export function evaluateConditionGroup(
  group: WorkflowConditionGroup | null | undefined,
  ctx: AppointmentConditionContext,
): boolean {
  if (!group || !group.conditions.length) return true;
  if (group.logic === "or") {
    return group.conditions.some((c) => evaluateCondition(c, ctx));
  }
  return group.conditions.every((c) => evaluateCondition(c, ctx));
}

export function workflowMatchesAppointmentType(
  scope: { mode: "all" | "selected"; typeIds?: string[] },
  serviceId: string | null | undefined,
  serviceName: string | null,
  typeNameToId: Map<string, string>,
): boolean {
  if (scope.mode !== "selected" || !scope.typeIds?.length) return true;
  if (serviceId && scope.typeIds.includes(serviceId)) return true;
  if (serviceName) {
    const id = typeNameToId.get(serviceName);
    if (id && scope.typeIds.includes(id)) return true;
  }
  return false;
}

export function shouldAllowStatusForWorkflow(
  trigger: AppointmentWorkflowTrigger,
  status: string,
): boolean {
  const normalized = normalizeAppointmentStatus(status);
  if (normalized === "canceled") return trigger === "appointment_canceled";

  switch (trigger) {
    case "appointment_completed":
    case "after_appointment":
      return normalized === "completed";
    case "appointment_no_show":
      return normalized === "no_show";
    case "payment_required":
    case "payment_failed":
    case "balance_due":
    case "deposit_paid":
      return normalized !== "completed" && normalized !== "no_show";
    case "payment_received":
      return true;
    case "meeting_completed":
    case "meeting_recap_ready":
      return !["canceled", "no_show"].includes(normalized);
    default:
      return !["completed", "no_show"].includes(normalized);
  }
}
