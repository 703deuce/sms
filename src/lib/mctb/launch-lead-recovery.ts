import "server-only";

import { saveMctbHandoffConfig } from "@/lib/mctb/handoff/config";
import {
  loadLeadRecoveryConfig,
  saveLeadRecoveryConfig,
} from "@/lib/mctb/lead-recovery/config";
import { launchFaqIntentPolicyOverrides } from "@/lib/mctb/lead-recovery/launch-faq-policies";
import { defaultIntentPolicies } from "@/lib/mctb/lead-recovery/policy-defaults";
import { defaultLaunchEnabledScenarios } from "@/lib/mctb/lead-recovery/scenarios";
import type { LeadRecoveryWorkspaceConfig } from "@/lib/mctb/lead-recovery/types";

const LAUNCH_ACTION_CAPABILITIES: LeadRecoveryWorkspaceConfig["actionCapabilities"] = [
  "SEND_BOOKING_LINK",
  "CREATE_CALLBACK_REQUEST",
  "SEND_EMAIL_SUMMARY",
  "SEND_OWNER_SMS",
  "CUSTOMER_MESSAGE",
  "ANSWER_APPROVED_INFORMATION",
  "ESCALATE_HUMAN",
  "END_AUTOMATION",
  "SUPPRESS_CONTACT",
];

/** Simplified launch: inbound SMS uses Lead Recovery — not handoff responseMode alone. */
export async function applyLaunchAiRepliesSetting(
  workspaceId: string,
  enabled: boolean,
): Promise<{ enabled: boolean }> {
  if (!enabled) {
    await saveLeadRecoveryConfig(workspaceId, { enabled: false });
    await saveMctbHandoffConfig(workspaceId, {
      responseMode: "notify_only",
      bookingBehavior: "off",
    });
    return { enabled: false };
  }

  const policies = {
    ...defaultIntentPolicies("SEND_BOOKING_LINK"),
    ...launchFaqIntentPolicyOverrides(),
  };
  await saveLeadRecoveryConfig(workspaceId, {
    enabled: true,
    globalMode: "STANDARD",
    enabledScenarios: defaultLaunchEnabledScenarios(),
    intentPolicies: policies,
    actionCapabilities: LAUNCH_ACTION_CAPABILITIES,
    faqPolicy: {
      topics: ["HOURS", "SERVICES", "SERVICE_AREA", "FAQ"],
      fallback: "clarify",
    },
    globalBehavior: {
      tone: "professional",
      maxClarificationAttempts: 2,
      followUpEnabled: false,
    },
  });
  await saveMctbHandoffConfig(workspaceId, {
    responseMode: "ai_conversation",
    bookingBehavior: "on_request",
  });
  const after = await loadLeadRecoveryConfig(workspaceId);
  return { enabled: after.enabled };
}

export function launchBookingIntentActions(): string[] {
  const policies = defaultIntentPolicies("SEND_BOOKING_LINK");
  const booking = policies.BOOKING_REQUEST?.actions || [];
  return [...booking];
}
