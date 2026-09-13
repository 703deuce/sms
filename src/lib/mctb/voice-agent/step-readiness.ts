import { getWizardActivationIssues } from "@/lib/solutions/appointment-receptionist/capability-checklist";
import { hasBookingCapability } from "@/lib/solutions/appointment-receptionist/wizard-presets";
import type { AppointmentReceptionistWizardState, WizardStepId } from "@/lib/solutions/appointment-receptionist/types";

export type WizardStepStatus =
  | "COMPLETE"
  | "NEEDS_ATTENTION"
  | "INCOMPLETE"
  | "BLOCKED";

export type StepReadinessMap = Partial<Record<WizardStepId, WizardStepStatus>>;

export function computeMctbWizardStepReadiness(
  state: AppointmentReceptionistWizardState,
  ctx?: {
    hasCalendarConnection?: boolean;
    agentStatus?: "draft" | "active" | "needs_attention" | null;
  },
): StepReadinessMap {
  const issues = getWizardActivationIssues(state, {
    hasCalendarConnection: ctx?.hasCalendarConnection,
  });
  const blocking = new Set(issues.filter((i) => i.severity === "blocking").map((i) => i.id));
  const warnings = new Set(issues.filter((i) => i.severity === "warning").map((i) => i.id));

  const map: StepReadinessMap = {};

  const capsOk = state.capabilities.length > 0 && Boolean(state.answerWhen);
  map.goals = capsOk
    ? state.agentId
      ? "COMPLETE"
      : "INCOMPLETE"
    : "INCOMPLETE";

  map.phone = !state.phoneNumberId
    ? blocking.has("phone")
      ? "BLOCKED"
      : "INCOMPLETE"
    : warnings.has("recording_disclosure")
      ? "NEEDS_ATTENTION"
      : "COMPLETE";

  const knowledgeBlocking = blocking.has("knowledge") || blocking.has("business_name");
  const knowledgeWarn = warnings.has("business_name");
  map.information = knowledgeBlocking
    ? "BLOCKED"
    : knowledgeWarn
      ? "NEEDS_ATTENTION"
      : state.businessName?.trim() || state.knowledgeItems.some((k) => k.status === "complete")
        ? "COMPLETE"
        : "INCOMPLETE";

  if (hasBookingCapability(state.capabilities)) {
    const bookingBlock =
      blocking.has("calendar") || blocking.has("appointment_types");
    map.appointments = bookingBlock
      ? "BLOCKED"
      : state.calendarConnected
        ? "COMPLETE"
        : "NEEDS_ATTENTION";
  }

  map["call-handling"] = blocking.has("transfer")
    ? "BLOCKED"
    : state.transferTriggers.length || state.fallbackAction
      ? "COMPLETE"
      : "INCOMPLETE";

  map.voice =
    blocking.has("voice") || blocking.has("greeting") || blocking.has("agent_name")
      ? "BLOCKED"
      : state.voiceId && state.openingGreeting
        ? "COMPLETE"
        : "INCOMPLETE";

  map.test = state.lastTestPassed === true
    ? "COMPLETE"
    : blocking.has("test")
      ? "BLOCKED"
      : warnings.has("test")
        ? "NEEDS_ATTENTION"
        : "INCOMPLETE";

  const activateBlock = issues.some((i) => i.severity === "blocking");
  map.activate = ctx?.agentStatus === "active"
    ? "COMPLETE"
    : activateBlock
      ? "BLOCKED"
      : issues.length
        ? "NEEDS_ATTENTION"
        : "INCOMPLETE";

  return map;
}
