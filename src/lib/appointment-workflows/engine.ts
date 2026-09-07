import "server-only";

import { getPrisma, type DbRow } from "@/lib/db";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import {
  appointmentMergeVars,
  renderAppointmentTemplate,
} from "@/lib/appointments/appointments-service";
import {
  appendTimeline,
  loadAppointmentPlatformConfig,
  publicActionUrl,
} from "@/lib/appointments/settings";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import { normalizeAppointmentStatus } from "@/lib/appointments/types";
import {
  evaluateConditionGroup,
  shouldAllowStatusForWorkflow,
  workflowMatchesAppointmentType,
  type AppointmentConditionContext,
} from "./conditions";
import {
  customerHasFutureAppointment,
  isPaymentOutstanding,
  resolveAppointmentBookingLink,
  resolveAppointmentPaymentLink,
} from "./payment-link";
import { deliverAppointmentWorkflowWebhook } from "./webhook-delivery";
import { webhookHostForLog } from "./webhook-log";
import { resolveStepScheduledTime, stepIdempotencyKey } from "./scheduler";
import { listActiveWorkflowsForTrigger } from "./service";
import type {
  AppointmentWorkflowRecord,
  AppointmentWorkflowStep,
  AppointmentWorkflowTrigger,
} from "./types";

export type WorkflowTriggerEvent = {
  workspaceId: string;
  appointmentId: string;
  trigger: AppointmentWorkflowTrigger;
  contactId?: string | null;
};

async function loadAppointmentContext(workspaceId: string, appointmentId: string) {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
  });
  if (!row) return null;

  const contact = row.contactId
    ? await prisma.contact.findFirst({
        where: { id: row.contactId, workspaceId },
        select: { phone: true, email: true },
      })
    : null;

  const meta = (row.metadata || {}) as AppointmentMetadata;
  const service = row.serviceName
    ? await prisma.voiceService.findFirst({
        where: { workspaceId, name: row.serviceName },
        select: { id: true },
      })
    : null;

  const hasFutureAppointment = await customerHasFutureAppointment(
    workspaceId,
    row.contactId,
    row.id,
  );

  const ctx: AppointmentConditionContext = {
    appointmentId: row.id,
    workspaceId: row.workspaceId,
    serviceName: row.serviceName,
    serviceId: service?.id,
    status: row.status,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    staffName: row.staffName,
    location: meta.location,
    metadata: meta,
    contactPhone: contact?.phone || meta.inviteePhone,
    contactEmail: contact?.email || meta.inviteeEmail,
    contactId: row.contactId,
    paymentStatus: typeof meta.paymentStatus === "string" ? meta.paymentStatus : null,
    hasFutureAppointment,
  };

  return { row, ctx, meta };
}

async function buildTypeNameToId(workspaceId: string): Promise<Map<string, string>> {
  const rows = await getPrisma().voiceService.findMany({
    where: { workspaceId },
    select: { id: true, name: true },
  });
  return new Map(rows.map((r: DbRow) => [r.name, r.id]));
}

export async function dispatchAppointmentWorkflowTrigger(event: WorkflowTriggerEvent) {
  const workflows = await listActiveWorkflowsForTrigger(event.workspaceId, event.trigger);
  if (!workflows.length) return;

  const appointmentCtx = await loadAppointmentContext(event.workspaceId, event.appointmentId);
  if (!appointmentCtx) return;

  const typeMap = await buildTypeNameToId(event.workspaceId);

  for (const workflow of workflows) {
    if (
      !workflowMatchesAppointmentType(
        workflow.appointmentTypeScope,
        appointmentCtx.ctx.serviceId,
        appointmentCtx.ctx.serviceName,
        typeMap,
      )
    ) {
      continue;
    }
    if (!evaluateConditionGroup(workflow.conditions, appointmentCtx.ctx)) continue;
    await startWorkflowExecution(workflow, event.appointmentId, event.contactId);
  }
}

