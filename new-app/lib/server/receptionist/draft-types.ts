import type { AgentConfig } from "@/lib/agent";

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
  runtime: {
    amyInstructions: string;
    astraInstructions: string;
    liveVoiceId: string;
    astraModel: string;
    toolNames: string[];
    maxToolSteps: number;
    openaiFileSearchVectorStoreIds: string[];
    voiceV3: Record<string, unknown>;
  };
};
