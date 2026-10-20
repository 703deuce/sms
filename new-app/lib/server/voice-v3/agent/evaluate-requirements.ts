import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceV3CallContext } from "../state/call-context";
import type { VoiceV3RuleEvaluation } from "../state/call-rules";
import { resolveStoredIntakeField } from "../intake-objective/resolve-stored-intake";

export interface RequirementsEvaluation {
  known: string[];
  missing: string[];
  schedulingStatus: string;
  availabilityStatus: string;
  appointmentStatus: string;
}

export function evaluateRequirements(
  ctx: VoiceV3CallContext,
  rules: VoiceV3RuleEvaluation,
  _config: VoiceV3AgentConfig,
): RequirementsEvaluation {
  const knownSet = new Set<string>();
  for (const f of _config.intakeFields) {
    if (resolveStoredIntakeField(ctx.intake.values, f.key)) {
      knownSet.add(f.key);
    }
  }
  for (const [k, row] of Object.entries(ctx.intake.values)) {
    if (row?.value?.trim()) knownSet.add(k);
  }
  const known = [...knownSet];

  let schedulingStatus = "none";
  if (rules.schedulingRequiresClarification) schedulingStatus = "clarification_required";
  else if (rules.hasSchedulingPreference) schedulingStatus = "ready";
  else if (ctx.scheduling.meaning) schedulingStatus = "partial";

  const availabilityStatus = ctx.availability.status;
  let appointmentStatus = "none";
  if (ctx.booking.phase === "BOOKING_CONFIRMED") appointmentStatus = "booked";
  else if (ctx.appointmentManagement.verifiedExisting) appointmentStatus = "identified";
  else if (ctx.appointmentManagement.lookupCompleted) appointmentStatus = "lookup_done";

  return {
    known,
    missing: rules.missingRequiredFields,
    schedulingStatus,
    availabilityStatus,
    appointmentStatus,
  };
}
