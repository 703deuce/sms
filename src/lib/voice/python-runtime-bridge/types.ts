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
  callId: string;
  workspaceId: string;
  agentId: string;
  agentVersionId?: string;
  callerE164?: string;
  toE164?: string;
  timezone: string;
  businessName: string;
  runtimeProfile: "generic_receptionist" | "real_estate" | "unsupported";
  receptionistCompiled?: ReceptionistCompiledSnapshot;
  compiledPrompt?: string;
  greeting?: string;
  realtimeModel?: string;
  realtimeVoice?: string;
  realtimeSpeed?: number;
  eventTypeUri?: string | null;
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
