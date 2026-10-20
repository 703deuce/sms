import { getPrisma } from "@/lib/server/db";
import { decodeTelnyxClientState } from "@/lib/server/phone/telnyx-call-actions";
import { phoneServerLog } from "@/lib/server/phone/phone-log";
import { handleMenuDigitSelection } from "./menu-executor";
import { handleScreeningGather, dialDestination } from "./forwarding-service";
import { gatherUsingSpeak } from "./telnyx-call-control";
import { recordBridgedConversation, recordMissedForward } from "./usage-accounting";

export async function processCallForwardingWebhookEvent(input: {
  eventType: string;
  eventPayload: Record<string, unknown>;
}): Promise<{ handled: boolean; result?: unknown }> {
  const clientState = decodeTelnyxClientState(input.eventPayload.client_state);
  const kind = String(clientState.kind || "");
  if (!kind.startsWith("cf_")) return { handled: false };

  const eventControlId = input.eventPayload.call_control_id
    ? String(input.eventPayload.call_control_id)
    : "";

  if (input.eventType === "call.gather.ended") {
    const digits = String(
      (input.eventPayload as { digits?: string }).digits ||
        (input.eventPayload as { dtmf_digits?: string }).dtmf_digits ||
        "",
    );
    if (kind === "cf_ivr" && clientState.menuId) {
      const call = await getPrisma().humanCall.findUnique({
        where: { id: String(clientState.humanCallId) },
      });
      if (!call) return { handled: true };
      const ok = await handleMenuDigitSelection({
        workspaceId: String(clientState.workspaceId),
        menuId: String(clientState.menuId),
        digit: digits.slice(-1),
        humanCallId: call.id,
        inboundControlId: eventControlId,
        businessLineE164: call.to,
        callerE164: call.from,
        phoneNumberId: call.phoneNumberId,
      });
      return { handled: true, result: { menuAction: ok } };
    }
    if (
      (kind === "cf_outbound" || kind === "cf_screening") &&
      (clientState.press1Required || kind === "cf_screening")
    ) {
      await handleScreeningGather({
        outboundControlId: eventControlId,
        digit: digits.slice(-1),
        clientState,
      });
      return { handled: true };
    }
  }

  if (input.eventType === "call.answered" && kind === "cf_outbound" && clientState.press1Required) {
    const screening =
      typeof clientState.screeningText === "string"
        ? clientState.screeningText
        : "You have a business call. Press 1 to accept or 2 to decline.";
    await gatherUsingSpeak({
      callControlId: eventControlId,
      text: screening,
      validDigits: "12",
      clientState: { ...clientState, kind: "cf_screening" },
    });
    return { handled: true };
  }

  if (input.eventType === "call.speak.ended" && clientState.stage === "greeting_done") {
    const dest = String(clientState.destinationE164 || "");
    if (dest && clientState.parentCallControlId) {
      await dialDestination({
        sessionId: String(clientState.routingSessionId),
        workspaceId: String(clientState.workspaceId),
        humanCallId: String(clientState.humanCallId),
        inboundControlId: String(clientState.parentCallControlId),
        businessLineE164: "",
        callerE164: "",
        destinationE164: dest,
      });
    }
    return { handled: true };
  }

  if (input.eventType === "call.bridged" && clientState.workspaceId) {
    await recordBridgedConversation(String(clientState.workspaceId), 0);
    return { handled: true };
  }

  if (input.eventType === "call.hangup" && kind === "cf_outbound") {
    const queue = (clientState.sequentialQueue || []) as Array<{
      e164: string;
      press1: boolean;
      timeout: number;
    }>;
    if (queue.length && clientState.parentCallControlId) {
      const next = queue[0];
      await dialDestination({
        sessionId: String(clientState.routingSessionId),
        workspaceId: String(clientState.workspaceId),
        humanCallId: String(clientState.humanCallId),
        inboundControlId: String(clientState.parentCallControlId),
        businessLineE164: "",
        callerE164: "",
        destinationE164: next.e164,
        press1: next.press1,
        sequentialQueue: queue.slice(1),
      });
      return { handled: true };
    }
    if (clientState.workspaceId) {
      await recordMissedForward(String(clientState.workspaceId));
    }
  }

  phoneServerLog("call-forwarding", "webhook_event", {
    eventType: input.eventType,
    kind,
  });

  return { handled: true };
}
