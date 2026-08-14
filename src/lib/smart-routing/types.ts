export const SMART_ROUTING_FLOW_TYPES = [
  "phone_menu",
  "missed_call_recovery",
  "after_hours",
  "department",
  "custom",
] as const;

export type SmartRoutingFlowType = (typeof SMART_ROUTING_FLOW_TYPES)[number];

export const SMART_ROUTING_STATUSES = [
  "draft",
  "testing",
  "active",
  "paused",
  "needs_attention",
] as const;

export type SmartRoutingFlowStatus = (typeof SMART_ROUTING_STATUSES)[number];

export const SMART_ROUTING_NODE_TYPES = [
  "ENTRY",
  "PLAY_PROMPT",
  "GATHER_DTMF",
  "MENU",
  "TRANSFER_EXTERNAL",
  "RING_GROUP",
  "CALL_WHISPER",
  "BUSINESS_HOURS",
  "VOICEMAIL",
  "AI_RECEPTIONIST",
  "SMS_CONSENT",
  "SEND_SMS",
  "PLAY_CONFIRMATION",
  "HANGUP",
  "SUBFLOW",
] as const;

export type SmartRoutingNodeType = (typeof SMART_ROUTING_NODE_TYPES)[number];

export type DraftNode = {
  id: string;
  type: SmartRoutingNodeType;
  name?: string;
  config: Record<string, unknown>;
  position?: { x: number; y: number };
};

export type DraftEdge = {
  id: string;
  fromNodeId: string;
  conditionType: string;
  conditionValue?: string | null;
  toNodeId: string;
  priority?: number;
};

export type DraftConfig = {
  nodes: DraftNode[];
  edges: DraftEdge[];
  greeting?: {
    source: "elevenlabs" | "recording" | "upload" | "telnyx_tts";
    text?: string;
    audioAssetId?: string;
    voiceId?: string;
    speed?: number;
  };
  menuOptions?: Array<{
    digit: string;
    label: string;
    action: string;
    destinationId?: string;
    phoneNumber?: string;
    aiAgentId?: string;
    fallbackNodeId?: string;
  }>;
  metadata?: Record<string, unknown>;
};

export type CompiledNode = {
  id: string;
  type: SmartRoutingNodeType;
  config: Record<string, unknown>;
  edges: Record<string, string>;
};

export type CompiledFlow = {
  entryNodeId: string;
  nodes: Record<string, CompiledNode>;
};

export type SessionState = {
  gatherRetries?: number;
  ringIndex?: number;
  whisperPending?: boolean;
  whisperAgentControlId?: string;
  whisperText?: string;
  acceptDigit?: string;
  lastDigit?: string;
  subflowStack?: string[];
  awaitingEvent?: string;
  transferLegId?: string;
  ringLegIds?: string[];
  ringMode?: "simultaneous" | "sequential";
  ringPhones?: string[];
  recordingAssetId?: string;
};

export type FlowValidationIssue = {
  code: string;
  message: string;
  nodeId?: string;
};

export type FlowValidationResult = {
  valid: boolean;
  issues: FlowValidationIssue[];
};

export const SMART_ROUTING_DOMAIN_EVENTS = [
  "CALL_RECEIVED",
  "FLOW_STARTED",
  "MENU_SELECTION_RECEIVED",
  "TRANSFER_STARTED",
  "TRANSFER_ANSWERED",
  "TRANSFER_FAILED",
  "VOICEMAIL_RECEIVED",
  "SMS_CONSENT_CAPTURED",
  "MISSED_CALL_TEXT_REQUESTED",
  "AI_HANDOFF_STARTED",
  "AI_HANDOFF_COMPLETED",
  "FLOW_COMPLETED",
  "FLOW_FAILED",
] as const;

export type SmartRoutingDomainEvent = (typeof SMART_ROUTING_DOMAIN_EVENTS)[number];
