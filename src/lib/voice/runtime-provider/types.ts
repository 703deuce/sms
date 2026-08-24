/**
 * Voice runtime provider abstraction — Telnyx Assistant vs LiveKit Agents.
 */

export type VoiceRuntimeProviderId = "telnyx" | "livekit";

export type InboundSessionMetadata = {
  workspaceId: string;
  agentId: string;
  callId?: string;
  fromE164?: string | null;
  toE164?: string | null;
  telnyxConversationId?: string | null;
  telnyxCallControlId?: string | null;
  livekitRoomName?: string | null;
  livekitParticipantId?: string | null;
  mediaBackend?: import("@/lib/voice/media-backend/types").MediaBackend | null;
  /** Frontdesk profile — skip Amy workflow/realtime session bootstrap for faster answer. */
  lightweightBootstrap?: boolean;
};

export type VoiceRuntimeProvider = {
  readonly id: VoiceRuntimeProviderId;

  /** Human-readable label for admin UI */
  readonly label: string;

  /**
   * Whether inbound PSTN for this agent should use Telnyx AI Assistant webhooks
   * or LiveKit SIP dispatch.
   */
  usesTelnyxAssistantWebhooks(): boolean;

  /**
   * Initialize durable + hot session state when a call/session starts.
   */
  bootstrapSession(metadata: InboundSessionMetadata): Promise<{ callId: string }>;

  /**
   * Tear down hot session state when a call ends.
   */
  endSession(callId: string): Promise<void>;

  /**
   * Provider-specific publish/sync after agent config changes.
   */
  syncAgentConfig?(input: {
    workspaceId: string;
    agentId: string;
  }): Promise<void>;
};
