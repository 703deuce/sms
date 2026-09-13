import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import type { PreprodContext } from "@/lib/voice/testing/preprod-harness";

export type HeadlessFailureCode =
  | "EXPECTED_TOOL_NOT_CALLED"
  | "WRONG_TOOL_CALLED"
  | "TOOL_NOT_AVAILABLE_IN_STATE"
  | "TOOL_ARGUMENT_SCHEMA_INVALID"
  | "POLICY_DENIED_EXPECTED_ACTION"
  | "ACTION_EXECUTED_TWICE"
  | "TOOL_RESULT_NOT_SUCCESS"
  | "MODEL_CLAIMED_SUCCESS_BEFORE_TOOL_SUCCESS"
  | "FORBIDDEN_TOOL_CALLED"
  | "SMS_NOT_RECORDED"
  | "UNEXPECTED_SMS_COUNT";

export type HeadlessTurnTrace = {
  turn: number;
  caller: string;
  promptVersion?: string;
  businessContextRevision?: string;
  assistantText?: string;
  toolRequests: Array<{
    toolType: string;
    arguments: Record<string, unknown>;
    webhookStatus: number;
    webhookJson: Record<string, unknown>;
    policyAllowed?: boolean;
    latencyMs: number;
  }>;
  smsCountAfterTurn: number;
};

export type HeadlessFixtureContext = PreprodContext & {
  wizard: AppointmentReceptionistWizardState;
  systemPrompt: string;
  bookingLinkUrl: string;
  callerE164: string;
  conversationId: string;
  callControlId: string;
};

export type HeadlessScenarioResult = {
  name: string;
  passed: boolean;
  failures: Array<{ code: HeadlessFailureCode; detail: string }>;
  turns: HeadlessTurnTrace[];
  totalSms: number;
};
