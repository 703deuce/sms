import type { MctbTimelineStep } from "@/lib/mctb/timeline";
import { formatRecoveryStatus } from "@/lib/mctb/recovery-display";

export type MissedCallLifecycleMilestone = {
  at: string | null;
  label: string;
  detail: string;
};

export function buildMissedCallLifecycleMilestones(input: {
  detectedAt: string | null;
  smsSentAt: string | null;
  status: string;
  suppressionReason: string | null;
  consentCapturedAt: string | null;
  consentMode: string;
  timelineSteps: MctbTimelineStep[];
  automationState?: string | null;
}): MissedCallLifecycleMilestone[] {
  const milestones: MissedCallLifecycleMilestone[] = [];

  if (input.detectedAt) {
    milestones.push({
      at: input.detectedAt,
      label: "Call missed",
      detail: "Forwarded to Transovo",
    });
  }

  const consentStep = input.timelineSteps.find((s) => s.id === "consent_recorded" || s.id === "press_1");
  if (input.consentMode === "press_1" || input.consentMode === "verified") {
    if (input.consentCapturedAt) {
      milestones.push({
        at: input.consentCapturedAt,
        label: "Caller pressed 1",
        detail: "Consent captured",
      });
    } else if (consentStep?.status === "skipped") {
      milestones.push({
        at: consentStep.at,
        label: "Press-1 not captured",
        detail: "No recovery consent on this call",
      });
    }
  }

  if (input.smsSentAt) {
    milestones.push({
      at: input.smsSentAt,
      label: "Recovery text sent",
      detail: formatRecoveryStatus(input.status, input.suppressionReason),
    });
  } else if (input.status.toUpperCase() === "SUPPRESSED" || input.status.toUpperCase() === "FAILED") {
    milestones.push({
      at: input.detectedAt,
      label: "Recovery text not sent",
      detail: formatRecoveryStatus(input.status, input.suppressionReason),
    });
  }

  const replyInbound = input.timelineSteps.find((s) => s.label.toLowerCase().includes("reply"));
  if (input.status.toUpperCase() === "CUSTOMER_REPLIED") {
    milestones.push({
      at: replyInbound?.at || input.smsSentAt,
      label: "Customer replied",
      detail: "Conversation started",
    });
  }

  const automation = (input.automationState || "").toLowerCase();
  if (automation === "callback_requested") {
    milestones.push({
      at: null,
      label: "Callback requested",
      detail: "Business notified",
    });
  }
  if (automation === "human_active") {
    milestones.push({
      at: null,
      label: "Human handling",
      detail: "Team took over the conversation",
    });
  }

  return milestones.filter((m) => m.label);
}
