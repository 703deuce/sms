import "server-only";

import { getPrisma } from "@/lib/db";
import type { IntentPolicyShape, LeadRecoveryWorkspaceConfig } from "@/lib/mctb/lead-recovery/types";
import { LEAD_RECOVERY_SCENARIO_DEFS } from "@/lib/mctb/lead-recovery/scenarios";
import type { MctbOverviewPayload } from "@/lib/mctb/overview-types";

function policyUsesBookingLink(policy?: IntentPolicyShape): boolean {
  return Boolean(policy?.actions?.includes("SEND_BOOKING_LINK"));
}

function policyUsesOnCall(policy?: IntentPolicyShape): boolean {
  return Boolean(policy?.actions?.includes("ROUTE_TO_ON_CALL"));
}

async function sendBookingLinkResolvable(
  workspaceId: string,
  config: LeadRecoveryWorkspaceConfig,
): Promise<boolean> {
  const prisma = getPrisma();
  if (config.bookingLinkId) {
    const row = await prisma.mctbBookingLink.findFirst({
      where: { workspaceId, id: config.bookingLinkId, active: true },
      select: { id: true, url: true },
    });
    if (row?.url) return true;
  }
  const linkCount = await prisma.mctbBookingLink.count({
    where: { workspaceId, active: true },
  });
  return linkCount > 0;
}

/**
 * V1 MCTB Overview AI Recovery card — persisted config + Send Booking Link checks only.
 * Does not invoke direct-calendar (AI_BOOK) provider readiness or Microsoft/Calendly audits.
 */
export async function buildMctbOverviewLeadRecoveryCard(
  workspaceId: string,
  lrConfig: LeadRecoveryWorkspaceConfig,
): Promise<MctbOverviewPayload["leadRecovery"]> {
  const activePolicies = LEAD_RECOVERY_SCENARIO_DEFS.filter((d) => lrConfig.enabledScenarios[d.key]);
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

  let lrStatus: "ready" | "needs_attention" = "ready";
  let attentionReason: string | null = null;
  let attentionHref: string | null = null;

  const bookingPolicy = lrConfig.intentPolicies.BOOKING_REQUEST;
  const bookingScenarioOn = Boolean(lrConfig.enabledScenarios.booking);

  if (bookingScenarioOn && policyUsesBookingLink(bookingPolicy)) {
    const linkOk = await sendBookingLinkResolvable(workspaceId, lrConfig);
    if (!linkOk) {
      lrStatus = "needs_attention";
      attentionReason = "Add a booking link for Send Booking Link recovery";
      attentionHref = "/mctb/ai-recovery";
    }
  }

  if (lrConfig.enabledScenarios.emergencies) {
    const emergencyPolicy = lrConfig.intentPolicies.EMERGENCY_OR_URGENT;
    if (policyUsesOnCall(emergencyPolicy)) {
      const dest = emergencyPolicy?.providerConfiguration?.onCallRecipientId;
      if (!dest) {
        lrStatus = "needs_attention";
        attentionReason = attentionReason ?? "Choose an on-call recipient for emergencies";
        attentionHref = attentionHref ?? "/mctb/ai-recovery";
      }
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
