/**
 * Personal forward overflow — unanswered, busy, and failed destination handling.
 */

import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { isTelnyxPhoneConfigured } from "@/lib/phone/human-call-service";
import {
  readPersonalCallSettings,
  type ForwardFallbackAction,
} from "./personal-call-settings";

export type PersonalOverflowReason = "unanswered" | "busy" | "failed";

function actionForReason(
  settings: ReturnType<typeof readPersonalCallSettings>,
  reason: PersonalOverflowReason,
): ForwardFallbackAction {
  if (reason === "busy") return settings.forwardBusyAction;
  if (reason === "failed") return settings.forwardFailedAction;
  return settings.forwardUnansweredAction === "end" ? "end" : "voicemail";
}

function fallbackNumber(
  settings: Record<string, unknown>,
  reason: PersonalOverflowReason,
): string | null {
  if (reason === "busy" && typeof settings.forwardBusyNumber === "string") {
    return settings.forwardBusyNumber.trim() || null;
  }
  if (reason === "failed" && typeof settings.forwardFailedNumber === "string") {
    return settings.forwardFailedNumber.trim() || null;
  }
  return null;
}

export async function applyPersonalForwardOverflow(input: {
  workspaceId: string;
  humanCallId: string;
  telnyxCallControlId: string;
  toE164: string;
  reason: PersonalOverflowReason;
}) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({
    where: { id: input.humanCallId, workspaceId: input.workspaceId },
  });
  if (!call) return { skipped: true };

  const pn = await prisma.phoneNumber.findFirst({
    where: { workspaceId: input.workspaceId, e164: input.toE164 },
  });
  const settings =
    pn?.settingsJson && typeof pn.settingsJson === "object"
      ? (pn.settingsJson as Record<string, unknown>)
      : {};
  const callSettings = readPersonalCallSettings({
    settingsJson: settings,
    voiceForwardTo: pn?.voiceForwardTo,
  });
  const action = actionForReason(callSettings, input.reason);
  const controlId = input.telnyxCallControlId;

  await telnyxRequest(`/calls/${controlId}/actions/unhold`, {
    method: "POST",
    body: {},
  }).catch(() => undefined);

  if (action === "another_number") {
    const alt = fallbackNumber(settings, input.reason);
    if (alt && isTelnyxPhoneConfigured()) {
      await telnyxRequest(`/calls/${controlId}/actions/transfer`, {
        method: "POST",
        body: { to: alt },
      }).catch(() => undefined);
      await prisma.humanCall.update({
        where: { id: call.id },
        data: {
          status: "transferred",
          disposition: `personal_${input.reason}_forward:${alt}`,
          endedAt: new Date(),
          onHold: false,
        },
      });
      return { ok: true, action: "another_number", destination: alt };
    }
    // fall through to voicemail if no alt number
  }

  if (action === "announcement") {
    const { playPersonalAnnouncementOnTelnyx } = await import(
      "@/lib/numbers/personal-announcement-playback"
    );
    await playPersonalAnnouncementOnTelnyx(controlId, callSettings, {
      workspaceId: input.workspaceId,
      humanCallId: call.id,
    });
    if (!callSettings.announcementUrl?.trim()) {
      await prisma.humanCall.update({
        where: { id: call.id },
        data: {
          status: "missed",
          disposition: `personal_${input.reason}_announcement`,
          endedAt: new Date(),
          onHold: false,
        },
      });
    }
    return { ok: true, action: "announcement" };
  }

  if (action === "voicemail") {
    const allowVoicemailOverflow =
      callSettings.voicemailEnabled ||
      (input.reason === "unanswered" &&
        callSettings.forwardUnansweredAction === "voicemail" &&
        callSettings.forwardingEnabled);

    if (!allowVoicemailOverflow) {
      // fall through to unavailable message below
    } else {
    const { leaveVoicemailOnCall, ensureNumberVoicemailBox } = await import(
      "@/lib/phone/voicemail-service"
    );
    if (pn?.id) {
      await ensureNumberVoicemailBox(input.workspaceId, pn.id).catch(() => undefined);
    }
    await leaveVoicemailOnCall({
      workspaceId: input.workspaceId,
      humanCallId: call.id,
      telnyxCallControlId: controlId,
      userId: call.agentUserId,
      phoneNumberId: pn?.id ?? null,
    }).catch(async () => {
      await telnyxRequest(`/calls/${controlId}/actions/hangup`, {
        method: "POST",
        body: {},
      }).catch(() => undefined);
    });
    return { ok: true, action: "voicemail" };
    }
  }

  await telnyxRequest(`/calls/${controlId}/actions/speak`, {
    method: "POST",
    body: {
      payload: "The person you are trying to reach is not available.",
      voice: "female",
      language: "en-US",
    },
  }).catch(() => undefined);
  await telnyxRequest(`/calls/${controlId}/actions/hangup`, {
    method: "POST",
    body: {},
  }).catch(() => undefined);
  await prisma.humanCall.update({
    where: { id: call.id },
    data: {
      status: "missed",
      disposition: `personal_${input.reason}_end`,
      endedAt: new Date(),
      onHold: false,
    },
  });
  return { ok: true, action: "end" };
}

export function isPersonalForwardCall(notes: string | null | undefined): boolean {
  return (notes || "").includes("[personal_forward:");
}
