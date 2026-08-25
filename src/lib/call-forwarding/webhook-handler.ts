import "server-only";

import { decodeCallForwardingOutboundState } from "./access-state";
import {
  handleCallForwardingOutboundGather,
  handleCallForwardingOutboundAnswered,
} from "./outbound-runtime";
import { handleCallForwardingOutboundHangup } from "./outbound-bridge";

export async function processCallForwardingWebhookEvent(input: {
  eventType: string;
  eventPayload: Record<string, unknown>;
}): Promise<{ handled: boolean; kind?: string }> {
  const rawState =
    typeof input.eventPayload.client_state === "string"
      ? input.eventPayload.client_state
      : undefined;
  const state = decodeCallForwardingOutboundState(rawState);
  if (!state) return { handled: false };

  const callControlId = String(input.eventPayload.call_control_id ?? "");

  if (input.eventType === "call.answered") {
    const result = await handleCallForwardingOutboundAnswered({
      callControlId,
      outboundCallId: state.outboundCallId,
      workspaceId: state.workspaceId,
    });
    if (result.handled) return { handled: true, kind: result.kind };
  }

  if (input.eventType === "call.gather.ended" || input.eventType === "call.dtmf.received") {
    const digits = String(
      input.eventPayload.digits ?? input.eventPayload.digit ?? "",
    ).trim();
    const result = await handleCallForwardingOutboundGather({
      callControlId,
      digits,
      outboundCallId: state.outboundCallId,
      workspaceId: state.workspaceId,
    });
    if (result.handled) return { handled: true, kind: "gather" };
  }

  if (input.eventType === "call.hangup") {
    await handleCallForwardingOutboundHangup({
      outboundCallId: state.outboundCallId,
      callControlId,
    });
    return { handled: true, kind: "hangup" };
  }

  return { handled: false };
}
