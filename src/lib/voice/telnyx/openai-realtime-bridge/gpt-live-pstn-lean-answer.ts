import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { isTelnyxVoiceConfigured } from "../assistant-sync";
import { startTelnyxBidirectionalMediaStream } from "./telnyx-streaming";
import { getOpenAiApiKey } from "./config";
import { isGptLivePstnBridgeActive } from "./flags";

/**
 * GPT-Live PSTN experiment: answer → Telnyx media stream only.
 * No recording disclosure, no agent config load, no call events, no Prisma on the hot path.
 */
export async function runGptLivePstnLeanAnswer(input: {
  workspaceId: string;
  callId: string;
  agentId: string;
  telnyxCallControlId: string;
}): Promise<{ ok: boolean; reason?: string }> {
  if (!isGptLivePstnBridgeActive()) {
    return { ok: false, reason: "transport_not_openai_live" };
  }
  if (!isTelnyxVoiceConfigured() || !input.telnyxCallControlId) {
    return { ok: false, reason: "telnyx_not_configured" };
  }
  if (!getOpenAiApiKey()) {
    return { ok: false, reason: "openai_api_key_missing" };
  }

  await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/answer`, {
    method: "POST",
    body: {},
  }).catch(() => undefined);

  await startTelnyxBidirectionalMediaStream({
    callControlId: input.telnyxCallControlId,
    callId: input.callId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
  });

  return { ok: true };
}
