import "server-only";

import { getPrisma } from "@/lib/db";
import {
  appointmentMergeVars,
  renderAppointmentTemplate,
} from "@/lib/appointments/appointments-service";
import {
  appendTimeline,
  loadAppointmentPlatformConfig,
  publicActionUrl,
} from "@/lib/appointments/settings";
import {
  cancelPlatformAppointment,
  updatePlatformAppointmentStatus,
} from "@/lib/appointments/booking-platform";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import { onAppointmentConfirmed } from "@/lib/appointment-workflows/triggers";
import {
  hangupCall,
  speakOnCallRaw,
  transferToPhone,
} from "@/lib/smart-routing/telnyx-provider";
import {
  encodeAppointmentVoiceClientState,
  type AppointmentVoiceClientState,
} from "./client-state";
import type { VoiceKeypadAction, VoiceKeypadOption } from "./types";

export function renderVoiceScripts(input: {
  humanScript: string;
  voicemailScript: string;
  mergeVars: Record<string, string>;
}) {
  return {
    human: renderAppointmentTemplate(input.humanScript, input.mergeVars),
    voicemail: renderAppointmentTemplate(input.voicemailScript, input.mergeVars),
  };
}

export async function buildAppointmentVoiceMergeVars(
  workspaceId: string,
  appointmentId: string,
): Promise<Record<string, string>> {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
  });
  if (!row) throw new Error("Appointment not found");

  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { displayName: true, name: true },
  });
  const meta = (row.metadata || {}) as AppointmentMetadata;

  const { resolveAppointmentBookingLink, resolveAppointmentPaymentLink } = await import(
    "@/lib/appointment-workflows/payment-link"
  );
  const service = row.serviceName
    ? await prisma.voiceService.findFirst({
        where: { workspaceId, name: row.serviceName },
        select: { id: true },
      })
    : null;

  const bookingLink = await resolveAppointmentBookingLink(workspaceId, service?.id);
  const paymentLink = await resolveAppointmentPaymentLink(
    workspaceId,
    appointmentId,
    meta,
    row.serviceName,
  );

  return appointmentMergeVars({
    firstName: meta.inviteeName?.split(/\s+/)[0],
    lastName: meta.inviteeName?.split(/\s+/).slice(1).join(" "),
    businessName: workspace?.displayName || workspace?.name || platform.businessDisplayName,
    service: row.serviceName,
    staffName: row.staffName,
    location: meta.location,
    startsAt: row.startsAt,
    timezone: platform.timezone,
    confirmLink: meta.confirmToken ? publicActionUrl("confirm", meta.confirmToken) : "",
    cancelLink: meta.cancelToken ? publicActionUrl("cancel", meta.cancelToken) : "",
    rescheduleLink: meta.rescheduleToken
      ? publicActionUrl("reschedule", meta.rescheduleToken)
      : "",
    bookingLink,
    paymentLink,
  });
}

