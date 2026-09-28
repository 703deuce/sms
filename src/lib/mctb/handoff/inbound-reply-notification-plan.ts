import type { MctbHandoffEventType } from "./types";

export type InboundReplyNotificationPlan = {
  eventType: MctbHandoffEventType;
  urgent: boolean;
};

/** One event type per inbound (no duplicate normal + urgent email). */
export function planInboundReplyNotificationEvent(input: {
  callbackRequested: boolean;
  urgent: boolean;
}): InboundReplyNotificationPlan {
  if (input.callbackRequested) {
    return { eventType: "callback_requested", urgent: input.urgent };
  }
  if (input.urgent) {
    return { eventType: "urgent_detected", urgent: true };
  }
  return { eventType: "caller_replied", urgent: false };
}
