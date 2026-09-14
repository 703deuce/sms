import { loadLeadRecoveryState } from "@/lib/mctb/lead-recovery/state-store";
import type { LeadRecoveryActionId } from "@/lib/mctb/lead-recovery/types";

export type ProviderWriteCondition =
  | "STALE_DECISION"
  | "ACTION_INVALIDATED"
  | "CONFIRMATION_STALE"
  | "DUPLICATE_ACTION"
  | "STATE_VERSION_CONFLICT"
  | "POLICY_DENIED";

export type ProviderWriteAuthResult =
  | { ok: true; stateVersion: number; decisionStateVersion: number }
  | { ok: false; condition: ProviderWriteCondition; customerMessage: string };

export type ConsequentialMutation =
  | "CREATE_BOOKING"
  | "RESCHEDULE_BOOKING"
  | "CANCEL_BOOKING"
  | "CREATE_PAYMENT_REQUEST"
  | "CALLBACK_REQUEST"
  | "CRITICAL_NOTIFICATION";

const STALE_REPLY = "That request is no longer active. How can I help now?";
const CANCEL_REPLY = "Okay — I won't do that. What would you like instead?";
const DUPLICATE_REPLY = "We already handled that — you're all set.";
const POLICY_REPLY = "I can't do that right now. Our team can help if needed.";

function mapLegacyAction(action: LeadRecoveryActionId): ConsequentialMutation | null {
  switch (action) {
    case "AI_BOOK":
      return "CREATE_BOOKING";
    case "SEND_TEXT_TO_PAY":
      return "CREATE_PAYMENT_REQUEST";
    case "CREATE_CALLBACK_REQUEST":
      return "CALLBACK_REQUEST";
    case "SEND_OWNER_SMS":
    case "SEND_TEAM_SMS":
      return "CRITICAL_NOTIFICATION";
    default:
      return null;
  }
}

export async function preflightConsequentialAction(input: {
  workspaceId: string;
  conversationId: string;
  mutation: ConsequentialMutation;
  writeEpoch?: number;
  expectedStateVersion?: number;
  idempotencyKey?: string;
  policyAllows?: boolean;
}): Promise<ProviderWriteAuthResult> {
  const state = await loadLeadRecoveryState({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
  });

  if (input.policyAllows === false) {
    return { ok: false, condition: "POLICY_DENIED", customerMessage: POLICY_REPLY };
  }

  const currentVersion = state.stateVersion ?? 0;
  if (
    input.expectedStateVersion !== undefined &&
    input.expectedStateVersion !== currentVersion
  ) {
    return {
      ok: false,
      condition: "STATE_VERSION_CONFLICT",
      customerMessage: STALE_REPLY,
    };
  }

  const pendingEpoch = state.pendingActionEpoch ?? 0;
  const writeEpoch = input.writeEpoch;

  if (writeEpoch !== undefined) {
    const epochValid =
      writeEpoch === pendingEpoch ||
      writeEpoch === currentVersion ||
      (state.pendingAction?.epoch === writeEpoch);
    if (!epochValid) {
      return {
        ok: false,
        condition: "STALE_DECISION",
        customerMessage: STALE_REPLY,
      };
    }
    if (!state.pendingAction && writeEpoch !== currentVersion) {
      return {
        ok: false,
        condition: "ACTION_INVALIDATED",
        customerMessage: CANCEL_REPLY,
      };
    }
    if (
      state.pendingAction &&
      state.pendingAction.epoch !== writeEpoch &&
      writeEpoch !== currentVersion
    ) {
      return {
        ok: false,
        condition: "ACTION_INVALIDATED",
        customerMessage: CANCEL_REPLY,
      };
    }
  }

  if (input.idempotencyKey && state.processedActionKeys?.includes(input.idempotencyKey)) {
    return {
      ok: false,
      condition: "DUPLICATE_ACTION",
      customerMessage: DUPLICATE_REPLY,
    };
  }

  return {
    ok: true,
    stateVersion: currentVersion,
    decisionStateVersion: pendingEpoch,
  };
}

/** @deprecated use preflightConsequentialAction */
export async function authorizeProviderWrite(input: {
  workspaceId: string;
  conversationId: string;
  action: LeadRecoveryActionId;
  writeEpoch: number;
}): Promise<
  | { ok: true; stateVersion: number }
  | { ok: false; reason: "stale" | "cancelled"; customerMessage: string }
> {
  const mutation = mapLegacyAction(input.action);
  if (!mutation) {
    return { ok: true, stateVersion: 0 };
  }
  const pre = await preflightConsequentialAction({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    mutation,
    writeEpoch: input.writeEpoch,
  });
  if (!pre.ok) {
    const reason =
      pre.condition === "ACTION_INVALIDATED" ? "cancelled" : "stale";
    return { ok: false, reason, customerMessage: pre.customerMessage };
  }
  return { ok: true, stateVersion: pre.stateVersion };
}