async function startWorkflowExecution(
  workflow: AppointmentWorkflowRecord,
  appointmentId: string,
  contactId?: string | null,
) {
  const prisma = getPrisma();
  const existing = await prisma.appointmentWorkflowExecution.findFirst({
    where: {
      workflowId: workflow.id,
      appointmentId,
      status: "active",
    },
  });
  if (existing) return;

  const appointmentCtx = await loadAppointmentContext(workflow.workspaceId, appointmentId);
  if (!appointmentCtx) return;

  const generation =
    typeof appointmentCtx.meta.reminderGeneration === "number"
      ? appointmentCtx.meta.reminderGeneration
      : 1;

  const execution = await prisma.appointmentWorkflowExecution.create({
    data: {
      workspaceId: workflow.workspaceId,
      workflowId: workflow.id,
      workflowVersion: workflow.version,
      appointmentId,
      contactId: contactId || appointmentCtx.row.contactId,
      status: "active",
      metadata: { generation } as object,
    },
  });

  for (const step of workflow.steps) {
    if (step.enabled === false) continue;
    await scheduleWorkflowStep({
      workflow,
      executionId: execution.id,
      step,
      appointment: appointmentCtx.row,
      generation,
    });
  }
}

async function scheduleWorkflowStep(input: {
  workflow: AppointmentWorkflowRecord;
  executionId: string;
  step: AppointmentWorkflowStep;
  appointment: {
    id: string;
    workspaceId: string;
    startsAt: Date;
    endsAt: Date | null;
    createdAt: Date;
  };
  generation: number;
}) {
  const scheduledFor = resolveStepScheduledTime({
    timing: input.step.timing,
    appointmentStartsAt: input.appointment.startsAt,
    appointmentEndsAt: input.appointment.endsAt,
    bookingCreatedAt: input.appointment.createdAt,
  });
  if (!scheduledFor) return;

  const idempotencyKey = stepIdempotencyKey(
    input.executionId,
    input.step.id,
    scheduledFor,
    input.generation,
  );

  const prisma = getPrisma();
  const existing = await prisma.appointmentWorkflowStepExecution.findUnique({
    where: { idempotencyKey },
  });
  if (existing) return;

  const stepExec = await prisma.appointmentWorkflowStepExecution.create({
    data: {
      workspaceId: input.workflow.workspaceId,
      executionId: input.executionId,
      workflowId: input.workflow.id,
      stepId: input.step.id,
      scheduledFor,
      state: "scheduled",
      channel: input.step.channel || input.workflow.channels[0] || "sms",
      idempotencyKey,
      payload: { stepName: input.step.name, action: input.step.action } as object,
    },
  });

  await enqueueJob({
    jobType: "appointment_workflow_step",
    workspaceId: input.workflow.workspaceId,
    payload: { stepExecutionId: stepExec.id },
    idempotencyKey: `appt-wf-job:${stepExec.id}`,
    runAfter: scheduledFor,
  });
}

export async function cancelPaymentFollowUpSteps(workspaceId: string, appointmentId: string) {
  const prisma = getPrisma();
  const active = await prisma.appointmentWorkflowExecution.findMany({
    where: { workspaceId, appointmentId, status: "active" },
    include: { stepExecutions: true },
  });

  for (const exec of active) {
    const workflow = await prisma.appointmentWorkflow.findFirst({
      where: { id: exec.workflowId, workspaceId },
    });
    if (!workflow) continue;

    const steps = JSON.parse(JSON.stringify(workflow.stepsJson)) as AppointmentWorkflowStep[];
    const paidStepIds = new Set(steps.filter((s) => s.stopIfPaid).map((s) => s.id));
    if (!paidStepIds.size) continue;

    const pendingIds = exec.stepExecutions
      .filter((s: DbRow) => s.state === "scheduled" && paidStepIds.has(s.stepId))
      .map((s: DbRow) => s.id);

    if (pendingIds.length) {
      await prisma.appointmentWorkflowStepExecution.updateMany({
        where: { id: { in: pendingIds } },
        data: { state: "canceled", failureReason: "payment_succeeded" },
      });
    }
  }
}

export async function cancelConfirmationChasingSteps(
  workspaceId: string,
  appointmentId: string,
) {
  const prisma = getPrisma();
  const active = await prisma.appointmentWorkflowExecution.findMany({
    where: { workspaceId, appointmentId, status: "active" },
    include: { stepExecutions: true },
  });

  for (const exec of active) {
    const workflow = await prisma.appointmentWorkflow.findFirst({
      where: { id: exec.workflowId, workspaceId },
    });
    if (!workflow) continue;

    const steps = JSON.parse(JSON.stringify(workflow.stepsJson)) as AppointmentWorkflowStep[];
    const chasingStepIds = new Set(
      steps.filter((s) => s.stopIfConfirmed).map((s) => s.id),
    );
    if (!chasingStepIds.size) continue;

    const pendingIds = exec.stepExecutions
      .filter((s: DbRow) => s.state === "scheduled" && chasingStepIds.has(s.stepId))
      .map((s: DbRow) => s.id);

    if (pendingIds.length) {
      await prisma.appointmentWorkflowStepExecution.updateMany({
        where: { id: { in: pendingIds } },
        data: { state: "canceled", failureReason: "appointment_confirmed" },
      });
    }
  }
}

