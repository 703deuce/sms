import { evaluateMctbAiBookingReadiness } from "@/lib/mctb/ai-booking/readiness";
import { hasMctbAiBookingEntitlement } from "@/lib/mctb/ai-booking/entitlement";
import { loadMctbAiBookingConfig } from "@/lib/mctb/ai-booking/config";
import { getPrisma } from "@/lib/db";
import { getStripeTextToPayCapabilities } from "@/lib/stripe-connect/capabilities";
import type {
  IntentPolicyShape,
  LeadRecoveryScenarioKey,
  LeadRecoveryWorkspaceConfig,
  PolicyHealthStatus,
} from "@/lib/mctb/lead-recovery/types";
import { LEAD_RECOVERY_SCENARIO_DEFS } from "@/lib/mctb/lead-recovery/scenarios";

function policyUsesAiBook(policy?: IntentPolicyShape): boolean {
  return Boolean(policy?.actions?.includes("AI_BOOK"));
}

function policyUsesBookingLink(policy?: IntentPolicyShape): boolean {
  return Boolean(policy?.actions?.includes("SEND_BOOKING_LINK"));
}

function policyUsesOnCall(policy?: IntentPolicyShape): boolean {
  return Boolean(policy?.actions?.includes("ROUTE_TO_ON_CALL"));
}

function policyUsesTextToPay(policy?: IntentPolicyShape): boolean {
  return Boolean(policy?.actions?.includes("SEND_TEXT_TO_PAY"));
}

export async function computeLeadRecoveryPolicyHealth(
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

  const [aiCfg, aiReady, entitled, stripeCaps] = await Promise.all([
    loadMctbAiBookingConfig(workspaceId),
    evaluateMctbAiBookingReadiness(workspaceId),
    hasMctbAiBookingEntitlement(workspaceId),
    getStripeTextToPayCapabilities(workspaceId),
  ]);

  const prisma = getPrisma();
  const linkCount = await prisma.mctbBookingLink.count({
    where: { workspaceId, active: true },
  });

  let bookingProvider: PolicyHealthStatus = "READY";
  if (policyUsesAiBook(config.intentPolicies.BOOKING_REQUEST)) {
    if (!entitled) bookingProvider = "UPGRADE_REQUIRED";
    else if (!aiReady.ready) bookingProvider = "NEEDS_CONFIGURATION";
    else bookingProvider = "READY";
  } else if (policyUsesBookingLink(config.intentPolicies.BOOKING_REQUEST)) {
    if (linkCount === 0 && !config.bookingLinkId) bookingProvider = "NEEDS_CONFIGURATION";
  }

  let paymentsProvider: PolicyHealthStatus = "READY";
  if (config.paymentPolicy.textToPayEnabled || policyUsesTextToPay(config.intentPolicies.PAYMENT_REQUEST)) {
    paymentsProvider = stripeCaps.canCreateCheckoutSession ? "READY" : "PROVIDER_BLOCKED";
  }

  for (const def of LEAD_RECOVERY_SCENARIO_DEFS) {
    if (!config.enabledScenarios[def.key]) {
      scenarioHealth[def.key] = "DISABLED";
      continue;
    }
    let status: PolicyHealthStatus = "READY";
    for (const intent of def.intents) {
      const pol = config.intentPolicies[intent];
      if (def.key === "booking") {
        if (policyUsesAiBook(pol)) status = bookingProvider;
        else if (policyUsesBookingLink(pol) && linkCount === 0 && !config.bookingLinkId) {
          status = "NEEDS_CONFIGURATION";
        }
      }
      if (def.key === "emergencies" && policyUsesOnCall(pol)) {
        const dest = pol?.providerConfiguration?.onCallRecipientId;
        if (!dest) status = "NEEDS_CONFIGURATION";
      }
      if (def.key === "payments") {
        status = paymentsProvider;
      }
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
