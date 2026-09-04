import "server-only";

import { getPrisma } from "@/lib/db";
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
  workflowMatchesAppointmentType,
  type AppointmentConditionContext,
} from "./conditions";
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
    paymentStatus: typeof meta.paymentStatus === "string" ? meta.paymentStatus : null,
  };

  return { row, ctx, meta };
}

async function buildTypeNameToId(workspaceId: string): Promise<Map<string, string>> {
  const rows = await getPrisma().voiceService.findMany({
    where: { workspaceId },
    select: { id: true, name: true },
  });
  return new Map(rows.map((r) => [r.name, r.id]));
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
      .filter((s) => s.state === "scheduled")
      .map((s) => s.id);

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
  if (["canceled", "completed", "no_show"].includes(status)) {
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

  const conditions = workflow.conditions as Parameters<typeof evaluateConditionGroup>[0];
  if (!evaluateConditionGroup(conditions, appointmentCtx.ctx)) {
    await prisma.appointmentWorkflowStepExecution.update({
      where: { id: stepExec.id },
      data: { state: "skipped", failureReason: "conditions_not_met" },
    });
    return;
  }

  try {
    await executeWorkflowStepAction({
      step,
      stepExecId: stepExec.id,
      workspaceId: stepExec.workspaceId,
      appointmentId: execution.appointmentId,
      appointmentCtx: appointmentCtx.ctx,
      meta: appointmentCtx.meta,
    });
    await prisma.appointmentWorkflowStepExecution.update({
      where: { id: stepExec.id },
      data: { state: "sent", executedAt: new Date() },
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
  workspaceId: string;
  appointmentId: string;
  appointmentCtx: AppointmentConditionContext;
  meta: AppointmentMetadata;
}) {
  const prisma = getPrisma();
  const platform = await loadAppointmentPlatformConfig(input.workspaceId);
  const workspace = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { displayName: true, name: true },
  });

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
  });

  const body = renderAppointmentTemplate(input.step.messageTemplate || "", mergeVars);
  const phone = input.appointmentCtx.contactPhone || input.meta.inviteePhone;
  const channel = input.step.channel || "sms";

  switch (input.step.action) {
    case "send_sms_customer":
    case "send_confirm_link":
    case "send_reschedule_link":
    case "send_cancel_link":
    case "send_review_link": {
      if (!phone) throw new Error("No customer phone");
      if (input.meta.smsConsent === false) throw new Error("SMS consent not granted");
      const { sendQuickSms } = await import("@/lib/sms/send-quick");
      await sendQuickSms({ workspaceId: input.workspaceId, to: phone, body });
      const timelineType = `workflow_${input.step.id}_sent`;
      const nextMeta = appendTimeline(input.meta, {
        type: timelineType,
        label: `Workflow: ${input.step.name}`,
      });
      await prisma.voiceAppointment.update({
        where: { id: input.appointmentId },
        data: { metadata: nextMeta as object },
      });
      break;
    }
    case "send_email_customer": {
      const email = input.appointmentCtx.contactEmail || input.meta.inviteeEmail;
      if (!email) throw new Error("No customer email");
      const { sendTransactionalEmail } = await import("@/lib/email/brevo");
      await sendTransactionalEmail({
        to: email,
        subject: `Appointment update — ${workspace?.displayName || workspace?.name || "Transovo"}`,
        htmlContent: body,
        textContent: body,
      });
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
    case "stop_workflow": {
      await invalidateWorkflowExecutionsForAppointment(
        input.workspaceId,
        input.appointmentId,
        "stop_workflow_action",
      );
      break;
    }
    default:
      if (channel === "sms" && phone && input.meta.smsConsent !== false && body) {
        const { sendQuickSms } = await import("@/lib/sms/send-quick");
        await sendQuickSms({ workspaceId: input.workspaceId, to: phone, body });
      }
  }
}
