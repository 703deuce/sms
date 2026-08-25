/**
 * Semantic policy validator — behavior invariants beyond structural graph checks.
 */

import type { WorkflowDraft } from "@/lib/agents/appointment-booking/workflow-validator";

export type SemanticValidationError = {
  nodeId?: string;
  code: string;
  message: string;
  level: "error" | "warning";
};

export function validateWorkflowSemantics(draft: WorkflowDraft): SemanticValidationError[] {
  const errors: SemanticValidationError[] = [];
  const types = new Set(draft.nodes.map((n) => n.type));
  const hasCreate = types.has("create_appointment");
  const hasConfirm = types.has("confirm_field");
  const hasAvailability = types.has("check_availability");
  const hasHold = types.has("hold_appointment_slot");
  const hasSms = types.has("send_confirmation_sms") || types.has("send_booking_link");
  const hasTransfer = types.has("transfer_call");
  const hasFallbackTransfer = types.has("use_fallback_transfer") || types.has("take_message");

  if (hasCreate && !hasConfirm) {
    errors.push({
      code: "booking_without_confirmation",
      message: "create_appointment requires confirm_field before booking.",
      level: "error",
    });
  }

  if (hasCreate && !hasAvailability) {
    errors.push({
      code: "booking_without_availability",
      message: "create_appointment requires check_availability in the graph.",
      level: "error",
    });
  }

  if (hasHold && hasCreate) {
    const holdIdx = draft.nodes.findIndex((n) => n.type === "hold_appointment_slot");
    const createIdx = draft.nodes.findIndex((n) => n.type === "create_appointment");
    if (holdIdx >= 0 && createIdx >= 0 && holdIdx > createIdx) {
      errors.push({
        nodeId: draft.nodes[createIdx].id,
        code: "hold_after_create",
        message: "hold_appointment_slot must precede create_appointment.",
        level: "error",
      });
    }
  }

  if (hasSms && types.has("send_confirmation_sms") && !hasCreate) {
    errors.push({
      code: "sms_without_booking",
      message: "send_confirmation_sms requires a verified booking path.",
      level: "error",
    });
  }

  if (hasTransfer && !hasFallbackTransfer) {
    errors.push({
      code: "transfer_without_fallback",
      message: "transfer_call requires fallback transfer or take_message path.",
      level: "error",
    });
  }

  const delayNodes = draft.nodes.filter((n) => n.type === "delay");
  for (const d of delayNodes) {
    const minutes = Number(d.config.delayMinutes ?? d.config.delay_minutes ?? 0);
    if (!Number.isFinite(minutes) || minutes < 1) {
      errors.push({
        nodeId: d.id,
        code: "invalid_delay",
        message: "delay node requires delayMinutes >= 1.",
        level: "error",
      });
    }
    const hasFollowUp =
      types.has("send_booking_link") ||
      draft.edges.some((e) => e.fromNodeId === d.id);
    if (!hasFollowUp) {
      errors.push({
        nodeId: d.id,
        code: "delay_without_followup",
        message: "delay node must connect to a follow-up action.",
        level: "warning",
      });
    }
  }

  const offer = draft.nodes.find((n) => n.type === "offer_slots");
  if (offer) {
    const maxSlots = Number(offer.config.maxSlots ?? offer.config.max_slots ?? 3);
    if (maxSlots > 3) {
      errors.push({
        nodeId: offer.id,
        code: "too_many_slots",
        message: "offer_slots may offer at most three slots.",
        level: "error",
      });
    }
  }

  return errors;
}

export function semanticErrorsBlockDraft(errors: SemanticValidationError[]): boolean {
  return errors.some((e) => e.level === "error");
}
