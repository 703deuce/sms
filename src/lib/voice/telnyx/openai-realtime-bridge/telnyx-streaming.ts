import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { buildTelnyxMediaStreamUrl } from "./config";
import { mintRealtimeBridgeStreamToken } from "./stream-token";

export async function startTelnyxBidirectionalMediaStream(input: {
  callControlId: string;
  callId: string;
  workspaceId: string;
  agentId: string;
}): Promise<{ streamUrl: string }> {
  const token = mintRealtimeBridgeStreamToken({
    callId: input.callId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    callControlId: input.callControlId,
  });
  const streamUrl = buildTelnyxMediaStreamUrl(token);

  await telnyxRequest(`/calls/${input.callControlId}/actions/streaming_start`, {
    method: "POST",
    body: {
      stream_url: streamUrl,
      stream_track: "both_tracks",
      enable_dialogflow: false,
      stream_bidirectional_mode: "rtp",
      stream_bidirectional_codec: "PCMU",
    },
  });

  return { streamUrl };
}

export async function stopTelnyxMediaStream(callControlId: string): Promise<void> {
  await telnyxRequest(`/calls/${callControlId}/actions/streaming_stop`, {
    method: "POST",
    body: {},
  }).catch(() => undefined);
}
