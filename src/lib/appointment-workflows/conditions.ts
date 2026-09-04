import type { AppointmentMetadata } from "@/lib/appointments/types";
import { normalizeAppointmentStatus } from "@/lib/appointments/types";
import type { WorkflowCondition, WorkflowConditionGroup } from "./types";

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
  paymentStatus?: string | null;
};

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
