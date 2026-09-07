import "server-only";

import { getPrisma } from "@/lib/db";
import {
  appointmentMergeVars,
  renderAppointmentTemplate,
} from "@/lib/appointments/appointments-service";
import { loadAppointmentPlatformConfig, publicActionUrl } from "@/lib/appointments/settings";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import { evaluateConditionGroup, type AppointmentConditionContext } from "./conditions";
import { resolveStepScheduledTime } from "./scheduler";
import { triggerLabel } from "./labels";
import type { AppointmentWorkflowRecord, AppointmentWorkflowStep } from "./types";

export type WorkflowPreviewStep = {
  stepId: string;
  name: string;
  action: string;
  channel: string;
  timingLabel: string;
  scheduledFor: string | null;
  messagePreview: string;
  stopIfConfirmed: boolean;
};

export type WorkflowPreviewResult = {
  workflowName: string;
  trigger: string;
  triggerLabel: string;
  conditionsMatch: boolean | null;
  appointmentId: string | null;
  steps: WorkflowPreviewStep[];
};

function timingLabel(step: AppointmentWorkflowStep): string {
  const timing = step.timing;
  if (timing.kind === "immediate") return "Immediately";
  if (timing.kind !== "relative") {
    return timing.kind === "time_of_day" ? `At ${timing.at} on day offset ${timing.daysBefore}` : "Scheduled";
  }
  const anchor =
    timing.anchor === "appointment_end"
      ? "appointment end"
      : timing.anchor === "booking_created"
        ? "booking created"
        : "appointment start";
  return `${timing.amount} ${timing.unit} ${timing.direction} ${anchor}`;
}

async function loadPreviewAppointment(
  workspaceId: string,
  appointmentId?: string,
): Promise<{
  appointmentId: string | null;
  ctx: AppointmentConditionContext | null;
  startsAt: Date;
  endsAt: Date | null;
  createdAt: Date;
  meta: AppointmentMetadata;
}> {
  const sampleStarts = new Date(Date.now() + 3 * 86_400_000);
  const sampleEnds = new Date(sampleStarts.getTime() + 60 * 60_000);

  if (!appointmentId) {
    return {
      appointmentId: null,
      ctx: {
        appointmentId: "preview",
        workspaceId,
        serviceName: "Consultation",
        status: "scheduled",
        startsAt: sampleStarts,
        endsAt: sampleEnds,
        metadata: { smsConsent: true, inviteePhone: "+15555550100", inviteeEmail: "alex@example.com" },
        contactPhone: "+15555550100",
        contactEmail: "alex@example.com",
      },
      startsAt: sampleStarts,
      endsAt: sampleEnds,
      createdAt: new Date(),
      meta: { smsConsent: true, inviteeName: "Alex" },
    };
  }

  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
  });
  if (!row) {
    return {
      appointmentId: null,
      ctx: null,
      startsAt: sampleStarts,
      endsAt: sampleEnds,
      createdAt: new Date(),
      meta: {},
    };
  }

  const meta = (row.metadata || {}) as AppointmentMetadata;
  const contact = row.contactId
    ? await prisma.contact.findFirst({
        where: { id: row.contactId, workspaceId },
        select: { phone: true, email: true },
      })
    : null;

  const ctx: AppointmentConditionContext = {
    appointmentId: row.id,
    workspaceId: row.workspaceId,
    serviceName: row.serviceName,
    status: row.status,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    staffName: row.staffName,
    location: meta.location,
    metadata: meta,
    contactPhone: contact?.phone || meta.inviteePhone,
    contactEmail: contact?.email || meta.inviteeEmail,
    paymentStatus: typeof meta.paymentStatus === "string" ? meta.paymentStatus : null,
  };

  return {
    appointmentId: row.id,
    ctx,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    createdAt: row.createdAt,
    meta,
  };
}

export async function previewAppointmentWorkflow(input: {
  workspaceId: string;
  workflow: Pick<
    AppointmentWorkflowRecord,
    "name" | "trigger" | "conditions" | "steps" | "channels"
  >;
  appointmentId?: string;
}): Promise<WorkflowPreviewResult> {
  const platform = await loadAppointmentPlatformConfig(input.workspaceId);
  const workspace = await getPrisma().workspace.findUnique({
    where: { id: input.workspaceId },
    select: { displayName: true, name: true },
  });

  const appt = await loadPreviewAppointment(input.workspaceId, input.appointmentId);
  const conditionsMatch = appt.ctx
    ? evaluateConditionGroup(input.workflow.conditions, appt.ctx)
    : null;

  const mergeVars = appointmentMergeVars({
    firstName: appt.meta.inviteeName?.split(/\s+/)[0] || "Alex",
    businessName: workspace?.displayName || workspace?.name || "Business",
    service: appt.ctx?.serviceName || "Consultation",
    startsAt: appt.startsAt,
    timezone: platform.timezone,
    confirmLink: appt.meta.confirmToken
      ? publicActionUrl("confirm", appt.meta.confirmToken)
      : publicActionUrl("confirm", "preview"),
    cancelLink: appt.meta.cancelToken
      ? publicActionUrl("cancel", appt.meta.cancelToken)
      : publicActionUrl("cancel", "preview"),
    rescheduleLink: appt.meta.rescheduleToken
      ? publicActionUrl("reschedule", appt.meta.rescheduleToken)
      : publicActionUrl("reschedule", "preview"),
    reviewLink: typeof appt.meta.reviewLink === "string" ? appt.meta.reviewLink : "https://example.com/review",
  });

  const steps: WorkflowPreviewStep[] = input.workflow.steps
    .filter((step) => step.enabled !== false)
    .map((step) => {
      const scheduledFor = resolveStepScheduledTime({
        timing: step.timing,
        appointmentStartsAt: appt.startsAt,
        appointmentEndsAt: appt.endsAt,
        bookingCreatedAt: appt.createdAt,
      });
      return {
        stepId: step.id,
        name: step.name,
        action: step.action,
        channel: step.channel || input.workflow.channels[0] || "sms",
        timingLabel: timingLabel(step),
        scheduledFor: scheduledFor ? scheduledFor.toISOString() : null,
        messagePreview:
          step.action === "make_voice_call"
            ? step.voiceReminderTemplateId
              ? `Voice call using template ${step.voiceReminderTemplateId}`
              : "Voice call using default reminder template"
            : renderAppointmentTemplate(step.messageTemplate || "", mergeVars),
        stopIfConfirmed: step.stopIfConfirmed === true,
      };
    });

  return {
    workflowName: input.workflow.name,
    trigger: input.workflow.trigger,
    triggerLabel: triggerLabel(input.workflow.trigger),
    conditionsMatch,
    appointmentId: appt.appointmentId,
    steps,
  };
}
