import { getPrisma } from "@/lib/server/db";
import { getAutoAttendantMenu } from "./store";
import { answerCall, gatherUsingAudio, gatherUsingSpeak } from "./telnyx-call-control";
import { startForwardingFlow } from "./forwarding-service";
import { leaveVoicemailOnCall } from "@/lib/server/phone/voicemail-runtime";

export async function startAutoAttendantFlow(input: {
  workspaceId: string;
  humanCallId: string;
  phoneNumberId: string | null;
  inboundControlId: string;
  businessLineE164: string;
  callerE164: string;
  menuId: string;
}) {
  const menu = await getAutoAttendantMenu(input.workspaceId, input.menuId);
  const validDigits = menu.options.map((o) => o.digit).join("");
  const prisma = getPrisma();
  const session = await prisma.phoneCallRoutingSession.create({
    data: {
      workspaceId: input.workspaceId,
      phoneNumberId: input.phoneNumberId,
      humanCallId: input.humanCallId,
      inboundCallControlId: input.inboundControlId,
      stage: "ivr_menu",
      stateJson: { menuId: menu.id, menuVersion: menu.publishedVersion },
    },
  });

  const clientState = {
    workspaceId: input.workspaceId,
    humanCallId: input.humanCallId,
    routingSessionId: session.id,
    kind: "cf_ivr",
    menuId: menu.id,
  };

  await answerCall(input.inboundControlId, clientState);

  const text =
    menu.greetingText ||
    "Thank you for calling. Please listen to the menu and press a number.";

  if (menu.greetingMode === "audio" && menu.greetingAudioUrl) {
    await gatherUsingAudio({
      callControlId: input.inboundControlId,
      audioUrl: menu.greetingAudioUrl,
      validDigits,
      timeoutMs: menu.inputTimeoutMs,
      clientState,
    });
  } else {
    await gatherUsingSpeak({
      callControlId: input.inboundControlId,
      text,
      validDigits,
      voice: menu.voice || undefined,
      language: menu.language || undefined,
      timeoutMs: menu.inputTimeoutMs,
      maxTries: menu.maxRetries,
      invalidPayload: "That option is not available.",
      clientState,
    });
  }

  return session;
}

export async function handleMenuDigitSelection(input: {
  workspaceId: string;
  menuId: string;
  digit: string;
  humanCallId: string;
  inboundControlId: string;
  businessLineE164: string;
  callerE164: string;
  phoneNumberId: string | null;
}) {
  const menu = await getAutoAttendantMenu(input.workspaceId, input.menuId);
  const option = menu.options.find((o) => o.digit === input.digit);
  if (!option) return false;

  const config = (option.actionConfigJson || {}) as Record<string, unknown>;

  if (option.actionType === "forward_phone") {
    const dest = String(config.destinationE164 || config.phoneE164 || "");
    if (!dest) return false;
    await startForwardingFlow({
      workspaceId: input.workspaceId,
      humanCallId: input.humanCallId,
      phoneNumberId: input.phoneNumberId,
      inboundControlId: input.inboundControlId,
      businessLineE164: input.businessLineE164,
      callerE164: input.callerE164,
      effective: {
        kind: "forward",
        destinationE164: dest,
        press1: Boolean(config.press1),
        screeningText: null,
      },
    });
    return true;
  }

  if (option.actionType === "voicemail") {
    await leaveVoicemailOnCall({
      workspaceId: input.workspaceId,
      humanCallId: input.humanCallId,
      telnyxCallControlId: input.inboundControlId,
      phoneNumberId: input.phoneNumberId,
    });
    return true;
  }

  if (option.actionType === "hangup") {
    const { hangupCall } = await import("./telnyx-call-control");
    await hangupCall(input.inboundControlId);
    return true;
  }

  return false;
}
