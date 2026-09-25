import "server-only";

import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { loadMctbAiBookingConfig, resolveFallbackBookingUrl } from "@/lib/mctb/ai-booking/config";
import { hasMctbAiBookingEntitlement } from "@/lib/mctb/ai-booking/entitlement";
import { hasActiveMctbPaidEntitlement } from "@/lib/mctb/entitlement";
import { getPrisma } from "@/lib/db";
import { loadLeadRecoveryConfig } from "@/lib/mctb/lead-recovery/config";

export type MissedCallBookingActionEligibility = {
  allowed: boolean;
  reason?: string;
  bookingUrl?: string | null;
  senderLabel?: "transovo_recovery" | "connected_messaging";
};

async function resolveBookingUrl(workspaceId: string): Promise<string | null> {
  const lr = await loadLeadRecoveryConfig(workspaceId);
  if (lr.bookingLinkId) {
    const prisma = getPrisma();
    const row = await prisma.mctbBookingLink.findFirst({
      where: { workspaceId, id: lr.bookingLinkId, active: true },
    });
    if (row?.url) return row.url;
  }
  const aiCfg = await loadMctbAiBookingConfig(workspaceId);
  return resolveFallbackBookingUrl(workspaceId, aiCfg);
}

/** Pass 1B-aligned booking link eligibility for missed-call contextual actions. */
export async function resolveMissedCallBookingActionEligibility(
  workspaceId: string,
): Promise<MissedCallBookingActionEligibility> {
  const [config, entitled, paid, url] = await Promise.all([
    loadMissedCallTextConfig(workspaceId),
    hasMctbAiBookingEntitlement(workspaceId),
    hasActiveMctbPaidEntitlement(workspaceId),
    resolveBookingUrl(workspaceId),
  ]);

  const senderLabel =
    config.senderMode === "PLATFORM" ? "transovo_recovery" : "connected_messaging";

  if (!entitled || !paid) {
    return { allowed: false, reason: "booking_not_entitled", senderLabel };
  }
  if (!url?.trim()) {
    return { allowed: false, reason: "booking_url_missing", senderLabel };
  }

  return { allowed: true, bookingUrl: url, senderLabel };
}

export function senderModeCustomerLabel(
  mode: "PLATFORM" | "WORKSPACE" | string | null | undefined,
): string {
  if (mode === "PLATFORM") return "Transovo recovery number";
  return "Your connected messaging number";
}
