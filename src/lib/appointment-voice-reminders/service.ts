import "server-only";

import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { isTelnyxVoiceConfigured } from "@/lib/voice/telnyx/assistant-sync";
import { appendTimeline } from "@/lib/appointments/settings";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import { encodeAppointmentVoiceClientState } from "./client-state";
import { resolveAppointmentVoiceCallerId } from "./caller-id";
import {
  buildAppointmentVoiceMergeVars,
  renderVoiceScripts,
} from "./actions";
import { loadVoiceRemindersConfig, resolveVoiceReminderTemplate } from "./storage";
import type { AppointmentVoiceCallMetadata, VoiceReminderTemplate } from "./types";

function connectionId(): string {
  const id =
    process.env.TELNYX_CONNECTION_ID?.trim() ||
    process.env.TELNYX_CALL_CONTROL_APP_ID?.trim();
  if (!id) throw new Error("TELNYX_CONNECTION_ID not configured");
  return id;
}

export type ExecuteVoiceReminderInput = {
  workspaceId: string;
  appointmentId: string;
  toE164: string;
  templateId?: string | null;
  inlineTemplate?: Partial<VoiceReminderTemplate> | null;
  workflowId?: string;
  workflowStepId?: string;
  stepExecutionId?: string;
  attempt?: number;
};

/** Public entry — workflow engine calls this. */
export async function executeAppointmentVoiceReminder(input: ExecuteVoiceReminderInput) {
  const prisma = getPrisma();
  const config = await loadVoiceRemindersConfig(input.workspaceId);
  if (!config.enabled) throw new Error("Voice reminders are disabled");

  const baseTemplate = resolveVoiceReminderTemplate(config, input.templateId);
  const transferDefault = config.defaultTransferE164?.trim();
  const keypadOptions = (input.inlineTemplate?.keypadOptions || baseTemplate.keypadOptions).map((o) =>
    o.action === "transfer" && !o.transferE164?.trim() && transferDefault
      ? { ...o, transferE164: transferDefault }
      : o,
  );
  const template: VoiceReminderTemplate = {
    ...baseTemplate,
    ...(input.inlineTemplate || {}),
    keypadOptions,
  };

  const appointment = await prisma.voiceAppointment.findFirst({
    where: { id: input.appointmentId, workspaceId: input.workspaceId },
    include: { contact: { select: { id: true, phone: true } } },
  });
  if (!appointment) throw new Error("Appointment not found");

  const to = normalizeE164(input.toE164);
  const caller = await resolveAppointmentVoiceCallerId(
    input.workspaceId,
    config.provisionedPhoneNumberId,
  );

  const mergeVars = await buildAppointmentVoiceMergeVars(input.workspaceId, input.appointmentId);
  const scripts = renderVoiceScripts({
    humanScript: template.humanScript,
    voicemailScript: template.voicemailScript,
    mergeVars,
  });

  const metadata: AppointmentVoiceCallMetadata = {
    kind: "appointment_voice_reminder",
    appointmentId: input.appointmentId,
    workspaceId: input.workspaceId,
    workflowId: input.workflowId,
    workflowStepId: input.workflowStepId,
    stepExecutionId: input.stepExecutionId,
    templateId: template.id,
    templateSnapshot: { ...template, humanScript: scripts.human, voicemailScript: scripts.voicemail },
    phase: "queued",
    attempt: input.attempt ?? 1,
  };

  const voiceCall = await prisma.voiceCall.create({
    data: {
      workspaceId: input.workspaceId,
      contactId: appointment.contactId,
      direction: "OUTBOUND",
      status: "QUEUED",
      fromE164: caller.fromE164,
      toE164: to,
      phoneNumberId: caller.phoneNumberId,
      metadata: metadata as object,
    },
  });

  const apptMeta = (appointment.metadata || {}) as AppointmentMetadata;
  await prisma.voiceAppointment.update({
    where: { id: input.appointmentId },
    data: {
      metadata: appendTimeline(apptMeta, {
        type: "voice_reminder_queued",
        label: "Voice reminder call queued",
        detail: template.name,
      }) as object,
    },
  });

  if (!isTelnyxVoiceConfigured()) {
    await prisma.voiceCall.update({
      where: { id: voiceCall.id },
      data: {
        status: "COMPLETED",
        outcome: "mock",
        metadata: { ...metadata, phase: "completed", mock: true } as object,
      },
    });
    return { voiceCallId: voiceCall.id, mock: true };
  }

  const clientState = encodeAppointmentVoiceClientState({
    kind: "appointment_voice_reminder",
    voiceCallId: voiceCall.id,
    workspaceId: input.workspaceId,
  });

  const res = await telnyxRequest<{ data?: { call_control_id?: string } }>("/calls", {
    method: "POST",
    body: {
      connection_id: connectionId(),
      from: caller.fromE164,
      to,
      client_state: clientState,
      answering_machine_detection: "detect",
      answering_machine_detection_config: {
        total_analysis_time_millis: 3500,
      },
    },
  });

  const callControlId = res?.data?.call_control_id ?? null;
  await prisma.voiceCall.update({
    where: { id: voiceCall.id },
    data: {
      telnyxCallControlId: callControlId,
      status: "RINGING",
      metadata: { ...metadata, phase: "ringing" } as object,
    },
  });

  return { voiceCallId: voiceCall.id, callControlId };
}

export async function scheduleVoiceReminderRetry(input: {
  workspaceId: string;
  appointmentId: string;
  toE164: string;
  templateId: string;
  workflowId?: string;
  workflowStepId?: string;
  stepExecutionId?: string;
  attempt: number;
  delayMinutes: number;
}) {
  const { enqueueJob } = await import("@/lib/messaging/enqueue-advance");
  const runAfter = new Date(Date.now() + input.delayMinutes * 60_000);
  await enqueueJob({
    jobType: "appointment_voice_reminder_retry",
    workspaceId: input.workspaceId,
    payload: {
      appointmentId: input.appointmentId,
      toE164: input.toE164,
      templateId: input.templateId,
      workflowId: input.workflowId,
      workflowStepId: input.workflowStepId,
      stepExecutionId: input.stepExecutionId,
      attempt: input.attempt,
    },
    idempotencyKey: `avr-retry:${input.stepExecutionId || input.appointmentId}:${input.attempt}`,
    runAfter,
  });
}

export async function processVoiceReminderRetry(payload: {
  workspaceId: string;
  appointmentId: string;
  toE164: string;
  templateId: string;
  workflowId?: string;
  workflowStepId?: string;
  stepExecutionId?: string;
  attempt: number;
}) {
  return executeAppointmentVoiceReminder({
    workspaceId: payload.workspaceId,
    appointmentId: payload.appointmentId,
    toE164: payload.toE164,
    templateId: payload.templateId,
    workflowId: payload.workflowId,
    workflowStepId: payload.workflowStepId,
    stepExecutionId: payload.stepExecutionId,
    attempt: payload.attempt,
  });
}
