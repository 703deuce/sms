import type { RealEstateCallState, RealEstateIntent } from "./types";

/** Production pipeline stage — distinct from legacy leadStatus on call state. */
export type RealEstatePipelineStage =
  | "new_lead"
  | "attempting_contact"
  | "connected"
  | "qualifying"
  | "qualified"
  | "appointment_set"
  | "transfer_requested"
  | "needs_human"
  | "nurture"
  | "not_interested"
  | "opt_out";

export type RealEstateCallDisposition =
  | "human_answered"
  | "voicemail"
  | "no_answer"
  | "busy"
  | "carrier_failure"
  | "invalid_number"
  | "dnc"
  | "disconnected"
  | "wrong_person";

export type RealEstateLeadOutcome =
  | "verified_lead"
  | "wrong_info"
  | "accidental_submission"
  | "duplicate"
  | "spam_bot_suspected"
  | "no_interest"
  | "callback_scheduled"
  | "transfer_failed"
  | "needs_attention";

export type RealEstatePolicyFlags = {
  buyer: boolean;
  seller: boolean;
  buyerAndSeller: boolean;
  represented: boolean;
  existingClient: boolean;
  outsideAgent: boolean;
  specificProperty: boolean;
  callbackScheduled: boolean;
  humanEngaged: boolean;
  automationPaused: boolean;
  optOut: boolean;
  dnc: boolean;
  currentlyListed: boolean;
  inboundCallback: boolean;
  outboundAttemptPending: boolean;
};

export type RealEstateLeadPolicy = {
  pipelineStage: RealEstatePipelineStage;
  flags: RealEstatePolicyFlags;
  disposition?: RealEstateCallDisposition;
  outcome?: RealEstateLeadOutcome;
  qualificationComplete: boolean;
  intentStrength: "unknown" | "weak" | "moderate" | "strong";
  callbackAt?: string;
  needsAttentionReason?: string;
  fieldHistory: Record<string, string[]>;
  updatedAt: string;
};

export type RealEstatePolicyAction =
  | "place_outbound_call"
  | "continue_automation"
  | "mark_appointment_booked"
  | "mark_transfer_successful"
  | "advance_pipeline"
  | "restart_qualification_field"
  | "create_duplicate_outbound_job"
  | "run_inbound_and_outbound_simultaneously"
  | "answer_unverified_property_fact";

const TERMINAL_STAGES: ReadonlySet<RealEstatePipelineStage> = new Set([
  "opt_out",
  "not_interested",
  "appointment_set",
]);

const VALID_PIPELINE_TRANSITIONS: Record<RealEstatePipelineStage, RealEstatePipelineStage[]> = {
  new_lead: ["attempting_contact", "connected", "qualifying", "needs_human", "opt_out", "not_interested"],
  attempting_contact: ["connected", "needs_human", "nurture", "not_interested", "opt_out"],
  connected: ["qualifying", "needs_human", "nurture", "not_interested", "opt_out"],
  qualifying: ["qualified", "needs_human", "nurture", "not_interested", "opt_out"],
  qualified: ["appointment_set", "transfer_requested", "needs_human", "nurture"],
  appointment_set: ["needs_human", "nurture"],
  transfer_requested: ["needs_human", "appointment_set"],
  needs_human: ["qualifying", "qualified", "nurture", "not_interested", "opt_out"],
  nurture: ["attempting_contact", "qualifying", "not_interested", "opt_out"],
  not_interested: [],
  opt_out: [],
};

export function createInitialLeadPolicy(): RealEstateLeadPolicy {
  return {
    pipelineStage: "new_lead",
    flags: {
      buyer: false,
      seller: false,
      buyerAndSeller: false,
      represented: false,
      existingClient: false,
      outsideAgent: false,
      specificProperty: false,
      callbackScheduled: false,
      humanEngaged: false,
      automationPaused: false,
      optOut: false,
      dnc: false,
      currentlyListed: false,
      inboundCallback: false,
      outboundAttemptPending: false,
    },
    qualificationComplete: false,
    intentStrength: "unknown",
    fieldHistory: {},
    updatedAt: new Date().toISOString(),
  };
}

