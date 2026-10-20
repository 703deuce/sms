import { getPrisma } from "@/lib/server/db";
import { getAutoAttendantMenu } from "./store";
import { answerCall, gatherUsingAudio, gatherUsingSpeak, hangupCall, speakOnCall } from "./telnyx-call-control";
import { startForwardingFlow, dialDestination } from "./forwarding-service";
import { leaveVoicemailOnCall } from "@/lib/server/phone/voicemail-runtime";
import { canOpenNestedMenu, maxMenuDepth, patchRoutingSessionState } from "./session-state";
import { executeFallback, parseFallbackJson } from "./fallback-executor";

async function playMenuGather(input: {
  inboundControlId: string;
  menu: Awaited<ReturnType<typeof getAutoAttendantMenu>>;
  clientState: Record<string, unknown>;
}) {
  const validDigits = input.menu.options.map((o) => o.digit).join("");
  const text =
    input.menu.greetingText ||
    "Thank you for calling. Please listen to the menu and press a number.";

  if (input.menu.greetingMode === "audio" && input.menu.greetingAudioUrl) {
    await gatherUsingAudio({
      callControlId: input.inboundControlId,
      audioUrl: input.menu.greetingAudioUrl,
      validDigits,
      timeoutMs: input.menu.inputTimeoutMs,
      clientState: input.clientState,
    });
  } else {
    await gatherUsingSpeak({
      callControlId: input.inboundControlId,
      text,
      validDigits,
      voice: input.menu.voice || undefined,
      language: input.menu.language || undefined,
      timeoutMs: input.menu.inputTimeoutMs,
      maxTries: input.menu.maxRetries,
      invalidPayload: "That option is not available.",
      clientState: input.clientState,
    });
  }
}

