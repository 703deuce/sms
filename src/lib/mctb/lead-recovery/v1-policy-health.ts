import "server-only";

import { getPrisma } from "@/lib/db";
import { MCTB_LAUNCH_HIDE_LR_TEXT_TO_PAY_UI } from "@/lib/mctb/launch-flags";
import type {
  IntentPolicyShape,
  LeadRecoveryScenarioKey,
  LeadRecoveryWorkspaceConfig,
  PolicyHealthStatus,
} from "@/lib/mctb/lead-recovery/types";
import { LEAD_RECOVERY_SCENARIO_DEFS } from "@/lib/mctb/lead-recovery/scenarios";

function policyUsesBookingLink(policy?: IntentPolicyShape): boolean {
  return Boolean(policy?.actions?.includes("SEND_BOOKING_LINK"));
}

function policyUsesOnCall(policy?: IntentPolicyShape): boolean {
  return Boolean(policy?.actions?.includes("ROUTE_TO_ON_CALL"));
}

function bookingScenarioUsesSendLink(config: LeadRecoveryWorkspaceConfig): boolean {
  if (!config.enabledScenarios.booking) return false;
  const pol = config.intentPolicies.BOOKING_REQUEST;
  if (policyUsesBookingLink(pol)) return true;
  return pol?.mode === "SEND_BOOKING_LINK" || !pol?.actions?.length;
}

export async function sendBookingLinkResolvable(
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
 * V1 Lead Recovery health for settings/overview surfaces — no Microsoft/Calendly AI_BOOK readiness.
 */
export async function computeLeadRecoveryV1PolicyHealth(
  workspaceId: string,
  config: LeadRecoveryWorkspaceConfig,
): Promise<{
  overall: PolicyHealthStatus;
  scenarioHealth: Partial<Record<LeadRecoveryScenarioKey, PolicyHealthStatus>>;
  providers: {
    booking: PolicyHealthStatus;
    payments: PolicyHealthStatus;
    notifications: PolicyHealthStatus;
  };
}> {
  const scenarioHealth: Partial<Record<LeadRecoveryScenarioKey, PolicyHealthStatus>> = {};
  if (!config.enabled) {
    for (const def of LEAD_RECOVERY_SCENARIO_DEFS) {
      scenarioHealth[def.key] = "DISABLED";
    }
    return {
      overall: "DISABLED",
      scenarioHealth,
      providers: { booking: "DISABLED", payments: "DISABLED", notifications: "READY" },
    };
  }

  let bookingProvider: PolicyHealthStatus = "READY";
  if (bookingScenarioUsesSendLink(config)) {
    const linkOk = await sendBookingLinkResolvable(workspaceId, config);
    if (!linkOk) bookingProvider = "NEEDS_CONFIGURATION";
  }

  let paymentsProvider: PolicyHealthStatus = "READY";
  if (
    !MCTB_LAUNCH_HIDE_LR_TEXT_TO_PAY_UI &&
    (config.paymentPolicy.textToPayEnabled || config.enabledScenarios.payments)
  ) {
    const { getStripeTextToPayCapabilities } = await import("@/lib/stripe-connect/capabilities");
    const stripeCaps = await getStripeTextToPayCapabilities(workspaceId);
    paymentsProvider = stripeCaps.canCreateCheckoutSession ? "READY" : "PROVIDER_BLOCKED";
  }

  for (const def of LEAD_RECOVERY_SCENARIO_DEFS) {
    if (!config.enabledScenarios[def.key]) {
      scenarioHealth[def.key] = "DISABLED";
      continue;
    }
    let status: PolicyHealthStatus = "READY";
    if (def.key === "booking") {
      status = bookingProvider;
    }
    if (def.key === "emergencies") {
      for (const intent of def.intents) {
        const pol = config.intentPolicies[intent];
        if (policyUsesOnCall(pol) && !pol?.providerConfiguration?.onCallRecipientId) {
          status = "NEEDS_CONFIGURATION";
        }
      }
    }
    if (def.key === "payments" && !MCTB_LAUNCH_HIDE_LR_TEXT_TO_PAY_UI) {
      status = paymentsProvider;
    }
    scenarioHealth[def.key] = status;
  }

  const values = Object.values(scenarioHealth).filter((s) => s && s !== "DISABLED");
  const overall = values.includes("PROVIDER_BLOCKED")
    ? "PROVIDER_BLOCKED"
    : values.includes("NEEDS_CONFIGURATION")
      ? "NEEDS_CONFIGURATION"
      : values.includes("UPGRADE_REQUIRED")
        ? "UPGRADE_REQUIRED"
        : "READY";

  return {
    overall,
    scenarioHealth,
    providers: {
      booking: bookingProvider,
      payments: paymentsProvider,
      notifications: "READY",
    },
  };
}
