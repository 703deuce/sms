import "server-only";

import type { LeadRecoveryWorkspaceConfig } from "@/lib/mctb/lead-recovery/types";
import { LEAD_RECOVERY_SCENARIO_DEFS } from "@/lib/mctb/lead-recovery/scenarios";
import { computeLeadRecoveryV1PolicyHealth } from "@/lib/mctb/lead-recovery/v1-policy-health";
import type { MctbOverviewPayload } from "@/lib/mctb/overview-types";

/**
 * V1 MCTB Overview AI Recovery card — persisted config + Send Booking Link checks only.
 * Does not invoke direct-calendar (AI_BOOK) provider readiness or Microsoft/Calendly audits.
 */
export async function buildMctbOverviewLeadRecoveryCard(
  workspaceId: string,
  lrConfig: LeadRecoveryWorkspaceConfig,
): Promise<MctbOverviewPayload["leadRecovery"]> {
  const scenarios = lrConfig.enabledScenarios ?? {};
  const activePolicies = LEAD_RECOVERY_SCENARIO_DEFS.filter((d) => scenarios[d.key]);
  const policySummary = activePolicies.map((d) => d.title.split(" ")[0]).slice(0, 4).join(" · ");

  if (!lrConfig.enabled) {
    return {
      enabled: false,
      activePolicyCount: activePolicies.length,
      policySummary: policySummary || "No policies",
      status: "disabled",
      statusLabel: "Disabled",
      attentionReason: null,
      attentionHref: null,
    };
  }

  const v1Health = await computeLeadRecoveryV1PolicyHealth(workspaceId, lrConfig);
  let lrStatus: "ready" | "needs_attention" =
    v1Health.overall === "NEEDS_CONFIGURATION" || v1Health.overall === "PROVIDER_BLOCKED"
      ? "needs_attention"
      : "ready";
  let attentionReason: string | null = null;
  let attentionHref: string | null = null;
  if (lrStatus === "needs_attention") {
    if (v1Health.providers.booking === "NEEDS_CONFIGURATION") {
      attentionReason = "Add a booking link for Send Booking Link recovery";
      attentionHref = "/mctb/ai-recovery";
    } else if (v1Health.scenarioHealth.emergencies === "NEEDS_CONFIGURATION") {
      attentionReason = "Choose an on-call recipient for emergencies";
      attentionHref = "/mctb/ai-recovery";
    } else {
      attentionReason = "One or more policies need configuration";
      attentionHref = "/mctb/ai-recovery";
    }
  }

  return {
    enabled: true,
    activePolicyCount: activePolicies.length,
    policySummary: policySummary || "No policies",
    status: lrStatus,
    statusLabel: lrStatus === "ready" ? "Ready" : "Needs attention",
    attentionReason,
    attentionHref,
  };
}