export async function invalidateWorkflowExecutionsForAppointment(
  workspaceId: string,
  appointmentId: string,
  reason: string,
) {
  const prisma = getPrisma();
  const active = await prisma.appointmentWorkflowExecution.findMany({
    where: { workspaceId, appointmentId, status: "active" },
    include: { stepExecutions: true },
  });

  for (const exec of active) {
    await prisma.appointmentWorkflowExecution.update({
      where: { id: exec.id },
      data: {
        status: "invalidated",
        invalidatedAt: new Date(),
        invalidateReason: reason,
      },
    });

    const pendingIds = exec.stepExecutions
      .filter((s: DbRow) => s.state === "scheduled")
      .map((s: DbRow) => s.id);

    if (pendingIds.length) {
      await prisma.appointmentWorkflowStepExecution.updateMany({
        where: { id: { in: pendingIds } },
        data: { state: "canceled" },
      });
    }
  }
}

export async function rescheduleWorkflowStepsForAppointment(
  workspaceId: string,
  appointmentId: string,
) {
  const prisma = getPrisma();
  await invalidateWorkflowExecutionsForAppointment(
    workspaceId,
    appointmentId,
    "appointment_rescheduled",
  );

  const { listActiveWorkflowsForTrigger: listActive } = await import("./service");
  const activeWorkflows = await listActive(workspaceId, "appointment_booked");
  const appointmentCtx = await loadAppointmentContext(workspaceId, appointmentId);
  if (!appointmentCtx) return;

  const typeMap = await buildTypeNameToId(workspaceId);
  for (const workflow of activeWorkflows) {
    if (
      !workflowMatchesAppointmentType(
        workflow.appointmentTypeScope,
        appointmentCtx.ctx.serviceId,
        appointmentCtx.ctx.serviceName,
        typeMap,
      )
    ) {
      continue;
    }
    await startWorkflowExecution(workflow, appointmentId, appointmentCtx.row.contactId);
  }

  // Also trigger reschedule-specific workflows
  await dispatchAppointmentWorkflowTrigger({
    workspaceId,
    appointmentId,
    trigger: "appointment_rescheduled",
    contactId: appointmentCtx.row.contactId,
  });
}

