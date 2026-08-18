/**
 * Personal forward overflow — unanswered, busy, and failed destination handling.
 */

import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { isTelnyxPhoneConfigured } from "@/lib/phone/human-call-service";
import {
  readPersonalCallSettings,
  type ForwardFallbackAction,
  type ForwardUnansweredAction,
} from "./personal-call-settings";
import {
  hasTerminalForwardOutcome,
  tagForwardOutcome,
} from "./forward-call-outcomes";

export type PersonalOverflowReason = "unanswered" | "busy" | "failed";

function overflowUnansweredAction(
  settings: ReturnType<typeof readPersonalCallSettings>,
  reason: PersonalOverflowReason,
): ForwardUnansweredAction | ForwardFallbackAction {
  if (reason === "busy") return settings.forwardBusyAction;
  if (reason === "failed") return settings.forwardFailedAction;
  return settings.forwardUnansweredAction;
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
  if (hasTerminalForwardOutcome(call.notes)) return { skipped: true, duplicate: true };

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
  const action = overflowUnansweredAction(callSettings, input.reason);
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

  if (action === "hang_up" || action === "end") {
    await tagForwardOutcome(call.id, "HANG_UP");
    await telnyxRequest(`/calls/${controlId}/actions/hangup`, {
      method: "POST",
      body: {},
    }).catch(() => undefined);
    await prisma.humanCall.update({
      where: { id: call.id },
      data: {
        status: "no-answer",
        endedAt: new Date(),
        onHold: false,
      },
    });
    return { ok: true, action: "hang_up" };
  }

  if (action === "destination_voicemail" && input.reason === "unanswered") {
    await tagForwardOutcome(call.id, "DESTINATION_VOICEMAIL");
    return { ok: true, action: "destination_voicemail" };
  }

  const shouldTransovoVoicemail =
    action === "transovo_voicemail" ||
    action === "voicemail" ||
    input.reason !== "unanswered";

  if (shouldTransovoVoicemail) {
    const subReason =
      input.reason === "busy" ? "busy" : input.reason === "failed" ? "failed" : "no-answer";
    await tagForwardOutcome(
      call.id,
      "SENT_TO_TRANSOVO_VOICEMAIL",
      `[forward_reason:${subReason}]`,
    );
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
    return { ok: true, action: "transovo_voicemail" };
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