export async function startAutoAttendantFlow(input: {
  workspaceId: string;
  humanCallId: string;
  phoneNumberId: string | null;
  inboundControlId: string;
  businessLineE164: string;
  callerE164: string;
  menuId: string;
  menuDepth?: number;
  skipAnswer?: boolean;
}) {
  const menu = await getAutoAttendantMenu(input.workspaceId, input.menuId);
  const depth = input.menuDepth ?? 0;
  const prisma = getPrisma();
  let sessionId = "";
  const existing = await prisma.phoneCallRoutingSession.findFirst({
    where: { humanCallId: input.humanCallId, inboundCallControlId: input.inboundControlId },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    sessionId = existing.id;
    await patchRoutingSessionState(sessionId, {
      menuId: menu.id,
      menuDepth: depth,
      businessLineE164: input.businessLineE164,
      callerE164: input.callerE164,
    });
  } else {
    const session = await prisma.phoneCallRoutingSession.create({
      data: {
        workspaceId: input.workspaceId,
        phoneNumberId: input.phoneNumberId,
        humanCallId: input.humanCallId,
        inboundCallControlId: input.inboundControlId,
        stage: "ivr_menu",
        stateJson: {
          menuId: menu.id,
          menuVersion: menu.publishedVersion,
          menuDepth: depth,
          businessLineE164: input.businessLineE164,
          callerE164: input.callerE164,
        },
      },
    });
    sessionId = session.id;
  }

  const clientState = {
    workspaceId: input.workspaceId,
    humanCallId: input.humanCallId,
    routingSessionId: sessionId,
    kind: "cf_ivr",
    menuId: menu.id,
    menuDepth: depth,
    ivrAttempt: 0,
  };

  if (!input.skipAnswer) {
    await answerCall(input.inboundControlId, clientState);
  }

  await playMenuGather({ inboundControlId: input.inboundControlId, menu, clientState });
  return { id: sessionId };
}

export async function handleIvrGatherEnded(input: {
  workspaceId: string;
  menuId: string;
  digits: string;
  humanCallId: string;
  inboundControlId: string;
  businessLineE164: string;
  callerE164: string;
  phoneNumberId: string | null;
  routingSessionId: string;
  clientState: Record<string, unknown>;
}) {
  const menu = await getAutoAttendantMenu(input.workspaceId, input.menuId);
  const digit = input.digits.replace(/\D/g, "").slice(-1);
  const attempt = Number(input.clientState.ivrAttempt || 0);

  if (!digit) {
    const noInput = parseFallbackJson(menu.noInputActionJson);
    const maxRetries = menu.maxRetries ?? 2;
    if (attempt + 1 < maxRetries) {
      await patchRoutingSessionState(input.routingSessionId, { ivrAttempt: attempt + 1 });
      await playMenuGather({
        inboundControlId: input.inboundControlId,
        menu,
        clientState: {
          ...input.clientState,
          kind: "cf_ivr",
          ivrAttempt: attempt + 1,
        },
      });
      return { outcome: "replay" };
    }
    if (noInput) {
      await executeFallback({
        workspaceId: input.workspaceId,
        humanCallId: input.humanCallId,
        inboundControlId: input.inboundControlId,
        phoneNumberId: input.phoneNumberId,
        action: noInput.type === "replay_menu" ? { type: "replay_menu", menuId: menu.id } : noInput,
        routingSessionId: input.routingSessionId,
      });
      return { outcome: "no_input_fallback" };
    }
    await leaveVoicemailOnCall({
      workspaceId: input.workspaceId,
      humanCallId: input.humanCallId,
      telnyxCallControlId: input.inboundControlId,
      phoneNumberId: input.phoneNumberId,
    });
    return { outcome: "voicemail" };
  }

  const ok = await handleMenuDigitSelection({
    workspaceId: input.workspaceId,
    menuId: input.menuId,
    digit,
    humanCallId: input.humanCallId,
    inboundControlId: input.inboundControlId,
    businessLineE164: input.businessLineE164,
    callerE164: input.callerE164,
    phoneNumberId: input.phoneNumberId,
    routingSessionId: input.routingSessionId,
    clientState: input.clientState,
  });

  if (!ok) {
    const invalid = parseFallbackJson(menu.invalidInputActionJson);
    if (invalid) {
      await executeFallback({
        workspaceId: input.workspaceId,
        humanCallId: input.humanCallId,
        inboundControlId: input.inboundControlId,
        phoneNumberId: input.phoneNumberId,
        action: invalid,
        routingSessionId: input.routingSessionId,
      });
      return { outcome: "invalid_fallback" };
    }
    await gatherUsingSpeak({
      callControlId: input.inboundControlId,
      text: "That option is not available.",
      validDigits: menu.options.map((o) => o.digit).join(""),
      clientState: { ...input.clientState, kind: "cf_ivr", ivrAttempt: attempt + 1 },
      maxTries: 1,
    });
    return { outcome: "invalid_retry" };
  }
  return { outcome: "handled" };
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
  routingSessionId?: string;
  clientState?: Record<string, unknown>;
}) {
  const menu = await getAutoAttendantMenu(input.workspaceId, input.menuId);
  const option = menu.options.find((o) => o.digit === input.digit);
  if (!option) return false;

  const config = (option.actionConfigJson || {}) as Record<string, unknown>;

  if (option.actionType === "open_menu") {
    const nestedId = String(config.menuId || "");
    if (!nestedId || !input.clientState || !canOpenNestedMenu(input.clientState)) return false;
    const depth = (input.clientState.menuDepth as number) + 1;
    if (depth > maxMenuDepth()) return false;
    await startAutoAttendantFlow({
      workspaceId: input.workspaceId,
      humanCallId: input.humanCallId,
      phoneNumberId: input.phoneNumberId,
      inboundControlId: input.inboundControlId,
      businessLineE164: input.businessLineE164,
      callerE164: input.callerE164,
      menuId: nestedId,
      menuDepth: depth,
      skipAnswer: true,
    });
    return true;
  }

  if (option.actionType === "forward_phone") {
    let dest = String(config.destinationE164 || config.phoneE164 || "");
    if (!dest && config.destinationId) {
      const row = await getPrisma().forwardingDestination.findFirst({
        where: { id: String(config.destinationId), workspaceId: input.workspaceId, enabled: true },
      });
      dest = row?.phoneE164 || "";
    }
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
        press1: Boolean(config.press1 ?? true),
        screeningText: typeof config.screeningText === "string" ? config.screeningText : null,
      },
    });
    return true;
  }

  if (option.actionType === "ring_group") {
    const groupId = String(config.groupId || "");
    if (!groupId) return false;
    const group = await getPrisma().forwardingGroup.findFirst({
      where: { id: groupId, workspaceId: input.workspaceId, enabled: true },
      include: {
        members: { include: { destination: true }, orderBy: { priority: "asc" } },
      },
    });
    if (!group) return false;
    const destinations = group.members
      .filter((m) => m.enabled && m.destination.enabled)
      .map((m) => ({
        e164: m.destination.phoneE164,
        press1: m.destination.press1Required || m.destination.screeningEnabled,
        timeout: m.destination.ringTimeoutSec,
      }));
    if (!destinations.length) return false;
    await startForwardingFlow({
      workspaceId: input.workspaceId,
      humanCallId: input.humanCallId,
      phoneNumberId: input.phoneNumberId,
      inboundControlId: input.inboundControlId,
      businessLineE164: input.businessLineE164,
      callerE164: input.callerE164,
      effective: {
        kind: "forward_group",
        strategy: group.strategy,
        destinations,
      },
    });
    return true;
  }

  if (option.actionType === "announcement") {
    const text = String(config.text || config.announcementText || "Thank you for calling.");
    await speakOnCall(input.inboundControlId, text, {
      kind: "cf_announcement",
      humanCallId: input.humanCallId,
      workspaceId: input.workspaceId,
      after: String(config.after || "hangup"),
      menuId: input.menuId,
      routingSessionId: input.routingSessionId,
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
    const text = typeof config.goodbyeText === "string" ? config.goodbyeText : null;
    if (text) {
      await speakOnCall(input.inboundControlId, text, {
        kind: "cf_hangup",
        stage: "goodbye",
        humanCallId: input.humanCallId,
      });
    } else {
      await hangupCall(input.inboundControlId);
    }
    return true;
  }

  return false;
}
