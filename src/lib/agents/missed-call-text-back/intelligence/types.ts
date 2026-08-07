/**
 * John MCTB agent intelligence — runtime types.
 */

export type JohnRuntimeId = "customer_john" | "mctb_workflow_architect";

export type JohnConversationState =
  | "WAITING_FOR_REPLY"
  | "CUSTOMER_REPLIED"
  | "CUSTOMER_ASSISTANCE"
  | "COLLECTING_FIELD"
  | "ESCALATED"
  | "ENDED";

export type JohnRuntimeContext = {
  workspace_id: string;
  agent_id: "john";
  conversation_id: string;
  workflow_id: string;
  workflow_version: number;
  state: JohnConversationState;
  customer: {
    phone: string;
    name: string | null;
  };
  trigger?: {
    type: "MISSED_CALL";
    call_id: string;
    missed_at: string;
  };
  known_information: Record<string, unknown>;
  required_information: Array<{
    field_id: string;
    label: string;
    type: string;
  }>;
  next_action: string;
  business_context: {
    business_name: string;
    hours?: string;
    timezone: string;
  };
};

export type JohnRuntimeTurnInput = {
  utterance: string;
  interpreted_intent?: string;
  extracted_information?: Record<string, unknown>;
};

export type JohnRuntimeTurnResult = {
  success: boolean;
  state: JohnConversationState;
  action: string;
  response_context: Record<string, unknown>;
  error?: string;
};

export type JohnAgentTurnRecord = {
  conversationId: string;
  direction: "inbound" | "outbound";
  messageBody: string;
  modelProvider?: string;
  modelName?: string;
  modelRequestId?: string;
  runtimeAction?: string;
  runtimeResult?: unknown;
};

export type OwnerJohnSettingChange = {
  change_type:
    | "MCTB_DELAY_UPDATE"
    | "MCTB_MESSAGE_UPDATE"
    | "MCTB_ENABLED_UPDATE"
    | "MCTB_WORKFLOW_CHANGE"
    | "UNKNOWN";
  target_agent: "john";
  value?: unknown;
  delay_seconds?: number;
  initial_message?: string;
  enabled?: boolean;
  workflow_request?: string;
};
