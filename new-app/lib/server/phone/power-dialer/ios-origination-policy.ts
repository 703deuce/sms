import { getPrisma } from "@/lib/server/db";
import { mergePowerDialerSettings } from "@/lib/products/power-dialer";
import { parseAdvancedDialEntitlements } from "./dial-modes";
import { readAttemptMetadata } from "./attempt-metadata";

export type IosOriginationDecision = {
  eligible: boolean;
  reason: string;
  iosScreeningRequested: boolean;
};

/** Server PSTN + iOS screening for all dial modes when flag and workspace settings allow. */
export async function resolvePowerDialerIosOrigination(input: {
  workspaceId: string;
  powerDialerAttemptId?: string | null;
}): Promise<IosOriginationDecision> {
  if (process.env.POWER_DIALER_IOS_SCREENING_DIAL_ORIGINATION !== "1") {
    return { eligible: false, reason: "feature_flag_off", iosScreeningRequested: false };
  }

  const prisma = getPrisma();
  const limitsRow = await prisma.workspaceLimits.findUnique({
    where: { workspaceId: input.workspaceId },
    select: { limits: true },
  });
  const entitlements = parseAdvancedDialEntitlements(limitsRow?.limits);

  const wsRow = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { customFieldsConfig: true },
  });
  const pd = mergePowerDialerSettings(
    (wsRow?.customFieldsConfig as { powerDialer?: unknown })?.powerDialer,
  );
  const iosScreeningRequested =
    Boolean(pd.callScreeningEnabled) && entitlements.premiumAmdEnabled;

  if (!iosScreeningRequested) {
    return { eligible: false, reason: "screening_not_requested", iosScreeningRequested: false };
  }

  if (!input.powerDialerAttemptId) {
    return { eligible: false, reason: "no_attempt", iosScreeningRequested: true };
  }

  const attempt = await prisma.powerDialerAttempt.findFirst({
    where: { id: input.powerDialerAttemptId, workspaceId: input.workspaceId },
    include: { session: { include: { campaign: true } } },
  });
  if (!attempt?.session?.campaign) {
    return { eligible: false, reason: "attempt_not_found", iosScreeningRequested: true };
  }

  const meta = readAttemptMetadata(attempt.metadataJson);
  if (meta.outboundPstnMode === "server_ios_screening" && meta.prospectCallControlId) {
    return { eligible: false, reason: "already_originated", iosScreeningRequested: true };
  }

  return { eligible: true, reason: "server_ios_screening", iosScreeningRequested: true };
}