export function mergePolicyFromCallState(
  policy: RealEstateLeadPolicy,
  callState: RealEstateCallState,
): RealEstateLeadPolicy {
  const intents = [
    callState.primaryIntent,
    ...callState.secondaryIntents,
  ].filter(Boolean) as RealEstateIntent[];

  const buyer = intents.includes("buyer");
  const seller = intents.includes("seller");
  const next: RealEstateLeadPolicy = {
    ...policy,
    flags: {
      ...policy.flags,
      buyer,
      seller,
      buyerAndSeller: buyer && seller,
      existingClient: intents.includes("existing_client") || callState.callerType === "existing_client",
      outsideAgent: intents.includes("agent_to_agent") || callState.callerType === "agent",
      specificProperty: intents.includes("showing"),
    },
    qualificationComplete: Boolean(callState.intakeComplete),
    updatedAt: new Date().toISOString(),
  };

  if (callState.leadStatus === "appointment_booked") {
    next.pipelineStage = "appointment_set";
  } else if (callState.leadStatus === "transferred") {
    next.pipelineStage = "transfer_requested";
  } else if (callState.leadStatus === "not_interested") {
    next.pipelineStage = "not_interested";
  } else if (callState.leadStatus === "qualified" || callState.intakeComplete) {
    next.pipelineStage = "qualified";
  } else if (callState.leadStatus === "intake_in_progress") {
    next.pipelineStage = "qualifying";
  }

  return next;
}

export function recordPolicyField(
  policy: RealEstateLeadPolicy,
  fieldId: string,
  value: string,
): RealEstateLeadPolicy {
  const trimmed = value.trim();
  if (!trimmed) return policy;
  const history = policy.fieldHistory[fieldId] || [];
  const nextHistory =
    history[history.length - 1] === trimmed ? history : [...history, trimmed];
  return {
    ...policy,
    fieldHistory: { ...policy.fieldHistory, [fieldId]: nextHistory },
    updatedAt: new Date().toISOString(),
  };
}

export function applyPolicyEvent(
  policy: RealEstateLeadPolicy,
  event: {
    type: string;
    payload?: Record<string, unknown>;
  },
): RealEstateLeadPolicy {
  const next = { ...policy, flags: { ...policy.flags }, updatedAt: new Date().toISOString() };

  switch (event.type) {
    case "human_engaged":
      next.flags.humanEngaged = true;
      next.flags.automationPaused = true;
      break;
    case "opt_out":
      next.flags.optOut = true;
      next.flags.dnc = true;
      next.flags.automationPaused = true;
      next.pipelineStage = "opt_out";
      next.outcome = "no_interest";
      break;
    case "not_interested_now":
      next.pipelineStage = "nurture";
      next.outcome = "no_interest";
      break;
    case "callback_scheduled":
      next.flags.callbackScheduled = true;
      next.callbackAt = String(event.payload?.callbackAt || "");
      next.outcome = "callback_scheduled";
      next.pipelineStage = "needs_human";
      break;
    case "transfer_failed":
      next.pipelineStage = "needs_human";
      next.outcome = "transfer_failed";
      next.needsAttentionReason = "requested_live_handoff_transfer_failed";
      break;
    case "represented":
      next.flags.represented = true;
      next.flags.automationPaused = true;
      next.pipelineStage = "needs_human";
      break;
    case "currently_listed":
      next.flags.currentlyListed = true;
      next.pipelineStage = "needs_human";
      break;
    case "wrong_person":
      next.disposition = "wrong_person";
      next.pipelineStage = "needs_human";
      break;
    case "never_submitted":
      next.outcome = "accidental_submission";
      next.pipelineStage = "not_interested";
      break;
    case "spam_suspected":
      next.outcome = "spam_bot_suspected";
      next.pipelineStage = "not_interested";
      break;
    case "inbound_callback":
      next.flags.inboundCallback = true;
      next.flags.outboundAttemptPending = false;
      break;
    case "outbound_attempt_queued":
      next.flags.outboundAttemptPending = true;
      next.pipelineStage = "attempting_contact";
      break;
    case "appointment_confirmed":
      next.pipelineStage = "appointment_set";
      next.flags.automationPaused = true;
      break;
    default:
      break;
  }

  return next;
}

