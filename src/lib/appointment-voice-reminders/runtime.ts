import "server-only";

import { getPrisma } from "@/lib/db";
import { appendTimeline } from "@/lib/appointments/settings";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import {
  gatherUsingSpeakRaw,
  hangupCall,
  playbackOnCall,
  speakOnCallRaw,
} from "@/lib/smart-routing/telnyx-provider";
import {
  decodeAppointmentVoiceClientState,
  encodeAppointmentVoiceClientState,
  parseVoiceCallMetadata,
} from "./client-state";
import {
  executeVoiceKeypadAction,
  findKeypadOption,
  validDigitsFromOptions,
} from "./actions";
import { scheduleVoiceReminderRetry } from "./service";
import type { AppointmentVoiceCallMetadata } from "./types";

function callControlIdFromPayload(payload: Record<string, unknown>): string | null {
  const p = payload as { call_control_id?: string; call_leg_id?: string };
  return p.call_control_id || p.call_leg_id || null;
}

async function updateVoiceCallMeta(voiceCallId: string, patch: Partial<AppointmentVoiceCallMetadata>) {
  const prisma = getPrisma();
  const row = await prisma.voiceCall.findUnique({ where: { id: voiceCallId } });
  if (!row) return;
  const meta = parseVoiceCallMetadata(row.metadata) || ({} as AppointmentVoiceCallMetadata);
  await prisma.voiceCall.update({
    where: { id: voiceCallId },
    data: { metadata: { ...meta, ...patch } as object },
  });
}

async function appendAppointmentTimeline(
  workspaceId: string,
  appointmentId: string,
  event: { type: string; label: string; detail?: string },
) {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
  });
  if (!row) return;
  const meta = (row.metadata || {}) as AppointmentMetadata;
  await prisma.voiceAppointment.update({
    where: { id: appointmentId },
    data: { metadata: appendTimeline(meta, event) as object },
  });
}

async function playHumanPrompt(
  callControlId: string,
  voiceCallId: string,
  workspaceId: string,
  meta: AppointmentVoiceCallMetadata,
) {
  const template = meta.templateSnapshot;
  const validDigits = validDigitsFromOptions(template.keypadOptions);
  const promptText =
    template.humanScript?.trim() ||
    "Hello. This is your appointment reminder. Please make your selection now.";
  const clientState = encodeAppointmentVoiceClientState({
    kind: "appointment_voice_reminder",
    voiceCallId,
    workspaceId,
    awaiting: "dtmf",
  });

  if (template.contentMode === "audio" && template.audioUrl) {
    await playbackOnCall(callControlId, template.audioUrl, undefined, undefined);
    await gatherUsingSpeakRaw({
      callControlId,
      text: "Please make your selection now.",
      validDigits,
      clientStateBase64: clientState,
    });
  } else {
    await gatherUsingSpeakRaw({
      callControlId,
      text: promptText,
      validDigits,
      timeoutMs: 12000,
      clientStateBase64: clientState,
    });
  }
  await updateVoiceCallMeta(voiceCallId, { phase: "awaiting_dtmf" });
}

async function playVoicemailPrompt(
  callControlId: string,
  voiceCallId: string,
  workspaceId: string,
  meta: AppointmentVoiceCallMetadata,
) {
  const template = meta.templateSnapshot;
  const clientState = encodeAppointmentVoiceClientState({
    kind: "appointment_voice_reminder",
    voiceCallId,
    workspaceId,
    awaiting: "post_action",
  });

  if (template.contentMode === "audio" && template.voicemailAudioUrl) {
    await playbackOnCall(callControlId, template.voicemailAudioUrl, undefined, undefined);
  } else {
    await speakOnCallRaw(callControlId, template.voicemailScript, clientState);
  }

  await updateVoiceCallMeta(voiceCallId, {
    phase: "voicemail_prompt",
    amdResult: "machine",
  });
  await appendAppointmentTimeline(workspaceId, meta.appointmentId, {
    type: "voice_reminder_voicemail",
    label: "Voice reminder left on voicemail",
  });

  const prisma = getPrisma();
  await prisma.voiceCall.update({
    where: { id: voiceCallId },
    data: { voicemailDetected: true, outcome: "voicemail", metadata: { ...meta, pendingHangup: true } as object },
  });
}

