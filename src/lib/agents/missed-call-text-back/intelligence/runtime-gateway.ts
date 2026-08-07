/**
 * John runtime gateway — deterministic state + actions.
 * LLM proposes meaning; runtime is authoritative.
 */

import type {
  JohnConversationState,
  JohnRuntimeContext,
  JohnRuntimeTurnInput,
  JohnRuntimeTurnResult,
} from "./types";

const FIELD_ALIASES: Record<string, string[]> = {
  fld_reason: ["reason_for_call", "reason", "call_reason", "issue", "problem"],
  fld_name: ["name", "customer_name", "caller_name"],
  fld_callback: ["callback_reason", "callback", "callback_time"],
};

function normalizeFieldKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9_]/g, "_");
}

function matchExtractedToField(
  fieldId: string,
  extracted: Record<string, unknown>,
): unknown {
  const keys = [fieldId, ...(FIELD_ALIASES[fieldId] || [])];
  for (const k of keys) {
    const nk = normalizeFieldKey(k);
    for (const [ek, ev] of Object.entries(extracted)) {
      if (normalizeFieldKey(ek) === nk && ev != null && String(ev).trim()) {
        return ev;
      }
    }
  }
  return undefined;
}

export function executeJohnRuntimeTurn(input: {
  context: JohnRuntimeContext;
  turn: JohnRuntimeTurnInput;
}): JohnRuntimeTurnResult {
  const ctx = input.context;
  const extracted = input.turn.extracted_information || {};
  const known = { ...ctx.known_information };
  let state: JohnConversationState = ctx.state;
  let action = ctx.next_action;
  const responseContext: Record<string, unknown> = {};

  // Record fields deterministically from LLM proposal (not trusted as authority for state transitions)
  for (const req of ctx.required_information) {
    const val = matchExtractedToField(req.field_id, extracted);
    if (val !== undefined) {
      known[req.field_id] = val;
      responseContext[`${req.field_id}_saved`] = true;
      if (req.field_id === "fld_reason") {
        responseContext.reason_saved = true;
      }
    }
  }

  // Also accept generic reason extraction
  if (!known.fld_reason && extracted.reason_for_call) {
    known.fld_reason = extracted.reason_for_call;
    responseContext.reason_saved = true;
  }

  const stillRequired = ctx.required_information.filter(
    (f) => known[f.field_id] == null || String(known[f.field_id]).trim() === "",
  );

  if (stillRequired.length === 0 && ctx.required_information.length > 0) {
    state = "CUSTOMER_ASSISTANCE";
    action = "RESPOND_TO_CUSTOMER";
    responseContext.all_required_collected = true;
  } else if (stillRequired.length > 0) {
    state = "COLLECTING_FIELD";
    action = "CONTINUE_CONVERSATION";
    responseContext.active_field = stillRequired[0].field_id;
    responseContext.active_field_label = stillRequired[0].label;
  } else {
    state = "CUSTOMER_ASSISTANCE";
    action = "RESPOND_TO_CUSTOMER";
  }

  // Escalation intent proposal
  const intent = (input.turn.interpreted_intent || "").toLowerCase();
  if (/escalat|human|person|manager|urgent|emergency/.test(intent)) {
    responseContext.escalation_requested = true;
    action = "ESCALATE_HUMAN";
    state = "ESCALATED";
  }

  return {
    success: true,
    state,
    action,
    response_context: {
      ...responseContext,
      known_information: known,
      still_required: stillRequired.map((f) => f.field_id),
    },
  };
}

export function buildJohnRuntimeContext(input: {
  workspaceId: string;
  conversationId: string;
  customerPhone: string;
  customerName?: string | null;
  missedCallEventId: string;
  missedAt: Date;
  state?: JohnConversationState;
  knownInformation?: Record<string, unknown>;
  businessName?: string;
  timezone?: string;
}): JohnRuntimeContext {
  const known = input.knownInformation || {};
  const required: JohnRuntimeContext["required_information"] = [];

  if (!known.fld_reason) {
    required.push({
      field_id: "fld_reason",
      label: "Reason for call",
      type: "long_text",
    });
  }

  return {
    workspace_id: input.workspaceId,
    agent_id: "john",
    conversation_id: input.conversationId,
    workflow_id: "mctb_default",
    workflow_version: 1,
    state: input.state || "CUSTOMER_REPLIED",
    customer: {
      phone: input.customerPhone,
      name: input.customerName || null,
    },
    trigger: {
      type: "MISSED_CALL",
      call_id: input.missedCallEventId,
      missed_at: input.missedAt.toISOString(),
    },
    known_information: known,
    required_information: required,
    next_action: required.length ? "CONTINUE_CONVERSATION" : "RESPOND_TO_CUSTOMER",
    business_context: {
      business_name: input.businessName || "the business",
      timezone: input.timezone || "America/New_York",
    },
  };
}
