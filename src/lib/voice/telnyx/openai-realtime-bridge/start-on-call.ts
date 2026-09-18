import "server-only";

export async function startOpenAiRealtimeMediaBridgeOnCall(_input: {
  workspaceId: string;
  callId: string;
  agentId: string;
  telnyxCallControlId: string;
  fromE164?: string | null;
}): Promise<{ started: boolean; reason?: string }> {
  return {
    started: false,
    reason: "voice_v2_realtime_bridge_removed_use_voice_v3_basic",
  };
}
