import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { getPrisma } from "@/lib/db";
import { resolveMctbCapabilities } from "@/lib/mctb/capabilities";
import { loadMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import { getProductionMctbForwardTargetE164 } from "@/lib/mctb/production-forward-target";
import { formatMctbPhoneLabel } from "@/lib/mctb/phone-display";
import { resolveMctbWorkspaceBusinessLineE164 } from "@/lib/mctb/resolve-workspace-business-line";
import {
  buildMctbPlanUsagePresentation,
  type MctbPlanUsagePresentation,
} from "@/lib/mctb/plan-display";
import { currentMctbRecoveryPeriodKey } from "@/lib/mctb/recovery-usage-constants";
import { getMctbRecoveryUsageSnapshot } from "@/lib/mctb/recovery-usage";

export type MctbForwardingIngressUiState = "ready" | "provisioning" | "missing";

export type MctbShellContextPayload = {
  workspaceName: string;
  businessLineE164: string | null;
  forwardingIngressE164: string | null;
  forwardingIngressState: MctbForwardingIngressUiState;
  senderMode: "PLATFORM" | "WORKSPACE";
  senderE164: string | null;
  senderLabel: string;
  senderDetail: string;
  timezone: string;
  planUsage: MctbPlanUsagePresentation;
  capabilities: {
    bookingLinks: boolean;
    urgentClassification: boolean;
    aiRecoveryEntitled: boolean;
    recoveryPaid: boolean;
    pressOneConsent: boolean;
  };
};

/** Shared MCTB chrome context for Opus shell + setup editors (no Telnyx sweep). */
export async function loadMctbShellContextData(workspaceId: string): Promise<MctbShellContextPayload> {
  const prisma = getPrisma();
  const [workspace, runtime, onboarding, forwardingIngressE164, capabilities, usageSnapshot] =
    await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true, customFieldsConfig: true },
    }),
    loadMissedCallTextConfig(workspaceId),
    loadMctbOnboardingState(workspaceId),
    getProductionMctbForwardTargetE164(workspaceId),
    resolveMctbCapabilities(workspaceId),
    getMctbRecoveryUsageSnapshot(workspaceId),
  ]);

  const customCfg =
    workspace?.customFieldsConfig && typeof workspace.customFieldsConfig === "object"
      ? (workspace.customFieldsConfig as Record<string, unknown>)
      : {};
  const mctbSettings =
    customCfg.mctb && typeof customCfg.mctb === "object"
      ? (customCfg.mctb as Record<string, unknown>)
      : {};

  const businessLineE164 = resolveMctbWorkspaceBusinessLineE164(
    typeof mctbSettings.businessLineE164 === "string" ? mctbSettings.businessLineE164 : null,
    onboarding.businessNumberE164,
  );

  const senderMode = runtime.senderMode === "PLATFORM" ? "PLATFORM" : "WORKSPACE";
  const ownedPhones = await prisma.phoneNumber.findMany({
    where: { workspaceId, status: { not: "Released" } },
    select: { id: true, e164: true },
  });
  let senderE164: string | null = null;
  if (senderMode === "WORKSPACE") {
    const smsId = runtime.smsPhoneNumberId;
    if (smsId) {
      senderE164 = ownedPhones.find((p) => p.id === smsId)?.e164 ?? null;
    }
  }

  let forwardingIngressState: MctbForwardingIngressUiState = "missing";
  if (forwardingIngressE164) {
    forwardingIngressState = "ready";
  } else if (runtime.phoneNumberId) {
    forwardingIngressState = "provisioning";
  }

  const planUsage = buildMctbPlanUsagePresentation({
    recoveryPaid: capabilities.recoveryPaid,
    aiRecoveryEntitled: capabilities.aiRecoveryEntitled,
    monthlyRecoveriesUsed: capabilities.monthlyRecoveriesUsed,
    monthlyRecoveryLimit: capabilities.monthlyRecoveryLimit,
    atLimit: usageSnapshot.atLimit,
    periodKey: usageSnapshot.periodKey || currentMctbRecoveryPeriodKey(),
  });

  return {
    workspaceName: workspace?.name ?? "Workspace",
    businessLineE164,
    forwardingIngressE164,
    forwardingIngressState,
    senderMode,
    senderE164,
    senderLabel:
      senderMode === "PLATFORM"
        ? "Transovo Platform"
        : senderE164
          ? formatMctbPhoneLabel(senderE164)
          : "Your verified number",
    senderDetail:
      senderMode === "PLATFORM"
        ? "Managed by Transovo"
        : senderE164
          ? formatMctbPhoneLabel(senderE164)
          : "Select a verified messaging number",
    timezone: runtime.timezone ?? "America/New_York",
    planUsage,
    capabilities: {
      bookingLinks: capabilities.bookingLinks,
      urgentClassification: capabilities.urgentClassification,
      aiRecoveryEntitled: capabilities.aiRecoveryEntitled,
      recoveryPaid: capabilities.recoveryPaid,
      pressOneConsent: capabilities.pressOneConsent,
    },
  };
}