export async function executeVoiceKeypadAction(input: {
  workspaceId: string;
  appointmentId: string;
  voiceCallId: string;
  action: VoiceKeypadAction;
  option: VoiceKeypadOption;
  digit: string;
  callControlId: string;
}) {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: input.appointmentId, workspaceId: input.workspaceId },
  });
  if (!row) throw new Error("Appointment not found");
  const meta = (row.metadata || {}) as AppointmentMetadata;

  const timelineBase = {
    detail: optionLabel(input.option),
  };

  switch (input.action) {
    case "confirm": {
      await updatePlatformAppointmentStatus(
        input.workspaceId,
        input.appointmentId,
        "confirmed",
        { ...timelineBase, type: "voice_confirmed", label: "Customer confirmed by phone" },
        "customer",
        { confirmationSource: "voice" },
      );
      await onAppointmentConfirmed(input.workspaceId, input.appointmentId);
      await speakAndHangup(
        input.callControlId,
        input.voiceCallId,
        input.workspaceId,
        "Thank you. Your appointment is confirmed. Goodbye.",
      );
      break;
    }
    case "reschedule": {
      await updatePlatformAppointmentStatus(
        input.workspaceId,
        input.appointmentId,
        "reschedule_requested",
        {
          ...timelineBase,
          type: "voice_reschedule_requested",
          label: "Customer requested reschedule by phone",
        },
        "customer",
      );
      const link = meta.rescheduleToken
        ? publicActionUrl("reschedule", meta.rescheduleToken)
        : "";
      const msg = link
        ? "We have noted your reschedule request. We will send you a link to choose a new time. Goodbye."
        : "We have noted your reschedule request. Please contact us to choose a new time. Goodbye.";
      await speakAndHangup(input.callControlId, input.voiceCallId, input.workspaceId, msg);
      break;
    }
    case "cancel": {
      await cancelPlatformAppointment(input.workspaceId, input.appointmentId, "customer");
      await prisma.voiceAppointment.update({
        where: { id: input.appointmentId },
        data: {
          metadata: appendTimeline(meta, {
            ...timelineBase,
            type: "voice_cancelled",
            label: "Customer cancelled by phone",
          }) as object,
        },
      });
      await speakAndHangup(
        input.callControlId,
        input.voiceCallId,
        input.workspaceId,
        "Your appointment has been cancelled. Goodbye.",
      );
      break;
    }
    case "transfer": {
      const platform = await loadAppointmentPlatformConfig(input.workspaceId);
      const { loadVoiceRemindersConfig } = await import("./storage");
      const voiceConfig = await loadVoiceRemindersConfig(input.workspaceId);
      const transferTo =
        input.option.transferE164?.trim() ||
        voiceConfig.defaultTransferE164?.trim() ||
        platform.businessPhone?.trim() ||
        "";
      if (!transferTo) {
        await speakAndHangup(
          input.callControlId,
          input.voiceCallId,
          input.workspaceId,
          "Sorry, we could not connect your call. Please call us directly. Goodbye.",
        );
        break;
      }
      await prisma.voiceAppointment.update({
        where: { id: input.appointmentId },
        data: {
          metadata: appendTimeline(meta, {
            ...timelineBase,
            type: "voice_transferred",
            label: "Call transferred to office",
            detail: transferTo,
          }) as object,
        },
      });
      await prisma.voiceCall.update({
        where: { id: input.voiceCallId },
        data: { transferred: true, outcome: "transferred" },
      });
      await transferToPhone(input.callControlId, transferTo, undefined, undefined);
      // transfer uses raw client state via telnyx — speak confirmation optional
      break;
    }
    default:
      await speakAndHangup(
        input.callControlId,
        input.voiceCallId,
        input.workspaceId,
        "Sorry, that option is not available. Goodbye.",
      );
  }
}

function optionLabel(option: VoiceKeypadOption): string {
  return option.label || option.action;
}

async function speakAndHangup(
  callControlId: string,
  voiceCallId: string,
  workspaceId: string,
  text: string,
) {
  const clientState = encodeAppointmentVoiceClientState({
    kind: "appointment_voice_reminder",
    voiceCallId,
    workspaceId,
    awaiting: "post_action",
  });
  await speakOnCallRaw(callControlId, text, clientState);
  // Hangup after speak completes via webhook speak.ended — mark intent in metadata
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({ where: { id: voiceCallId } });
  const meta = (call?.metadata || {}) as Record<string, unknown>;
  await prisma.voiceCall.update({
    where: { id: voiceCallId },
    data: {
      metadata: { ...meta, pendingHangup: true } as object,
    },
  });
}

export function findKeypadOption(
  options: VoiceKeypadOption[],
  digit: string,
): VoiceKeypadOption | null {
  return options.find((o) => o.digit === digit) || null;
}

export function validDigitsFromOptions(options: VoiceKeypadOption[]): string {
  return options.map((o) => o.digit).filter(Boolean).join("") || "1234";
}
