import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { tryNotePstnWizardBindingFromToE164 } from "@/lib/voice-v3/resolve-pstn-wizard-binding";
import { noteTelnyxPstnReceived } from "@/lib/voice-v3/telemetry/call-trace";
import { forwardInboundCallToOpenAiLiveSip } from "./telnyx-sip-forward";

const SIP_FORWARD_FAILURE_APOLOGY =
  "We're sorry, our assistant is temporarily unavailable. Please call back shortly. Goodbye.";

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

    noteTelnyxPstnReceived(callControlId, String(input.eventPayload.from || ""));
    await tryNotePstnWizardBindingFromToE164({
      callControlId,
      toE164: String(input.eventPayload.to || ""),
      fromE164: String(input.eventPayload.from || ""),
    }).catch((err) => {
      console.error("VOICE_V3_PSTN_WIZARD_BIND_FAILED", { callControlId, err });
    });

    console.log("VOICE_V3_BASIC_CALL_INITIATED", {
      callControlId,
      from: input.eventPayload.from,
      to: input.eventPayload.to,
    });

    try {
      await forwardInboundCallToOpenAiLiveSip(callControlId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("VOICE_V3_BASIC_SIP_FORWARD_FAILED", { callControlId, message });
      await telnyxRequest(`/calls/${encodeURIComponent(callControlId)}/actions/speak`, {
        method: "POST",
        body: { payload: SIP_FORWARD_FAILURE_APOLOGY, voice: "female", language: "en-US" },
      }).catch(() => undefined);
      await telnyxRequest(`/calls/${encodeURIComponent(callControlId)}/actions/hangup`, {
        method: "POST",
        body: {},
      }).catch(() => undefined);
      return { action: "transfer_failed", detail: message };
    }
    return { action: "transfer_to_openai_live_sip" };
  }

  if (input.eventType === "call.hangup") {
    const cause = input.eventPayload.hangup_cause;
    console.log("VOICE_V3_BASIC_CALL_HANGUP", { callControlId, hangup_cause: cause });
    return { action: "logged_hangup" };
  }

  return { action: "ignored", detail: input.eventType };
}
