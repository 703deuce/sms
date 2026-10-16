import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { deriveLeadRecoveryPolicyFromWizard } from "@/lib/voice/runtime/wizard-policy-bridge";
import { isAfterHoursVoiceProfile } from "@/lib/voice/runtime/voice-profile";
import { buildAfterHoursV1WorkflowSection } from "./after-hours-v1";

/** Channel-specific + capability policy rendered for the prompt (aligned with LR policy engine). */
export function buildWorkspacePolicyContext(state: AppointmentReceptionistWizardState): string {
  const caps = state.capabilities;
  const lines: string[] = [];

  lines.push(`Capabilities enabled: ${caps.length ? caps.join(", ") : "none"}.`);
  lines.push(`Answer when: ${state.answerWhen.replaceAll("_", " ")}.`);

  const afterHours = isAfterHoursVoiceProfile(state);
  const booking = !caps.includes("book_appointments")
    ? "scheduling outcomes disabled — capture message and callback only"
    : afterHours
      ? "after-hours V1 — booking link by SMS when configured (no calendar on the call)"
      : state.calendarConnected
        ? "AI booking when runtime permits scheduling tools"
        : "booking link or callback — no live calendar unless connected";
  lines.push(`Booking mode: ${booking}.`);

  if (caps.includes("transfer_calls")) {
    lines.push(
      `Transfer: ${state.transferDestinationPhone?.trim() ? "configured — runtime resolves destination" : "enabled but destination missing — take message instead"}.`,
    );
  } else {
    lines.push("Transfer: disabled.");
  }

  lines.push(
    `Confirm before booking: ${state.bookingBehavior.confirmBeforeBooking ? "yes" : "no"}.`,
  );
  lines.push(
    `SMS after booking: ${state.bookingBehavior.sendSmsAfterBooking || caps.includes("send_sms_confirmations") ? "yes" : "no"}.`,
  );
  lines.push(`Fallback on failure: ${state.transferFallback.replaceAll("_", " ")}.`);

  const lrPolicy = deriveLeadRecoveryPolicyFromWizard(state);
  const emergencyActions =
    lrPolicy.intentPolicies.EMERGENCY_OR_URGENT?.actions?.join(", ") || "notify per policy";
  lines.push(`Emergency policy actions: ${emergencyActions}.`);
  const bookingActions =
    lrPolicy.intentPolicies.BOOKING_REQUEST?.actions?.join(", ") || "capture message";
  lines.push(`Booking request policy: ${bookingActions}.`);

  const v1 = buildAfterHoursV1WorkflowSection(state);
  if (v1) lines.push("", v1);

  return lines.join("\n");
}

export function buildVoiceBehaviorRules(state: AppointmentReceptionistWizardState): string {
  const lines: string[] = [];
  lines.push(`Tone: ${state.tone}. Speaking style: ${state.speakingStyle}.`);
  lines.push(`Primary language: ${state.language}.`);
  lines.push("- Keep answers brief.");
  lines.push("- Ask one question at a time.");
  lines.push("- Confirm names, numbers, dates, and addresses.");
  lines.push("- Never invent pricing.");
  lines.push("- Never invent availability.");
  for (const g of state.guardrails || []) lines.push(`- ${g}`);
  return lines.join("\n");
}

export function buildEnabledCapabilitiesSection(
  state: AppointmentReceptionistWizardState,
  runtimeCaps?: string[],
): string {
  if (runtimeCaps?.length) {
    return `Currently allowed actions (runtime): ${runtimeCaps.join(", ")}.`;
  }
  const caps = state.capabilities;
  const afterHours = isAfterHoursVoiceProfile(state);
  const actions: string[] = ["take message", "end call"];
  if (caps.includes("answer_questions")) actions.push("answer approved business questions from context");
  if (caps.includes("book_appointments")) {
    actions.push(
      afterHours
        ? "send configured booking link by SMS after verbal consent (no calendar booking)"
        : "scheduling tools when workflow permits",
    );
  }
  if (caps.includes("transfer_calls")) actions.push("request human transfer when policy allows");
  if (caps.includes("send_sms_confirmations") || (afterHours && caps.includes("book_appointments"))) {
    actions.push("text approved links to the caller when policy allows");
  }
  actions.push("callback requests and business notification when policy allows");
  return `Configured capabilities: ${actions.join("; ")}.`;
}
