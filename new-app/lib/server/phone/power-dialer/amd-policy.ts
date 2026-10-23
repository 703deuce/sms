import { getPrisma } from "@/lib/server/db";
import { mergePowerDialerSettings } from "@/lib/products/power-dialer";
import {
  normalizeDialingMode,
  parseAdvancedDialEntitlements,
  parseDialModeSettings,
} from "./dial-modes";
import { readAttemptMetadata } from "./attempt-metadata";

export type PowerDialerAmdDetectionMode =
  | "none"
  | "standard"
  | "premium"
  | "premium_ios_call_screening";

export type IosScreeningWireStatus =
  | "not_requested"
  | "requested_pending_dial_origination"
  | "wire_active_dial_origination";

export type PowerDialerAmdStartPlan = {
  shouldStart: boolean;
  detectionMode: PowerDialerAmdDetectionMode;
  /** Stored on attempt for billing / support visibility */
  billingTier: "none" | "standard" | "premium";
  iosScreeningRequested: boolean;
  /**
   * True only when Telnyx iOS screening mode is on the PSTN leg per documented API
   * (POST /v2/calls or transfer with premium_ios_call_screening_detection).
   */
  iosScreeningWireActive: boolean;
  iosScreeningWireStatus: IosScreeningWireStatus;
  /** Call Control AMD-start only documents Premium / Detect — not iOS screening. */
  amdStartDetectionMode: "Premium" | "Detect" | null;
  promptEndTimeoutMillis?: number;
  reason: string;
};

export async function resolvePowerDialerAmdStartPlan(input: {
  workspaceId: string;
  powerDialerAttemptId?: string | null;
}): Promise<PowerDialerAmdStartPlan> {
  const prisma = getPrisma();
  const limitsRow = await prisma.workspaceLimits.findUnique({
    where: { workspaceId: input.workspaceId },
    select: { limits: true },
  });
  const entitlements = parseAdvancedDialEntitlements(limitsRow?.limits);

  let dialMode = "power";
  let amdFilter = false;
  if (input.powerDialerAttemptId) {
    const attempt = await prisma.powerDialerAttempt.findFirst({
      where: { id: input.powerDialerAttemptId, workspaceId: input.workspaceId },
      include: { session: { include: { campaign: true } } },
    });
    if (attempt?.session?.campaign) {
      dialMode = normalizeDialingMode(attempt.session.campaign.dialingMode);
      const meta = readAttemptMetadata(attempt.metadataJson);
      amdFilter = meta.amdFilter === true;
    }
  }

  const wsRow = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { customFieldsConfig: true },
  });
  const pd = mergePowerDialerSettings(
    (wsRow?.customFieldsConfig as { powerDialer?: unknown })?.powerDialer,
  );

  const needsPremium =
    dialMode === "parallel_amd" ||
    amdFilter ||
    entitlements.premiumAmdEnabled ||
    Boolean(pd.callScreeningEnabled);

  if (!needsPremium && dialMode !== "parallel" && dialMode !== "predictive") {
    return {
      shouldStart: true,
      detectionMode: "standard",
      billingTier: "standard",
      iosScreeningRequested: false,
      iosScreeningWireActive: false,
      iosScreeningWireStatus: "not_requested",
      amdStartDetectionMode: "Detect",
      reason: "default_standard_amd",
    };
  }

  if (!entitlements.premiumAmdEnabled && dialMode === "parallel_amd") {
    return {
      shouldStart: false,
      detectionMode: "none",
      billingTier: "none",
      iosScreeningRequested: false,
      iosScreeningWireActive: false,
      iosScreeningWireStatus: "not_requested",
      amdStartDetectionMode: null,
      reason: "parallel_amd_requires_premium_entitlement",
    };
  }

  const iosScreeningRequested =
    Boolean(pd.callScreeningEnabled) && entitlements.premiumAmdEnabled;

  const dialOriginationIos =
    process.env.POWER_DIALER_IOS_SCREENING_DIAL_ORIGINATION === "1";

  if (iosScreeningRequested && dialOriginationIos) {
    return {
      shouldStart: false,
      detectionMode: "premium_ios_call_screening",
      billingTier: "premium",
      iosScreeningRequested: true,
      iosScreeningWireActive: true,
      iosScreeningWireStatus: "wire_active_dial_origination",
      amdStartDetectionMode: null,
      reason: "ios_screening_on_dial_origination_pending_impl",
    };
  }

  if (needsPremium && entitlements.premiumAmdEnabled) {
    return {
      shouldStart: true,
      detectionMode: "premium",
      billingTier: "premium",
      iosScreeningRequested,
      iosScreeningWireActive: false,
      iosScreeningWireStatus: iosScreeningRequested
        ? "requested_pending_dial_origination"
        : "not_requested",
      amdStartDetectionMode: "Premium",
      reason: iosScreeningRequested
        ? "premium_amd_ios_screening_requires_v2_calls_origination"
        : "premium_amd",
    };
  }

  return {
    shouldStart: true,
    detectionMode: "standard",
    billingTier: "standard",
    iosScreeningRequested: false,
    iosScreeningWireActive: false,
    iosScreeningWireStatus: "not_requested",
    amdStartDetectionMode: "Detect",
    reason: "premium_unavailable_standard_fallback",
  };
}