export async function processAppointmentVoiceReminderWebhook(input: {
  eventType: string;
  eventPayload: Record<string, unknown>;
}): Promise<{ handled: boolean }> {
  const clientStateRaw =
    (input.eventPayload.client_state as string | undefined) ||
    (input.eventPayload as { client_state?: string }).client_state;
  const state = decodeAppointmentVoiceClientState(clientStateRaw);
  if (!state) return { handled: false };

  const prisma = getPrisma();
  const voiceCall = await prisma.voiceCall.findUnique({ where: { id: state.voiceCallId } });
  if (!voiceCall) return { handled: false };

  const meta = parseVoiceCallMetadata(voiceCall.metadata);
  if (!meta) return { handled: false };

  const callControlId = callControlIdFromPayload(input.eventPayload);
  const eventType = input.eventType;

  if (eventType === "call.answered") {
    await prisma.voiceCall.update({
      where: { id: voiceCall.id },
      data: { status: "IN_PROGRESS", answeredAt: new Date() },
    });
    await appendAppointmentTimeline(meta.workspaceId, meta.appointmentId, {
      type: "voice_reminder_answered",
      label: "Voice reminder answered",
    });
    await updateVoiceCallMeta(voiceCall.id, { phase: "human_prompt" });
    if (callControlId) {
      await playHumanPrompt(callControlId, voiceCall.id, meta.workspaceId, meta);
    }
    return { handled: true };
  }

  if (
    eventType.includes("machine") &&
    eventType.includes("detection")
  ) {
    const result = String(
      (input.eventPayload as { result?: string }).result ||
        (input.eventPayload as { machine_detection_result?: string }).machine_detection_result ||
        "",
    ).toLowerCase();
    if (result.includes("machine") || result.includes("voicemail")) {
      if (callControlId) {
        await playVoicemailPrompt(callControlId, voiceCall.id, meta.workspaceId, meta);
      }
      const retry = meta.templateSnapshot.retryRules?.voicemail;
      if (retry?.mode === "retry" && retry.delayMinutes) {
        await scheduleVoiceReminderRetry({
          workspaceId: meta.workspaceId,
          appointmentId: meta.appointmentId,
          toE164: voiceCall.toE164,
          templateId: meta.templateId,
          workflowId: meta.workflowId,
          workflowStepId: meta.workflowStepId,
          stepExecutionId: meta.stepExecutionId,
          attempt: (meta.attempt || 1) + 1,
          delayMinutes: retry.delayMinutes,
        });
      }
      return { handled: true };
    }
  }

  if (eventType === "call.gather.ended" || eventType === "call.dtmf.received") {
    const digit = String(
      (input.eventPayload as { digits?: string }).digits ||
        (input.eventPayload as { digit?: string }).digit ||
        "",
    ).trim();
    if (!digit || !callControlId) return { handled: true };

    const option = findKeypadOption(meta.templateSnapshot.keypadOptions, digit[0]);
    if (!option || option.action === "none") {
      await speakOnCallRaw(
        callControlId,
        "Sorry, that is not a valid option. Goodbye.",
        encodeAppointmentVoiceClientState({
          kind: "appointment_voice_reminder",
          voiceCallId: voiceCall.id,
          workspaceId: meta.workspaceId,
        }),
      );
      return { handled: true };
    }

    await updateVoiceCallMeta(voiceCall.id, {
      lastDigit: digit[0],
      lastAction: option.action,
      phase: "action_complete",
    });

    await executeVoiceKeypadAction({
      workspaceId: meta.workspaceId,
      appointmentId: meta.appointmentId,
      voiceCallId: voiceCall.id,
      action: option.action,
      option,
      digit: digit[0],
      callControlId,
    });
    return { handled: true };
  }

  if (eventType === "call.speak.ended" || eventType === "call.playback.ended") {
    const rawMeta = (voiceCall.metadata || {}) as Record<string, unknown>;
    if (rawMeta.pendingHangup && callControlId) {
      await hangupCall(callControlId);
      await prisma.voiceCall.update({
        where: { id: voiceCall.id },
        data: {
          status: "COMPLETED",
          endedAt: new Date(),
          outcome: meta.lastAction || "completed",
          metadata: { ...meta, phase: "completed", pendingHangup: false } as object,
        },
      });
    }
    return { handled: true };
  }

  if (eventType === "call.hangup") {
    const cause = String((input.eventPayload as { hangup_cause?: string }).hangup_cause || "");
    await prisma.voiceCall.update({
      where: { id: voiceCall.id },
      data: {
        status: voiceCall.status === "COMPLETED" ? "COMPLETED" : "FAILED",
        endedAt: new Date(),
        durationSeconds: voiceCall.startedAt
          ? Math.max(0, Math.floor((Date.now() - voiceCall.startedAt.getTime()) / 1000))
          : undefined,
        outcome: meta.lastAction || (cause.includes("busy") ? "busy" : cause || "completed"),
      },
    });

    if (!voiceCall.answeredAt) {
      const retryRules = meta.templateSnapshot.retryRules?.noAnswer;
      const attempt = meta.attempt || 1;
      if (
        retryRules?.mode === "retry" &&
        retryRules.maxAttempts &&
        attempt < retryRules.maxAttempts &&
        retryRules.delayMinutes
      ) {
        await scheduleVoiceReminderRetry({
          workspaceId: meta.workspaceId,
          appointmentId: meta.appointmentId,
          toE164: voiceCall.toE164,
          templateId: meta.templateId,
          workflowId: meta.workflowId,
          workflowStepId: meta.workflowStepId,
          stepExecutionId: meta.stepExecutionId,
          attempt: attempt + 1,
          delayMinutes: retryRules.delayMinutes,
        });
      }
      await appendAppointmentTimeline(meta.workspaceId, meta.appointmentId, {
        type: "voice_reminder_no_answer",
        label: "Voice reminder — no answer",
        detail: cause,
      });
    }
    return { handled: true };
  }

  return { handled: false };
}
