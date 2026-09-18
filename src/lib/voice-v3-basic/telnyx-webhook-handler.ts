import { forwardInboundCallToOpenAiLiveSip } from "./telnyx-sip-forward";

const transferredCallIds = new Set<string>();

export async function handleVoiceV3BasicTelnyxWebhook(input: {
  eventType: string;
  eventPayload: Record<string, unknown>;
}): Promise<{ action: string; detail?: string }> {
  const callControlId = String(input.eventPayload.call_control_id || "");
  const direction = String(input.eventPayload.direction || "");

  if (input.eventType === "call.initiated") {
    if (!callControlId) {
      return { action: "ignored", detail: "missing_call_control_id" };
    }
    if (direction && direction !== "incoming") {
      return { action: "ignored", detail: `direction_${direction}` };
    }
    if (transferredCallIds.has(callControlId)) {
      return { action: "ignored", detail: "already_transferred" };
    }
    transferredCallIds.add(callControlId);
    if (transferredCallIds.size > 5000) transferredCallIds.clear();

    console.log("VOICE_V3_BASIC_CALL_INITIATED", {
      callControlId,
      from: input.eventPayload.from,
      to: input.eventPayload.to,
    });

    await forwardInboundCallToOpenAiLiveSip(callControlId);
    return { action: "transfer_to_openai_live_sip" };
  }

  if (input.eventType === "call.hangup") {
    const cause = input.eventPayload.hangup_cause;
    console.log("VOICE_V3_BASIC_CALL_HANGUP", { callControlId, hangup_cause: cause });
    return { action: "logged_hangup" };
  }

  return { action: "ignored", detail: input.eventType };
}
