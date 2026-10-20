export type LiveKitBootstrapPayload = {
  roomName: string;
  sipParticipantIdentity: string;
  callerE164?: string | null;
  dialedE164?: string | null;
  /** Set by Python worker from SIP participant attributes — not from LiveKit dispatch job metadata. */
  dialedE164Source?: string | null;
  sipCallId?: string | null;
  providerCallId?: string | null;
  trunkId?: string | null;
  ruleId?: string | null;
  telnyxCallScreeningRaw?: string | null;
  /** Set by transovo-voice-v3 worker — not accepted from clients; marks LiveKit SIP bootstrap path. */
  bootstrapPath?: "livekit_sip" | null;
  /** Browser test only (authenticated API creates room); ignored for inbound SIP. */
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