export type PolicyInvariantResult = { allowed: true } | { allowed: false; reason: string };

export function checkPolicyInvariant(
  policy: RealEstateLeadPolicy,
  action: RealEstatePolicyAction,
  context: Record<string, unknown> = {},
): PolicyInvariantResult {
  if (policy.flags.optOut || policy.flags.dnc) {
    if (action === "place_outbound_call" || action === "continue_automation") {
      return { allowed: false, reason: "Lead has opted out or is on DNC." };
    }
  }

  if (policy.flags.humanEngaged && action === "continue_automation") {
    return { allowed: false, reason: "Automation paused while human is engaged." };
  }

  if (policy.flags.automationPaused && action === "continue_automation") {
    return { allowed: false, reason: "Automation explicitly paused." };
  }

  if (action === "mark_appointment_booked" && !context.providerReceiptConfirmed) {
    return { allowed: false, reason: "Appointment not confirmed by provider receipt." };
  }

  if (action === "mark_transfer_successful" && !context.transferConnected) {
    return { allowed: false, reason: "Transfer not connected." };
  }

  if (action === "create_duplicate_outbound_job" && policy.flags.outboundAttemptPending) {
    return { allowed: false, reason: "Outbound job already pending for this lead." };
  }

  if (
    action === "run_inbound_and_outbound_simultaneously" &&
    policy.flags.inboundCallback &&
    policy.flags.outboundAttemptPending
  ) {
    return { allowed: false, reason: "Cancel queued outbound when inbound callback is active." };
  }

  if (action === "answer_unverified_property_fact" && !context.authoritativePropertyData) {
    return { allowed: false, reason: "Cannot state unverified property facts as truth." };
  }

  if (action === "advance_pipeline") {
    const from = policy.pipelineStage;
    const to = context.to as RealEstatePipelineStage;
    if (!to || !canAdvancePipeline(from, to)) {
      return { allowed: false, reason: `Invalid pipeline transition ${from} → ${to}` };
    }
    if (to === "qualified" && !policy.qualificationComplete && !context.force) {
      return {
        allowed: false,
        reason: "Qualification completeness is separate from intent strength.",
      };
    }
  }

  if (action === "restart_qualification_field") {
    const fieldId = String(context.fieldId || "");
    if (fieldId && policy.fieldHistory[fieldId]?.length) {
      return { allowed: false, reason: `Field ${fieldId} already collected — update instead of restart.` };
    }
  }

  return { allowed: true };
}

export function canAdvancePipeline(
  from: RealEstatePipelineStage,
  to: RealEstatePipelineStage,
): boolean {
  if (from === to) return true;
  if (TERMINAL_STAGES.has(from) && to !== from) return false;
  const allowed = VALID_PIPELINE_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

/** Server-side guard before outbound dial or automation step. */
export function assertPolicyAllows(
  policy: RealEstateLeadPolicy,
  action: RealEstatePolicyAction,
  context?: Record<string, unknown>,
): void {
  const result = checkPolicyInvariant(policy, action, context);
  if (!result.allowed) {
    throw new Error(`[re-policy] ${action} blocked: ${result.reason}`);
  }
}

export const REAL_ESTATE_POLICY_INVARIANTS = [
  "Never call when explicit opt-out/DNC is active.",
  "Never continue the new-lead sequence after human_engaged unless configured.",
  "Never mark appointment until provider receipt confirms.",
  "Never mark transfer successful until transfer actually connects.",
  "Never advance pipeline merely because an AI attempt occurred.",
  "Never restart qualification for fields already collected.",
  "Never create a second active outbound job for the same lead.",
  "Never allow an inbound callback and queued outbound call to run simultaneously.",
  "Never let a CRM failure erase locally captured qualification.",
  "Never answer unsupported property-specific facts as verified truth.",
] as const;