export async function processAppointmentWorkflowStep(input: { stepExecutionId: string }) {
  const prisma = getPrisma();
  const stepExec = await prisma.appointmentWorkflowStepExecution.findUnique({
    where: { id: input.stepExecutionId },
    include: { execution: true },
  });
  if (!stepExec || stepExec.state !== "scheduled") return;

  const workflow = await prisma.appointmentWorkflow.findFirst({
    where: { id: stepExec.workflowId, workspaceId: stepExec.workspaceId },
  });
  if (!workflow) {
    await prisma.appointmentWorkflowStepExecution.update({
      where: { id: stepExec.id },
      data: { state: "failed", failureReason: "Workflow not found" },
    });
    return;
  }

  const execution = stepExec.execution;
  if (execution.status !== "active") {
    await prisma.appointmentWorkflowStepExecution.update({
      where: { id: stepExec.id },
      data: { state: "canceled" },
    });
    return;
  }

  const appointmentCtx = await loadAppointmentContext(stepExec.workspaceId, execution.appointmentId);
  if (!appointmentCtx) {
    await prisma.appointmentWorkflowStepExecution.update({
      where: { id: stepExec.id },
      data: { state: "failed", failureReason: "Appointment not found" },
    });
    return;
  }

  const steps = JSON.parse(JSON.stringify(workflow.stepsJson)) as AppointmentWorkflowStep[];
  const step = steps.find((s) => s.id === stepExec.stepId);
  if (!step || step.enabled === false) {
    await prisma.appointmentWorkflowStepExecution.update({
      where: { id: stepExec.id },
      data: { state: "skipped" },
    });
    return;
  }

  const status = normalizeAppointmentStatus(appointmentCtx.ctx.status);
  const workflowTrigger = workflow.trigger as AppointmentWorkflowTrigger;
  if (!shouldAllowStatusForWorkflow(workflowTrigger, status)) {
    await prisma.appointmentWorkflowStepExecution.update({
      where: { id: stepExec.id },
      data: { state: "canceled", failureReason: `appointment_${status}` },
    });
    return;
  }

  if (step.stopIfConfirmed && status === "confirmed") {
    await prisma.appointmentWorkflowStepExecution.update({
      where: { id: stepExec.id },
      data: { state: "skipped", failureReason: "already_confirmed" },
    });
    return;
  }

  if (step.stopIfPaid && !isPaymentOutstanding(appointmentCtx.meta)) {
    await prisma.appointmentWorkflowStepExecution.update({
      where: { id: stepExec.id },
      data: { state: "skipped", failureReason: "payment_already_succeeded" },
    });
    return;
  }

  const hasFuture = await customerHasFutureAppointment(
    stepExec.workspaceId,
    appointmentCtx.row.contactId,
    execution.appointmentId,
  );
  appointmentCtx.ctx.hasFutureAppointment = hasFuture;

  if (step.stopIfRebooked && hasFuture) {
    await prisma.appointmentWorkflowStepExecution.update({
      where: { id: stepExec.id },
      data: { state: "skipped", failureReason: "customer_rebooked" },
    });
    return;
  }

  const conditions = workflow.conditions as Parameters<typeof evaluateConditionGroup>[0];
  if (!evaluateConditionGroup(conditions, appointmentCtx.ctx)) {
    await prisma.appointmentWorkflowStepExecution.update({
      where: { id: stepExec.id },
      data: { state: "skipped", failureReason: "conditions_not_met" },
    });
    return;
  }

  try {
    const result = await executeWorkflowStepAction({
      step,
      stepExecId: stepExec.id,
      workflowId: stepExec.workflowId,
      workspaceId: stepExec.workspaceId,
      appointmentId: execution.appointmentId,
      appointmentCtx: appointmentCtx.ctx,
      meta: appointmentCtx.meta,
    });
    await prisma.appointmentWorkflowStepExecution.update({
      where: { id: stepExec.id },
      data: {
        state: "sent",
        executedAt: new Date(),
        ...(result?.providerMessageId ? { providerMessageId: result.providerMessageId } : {}),
        ...(result?.messagePreview
          ? {
              payload: {
                ...((stepExec.payload || {}) as object),
                messagePreview: result.messagePreview,
              } as object,
            }
          : {}),
      },
    });
  } catch (err) {
    await prisma.appointmentWorkflowStepExecution.update({
      where: { id: stepExec.id },
      data: {
        state: "failed",
        failureReason: err instanceof Error ? err.message : "execution failed",
      },
    });
  }
}

