export type VoiceRoutingMode = "telnyx_assistant" | "livekit_sip";

export type ProvisionState =
  | "pending"
  | "provisioning"
  | "active"
  | "error"
  | "removed";

export type TelephonyProvisionRecord = {
  routingMode?: VoiceRoutingMode;
  state?: ProvisionState;
  telnyxFqdnConnectionId?: string;
  telnyxFqdnId?: string;
  livekitInboundTrunkId?: string;
  livekitDispatchRuleId?: string;
  /** Shared platform outbound trunk id (same for all tenants; caller ID varies per call). */
  livekitOutboundTrunkId?: string;
  explicitDispatch?: {
    workspaceId?: string;
    agentId?: string;
    publishedVersionId?: string;
    livekitProfile?: string;
    agentTemplate?: string;
    pythonRuntimeBootstrapSnapshot?: Record<string, unknown>;
    updatedAt?: string;
  };
  lastProvisionedAt?: string;
  lastVerifiedAt?: string;
  lastError?: string | null;
};

export type EnsureNumberProvisionedInput = {
  workspaceId: string;
  phoneNumberId: string;
  agentId?: string | null;
  publishedVersionId?: string | null;
  publishedConfig?: import("@/lib/voice/types").VoiceAgentConfig;
  /** Force LiveKit even when global provider is telnyx */
  routingMode?: VoiceRoutingMode;
};

export type EnsureNumberProvisionedResult = {
  ok: boolean;
  phoneNumberId: string;
  e164: string;
  routingMode: VoiceRoutingMode;
  provision: TelephonyProvisionRecord;
  actions: string[];
  error?: string;
};

export type AssignNumberToAgentInput = {
  workspaceId: string;
  phoneNumberId: string;
  agentId: string;
  exclusive?: boolean;
};

export type AssignNumberToAgentResult = {
  ok: boolean;
  phoneNumberId: string;
  agentId: string;
  e164: string;
  provision?: EnsureNumberProvisionedResult;
};

export type AgentRoutingResolution = {
  workspaceId: string;
  agentId: string;
  phoneNumberId: string;
  e164: string;
  agentStatus: string;
  agentName: string;
};

export type VerifyRoutingResult = {
  ok: boolean;
  e164: string;
  routingMode: VoiceRoutingMode | "unknown";
  telnyxConnectionId?: string;
  telnyxConnectionName?: string;
  livekitTrunkHasNumber?: boolean;
  livekitTrunkId?: string;
  livekitTrunkNumbers?: string[];
  livekitDispatchRuleId?: string;
  livekitOutboundTrunkId?: string;
  livekitDispatchTrunkIds?: string[];
  livekitSipHost?: string;
  dbAgentId?: string | null;
  issues: string[];
};
