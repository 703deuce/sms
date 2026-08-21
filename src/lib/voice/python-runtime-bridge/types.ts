import type { AgentFieldDefinition, ReceptionistCompiledSnapshot } from "@/lib/voice/receptionist/types";

export type PythonRuntimeBootstrapInput = {
  roomName: string;
  participantIdentity: string;
  participantAttributes?: Record<string, string>;
  jobMetadata?: string | Record<string, unknown> | null;
  roomMetadata?: string | Record<string, unknown> | null;
};

export type PythonRuntimeBootstrapResult = {
  ok: true;
  apiVersion: 1;
  callId: string;
  workspaceId: string;
  agentId: string;
  agentVersionId?: string;
  callerE164?: string;
  toE164?: string;
  timezone: string;
  businessName: string;
  runtimeProfile: "generic_receptionist" | "real_estate" | "unsupported";
  agentTemplate?: string;
  agentTemplateVersion?: string;
  runtime?: "livekit_python";
  receptionistCompiled?: ReceptionistCompiledSnapshot;
  compiledPrompt?: string;
  greeting?: string;
  realtimeModel?: string;
  realtimeVoice?: string;
  realtimeSpeed?: number;
  eventTypeUri?: string | null;
  sipOutboundTrunkId?: string | null;
  sipCallerIdE164?: string | null;
};

export type PythonRuntimeError = {
  ok: false;
  error: string;
  code?: string;
};

export type PersistIntakeFieldsInput = {
  workspaceId: string;
  agentId: string;
  callId: string;
  fields: Record<string, string>;
  purpose?: "booking" | "message" | "service";
};

export type PersistMessageInput = {
  workspaceId: string;
  agentId: string;
  callId: string;
  fields: Record<string, string>;
  summary?: string;
};

export type ResolveTransferInput = {
  workspaceId: string;
  agentId: string;
  callId: string;
  reason?: string;
  transferPolicy?: Record<string, unknown> | null;
};

export type AvailabilitySlot = {
  slotId: string;
  startTimeIso: string;
  durationMin: number;
  spokenLabel: string;
};

export type ExtractFieldsInput = {
  transcript: string;
  manifest: AgentFieldDefinition[];
  currentFields: Record<string, string>;
  callerE164?: string;
};
