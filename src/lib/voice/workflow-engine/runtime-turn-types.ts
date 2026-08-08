import type { WorkflowAction } from "@/lib/voice/field-runtime/types";

export type RuntimeTurnInput = {
  workspaceId: string;
  agentId?: string;
  callId: string;
  utterance?: string | null;
  interpreted_intent?: string | null;
  extracted_information?: Record<string, unknown>;
  confirm?: boolean;
  workflow?: WorkflowAction;
  serviceName?: string | null;
};