async function executeWorkflowStepAction(input: {
  step: AppointmentWorkflowStep;
  stepExecId: string;
  workflowId: string;
  workspaceId: string;
  appointmentId: string;
  appointmentCtx: AppointmentConditionContext;
  meta: AppointmentMetadata;
}): Promise<{ providerMessageId?: string; messagePreview?: string } | void> {
  const prisma = getPrisma();
  const platform = await loadAppointmentPlatformConfig(input.workspaceId);
  const workspace = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { displayName: true, name: true },
  });

  const bookingLink = await resolveAppointmentBookingLink(
    input.workspaceId,
    input.appointmentCtx.serviceId,
  );
  const paymentLink = await resolveAppointmentPaymentLink(
    input.workspaceId,
    input.appointmentId,
    input.meta,
    input.appointmentCtx.serviceName,
  );

  const mergeVars = appointmentMergeVars({
    firstName: input.meta.inviteeName?.split(/\s+/)[0],
    businessName: workspace?.displayName || workspace?.name,
    service: input.appointmentCtx.serviceName,
    startsAt: input.appointmentCtx.startsAt,
    timezone: platform.timezone,
    confirmLink: input.meta.confirmToken
      ? publicActionUrl("confirm", input.meta.confirmToken)
      : "",
    cancelLink: input.meta.cancelToken
      ? publicActionUrl("cancel", input.meta.cancelToken)
      : "",
    rescheduleLink: input.meta.rescheduleToken
      ? publicActionUrl("reschedule", input.meta.rescheduleToken)
      : "",
    reviewLink: typeof input.meta.reviewLink === "string" ? input.meta.reviewLink : "",
    bookingLink,
    paymentLink,
  });

  const body = renderAppointmentTemplate(input.step.messageTemplate || "", mergeVars);
  const phone = input.appointmentCtx.contactPhone || input.meta.inviteePhone;
  const channel = input.step.channel || "sms";

  switch (input.step.action) {
    case "send_sms_customer":
    case "send_confirm_link":
    case "send_reschedule_link":
    case "send_cancel_link":
    case "send_review_link":
    case "send_booking_link":
    case "send_payment_link": {
      if (!phone) throw new Error("No customer phone");
      if (input.meta.smsConsent === false) throw new Error("SMS consent not granted");
      const { sendAppointmentSms } = await import("@/lib/appointments/sms-sender");
      const smsResult = await sendAppointmentSms({
        workspaceId: input.workspaceId,
        to: phone,
        body,
        idempotencyKey: `appt-wf:${input.stepExecId}`,
      });
      const timelineType = `workflow_${input.step.id}_sent`;
      const nextMeta = appendTimeline(input.meta, {
        type: timelineType,
        label: `Workflow: ${input.step.name}`,
      });
      await prisma.voiceAppointment.update({
        where: { id: input.appointmentId },
        data: { metadata: nextMeta as object },
      });
      return {
        providerMessageId:
          smsResult && typeof smsResult === "object" && "messageId" in smsResult
            ? String((smsResult as { messageId?: string }).messageId || "")
            : undefined,
        messagePreview: body.slice(0, 280),
      };
    }
    case "send_email_customer": {
      const email = input.appointmentCtx.contactEmail || input.meta.inviteeEmail;
      if (!email) throw new Error("No customer email");
      const { sendTransactionalEmail } = await import("@/lib/email/brevo");
      const result = await sendTransactionalEmail({
        to: email,
        subject: `Appointment update — ${workspace?.displayName || workspace?.name || "Transovo"}`,
        htmlContent: body,
        textContent: body,
      });
      if (result.status === "failed") {
        throw new Error(result.error || "Email delivery failed — check BREVO_API_KEY configuration");
      }
      break;
    }
    case "send_sms_staff":
    case "send_email_staff": {
      const platform = await loadAppointmentPlatformConfig(input.workspaceId);
      const staffList = platform.staff || [];
      let staffPhone: string | null = null;
      let staffEmail: string | null = null;
      let staffName: string | null = null;

      if (input.step.recipientStaffId) {
        const designated = staffList.find((s) => s.id === input.step.recipientStaffId);
        staffName = designated?.name || null;
      } else if (input.meta.staffId) {
        const assigned = staffList.find((s) => s.id === input.meta.staffId);
        staffName = assigned?.name || input.appointmentCtx.staffName || null;
      } else {
        staffName = input.appointmentCtx.staffName || null;
      }

      const businessPhone = platform.businessPhone || null;
      staffPhone = businessPhone;

      if (input.step.action === "send_sms_staff") {
        if (!staffPhone) throw new Error("No staff phone configured — set business phone in appointment settings");
        const { sendAppointmentSms } = await import("@/lib/appointments/sms-sender");
        const smsResult = await sendAppointmentSms({
          workspaceId: input.workspaceId,
          to: staffPhone,
          body,
          idempotencyKey: `appt-wf-staff:${input.stepExecId}`,
        });
        return {
          providerMessageId:
            smsResult && typeof smsResult === "object" && "messageId" in smsResult
              ? String((smsResult as { messageId?: string }).messageId || "")
              : undefined,
          messagePreview: body.slice(0, 280),
        };
      } else {
        const email = staffEmail || input.meta.staffEmail as string | undefined;
        if (!email) {
          throw new Error("No staff email configured for email notification");
        }
        const { sendTransactionalEmail } = await import("@/lib/email/brevo");
        const result = await sendTransactionalEmail({
          to: email,
          subject: `Staff notification — ${workspace?.displayName || workspace?.name || "Appointment"}`,
          htmlContent: body.replace(/\{\{staff_name\}\}/g, staffName || "Team"),
          textContent: body.replace(/\{\{staff_name\}\}/g, staffName || "Team"),
        });
        if (result.status === "failed") {
          throw new Error(result.error || "Staff email failed — check BREVO_API_KEY configuration");
        }
      }
      break;
    }
    case "mark_confirmed": {
      await prisma.voiceAppointment.update({
        where: { id: input.appointmentId },
        data: {
          status: "confirmed",
          metadata: appendTimeline(input.meta, {
            type: "workflow_confirmed",
            label: "Marked confirmed by workflow",
          }) as object,
        },
      });
      break;
    }
    case "update_status": {
      const rawStatus = input.step.targetStatus?.trim();
      if (!rawStatus) throw new Error("targetStatus is required for update_status");
      const nextStatus = normalizeAppointmentStatus(rawStatus);
      await prisma.voiceAppointment.update({
        where: { id: input.appointmentId },
        data: {
          status: nextStatus,
          metadata: appendTimeline(input.meta, {
            type: "workflow_status_updated",
            label: `Status set to ${nextStatus}`,
            detail: input.step.name,
          }) as object,
        },
      });
      break;
    }
    case "send_webhook": {
      if (!input.step.webhookUrl) throw new Error("Webhook URL is required");
      const result = await deliverAppointmentWorkflowWebhook({
        url: input.step.webhookUrl,
        secret: input.step.webhookSecret,
        idempotencyKey: `appt-wf-webhook:${input.stepExecId}`,
        payload: {
          event: "appointment.workflow.step",
          workflowId: input.workflowId,
          workflowStepId: input.step.id,
          stepExecutionId: input.stepExecId,
          workspaceId: input.workspaceId,
          appointmentId: input.appointmentId,
          appointmentType: input.appointmentCtx.serviceName,
          status: input.appointmentCtx.status,
          scheduledStart: input.appointmentCtx.startsAt.toISOString(),
          scheduledEnd: input.appointmentCtx.endsAt?.toISOString() || null,
          staffId: typeof input.meta.staffId === "string" ? input.meta.staffId : null,
          staffName: input.appointmentCtx.staffName || null,
          locationId: typeof input.meta.locationId === "string" ? input.meta.locationId : null,
          locationName: input.appointmentCtx.location || null,
          contactId: input.appointmentCtx.contactId || null,
          paymentStatus: input.appointmentCtx.paymentStatus || null,
          triggeredAt: new Date().toISOString(),
        },
      });
      if (!result.ok) {
        console.warn(
          "[appointment-workflows] webhook failed",
          webhookHostForLog(input.step.webhookUrl),
          result.error,
        );
        throw new Error(result.error || "Webhook delivery failed");
      }
      const timelineType = `workflow_${input.step.id}_webhook_sent`;
      const nextMeta = appendTimeline(input.meta, {
        type: timelineType,
        label: `Workflow webhook: ${input.step.name}`,
        detail: webhookHostForLog(input.step.webhookUrl),
      });
      await prisma.voiceAppointment.update({
        where: { id: input.appointmentId },
        data: { metadata: nextMeta as object },
      });
      break;
    }
    case "stop_workflow": {
      await invalidateWorkflowExecutionsForAppointment(
        input.workspaceId,
        input.appointmentId,
        "stop_workflow_action",
      );
      break;
    }
    case "make_voice_call": {
      const phone = input.appointmentCtx.contactPhone || input.meta.inviteePhone;
      if (!phone) throw new Error("No customer phone");
      const { executeAppointmentVoiceReminder } = await import(
        "@/lib/appointment-voice-reminders/service"
      );
      await executeAppointmentVoiceReminder({
        workspaceId: input.workspaceId,
        appointmentId: input.appointmentId,
        toE164: phone,
        templateId: input.step.voiceReminderTemplateId,
        workflowId: input.workflowId,
        workflowStepId: input.step.id,
        stepExecutionId: input.stepExecId,
      });
      break;
    }
    default:
      if (channel === "sms" && phone && input.meta.smsConsent !== false && body) {
        const { sendAppointmentSms } = await import("@/lib/appointments/sms-sender");
        const smsResult = await sendAppointmentSms({
          workspaceId: input.workspaceId,
          to: phone,
          body,
          idempotencyKey: `appt-wf:${input.stepExecId}`,
        });
        return {
          providerMessageId:
            smsResult && typeof smsResult === "object" && "messageId" in smsResult
              ? String((smsResult as { messageId?: string }).messageId || "")
              : undefined,
          messagePreview: body.slice(0, 280),
        };
      }
  }
}
