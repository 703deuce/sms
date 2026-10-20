import type { AgentConfig } from "@/lib/agent";
import type { ReceptionistConfigProvenance } from "@/lib/server/receptionist/editor-config-digest";
import type { VoiceV3PromptFingerprint } from "@/lib/server/voice-v3/prompt-fingerprint";

export type ReceptionistDraftEnvelope = {
  schemaVersion: number;
  draftRevision: number;
  updatedAt: string;
  editor: AgentConfig;
};

export type ReceptionistPublishedBundle = {
  schemaVersion: number;
  publishedAt: string;
  editor: AgentConfig;
  configProvenance?: ReceptionistConfigProvenance;
  runtime: {
    amyInstructions: string;
    astraInstructions: string;
    liveVoiceId: string;
    astraModel: string;
    toolNames: string[];
    maxToolSteps: number;
    openaiFileSearchVectorStoreIds: string[];
    promptFingerprint?: VoiceV3PromptFingerprint;
    voiceV3: Record<string, unknown>;
  };
};
