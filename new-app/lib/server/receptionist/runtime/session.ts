export type LiveKitBootstrapPayload = {
  roomName: string;
  sipParticipantIdentity: string;
  callerE164?: string | null;
  dialedE164?: string | null;
  sipCallId?: string | null;
  providerCallId?: string | null;
  trunkId?: string | null;
  ruleId?: string | null;
  telnyxCallScreeningRaw?: string | null;
  workspaceId?: string;
  agentId?: string;
  useDraft?: boolean;
};

export async function resolveVoiceV3LiveKitSessionForNewApp(payload: LiveKitBootstrapPayload) {
  const { resolveNativeVoiceV3LiveKitSession } = await import(
    "@/lib/server/voice-v3/resolve-livekit-session"
  );
  return resolveNativeVoiceV3LiveKitSession(payload);
}
