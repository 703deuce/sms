import "server-only";

import { loadMissedCallTextConfig, updateMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { resolveMctbCommercialEntitlements } from "@/lib/mctb/commercial-entitlements";

/**
 * New workspaces use Transovo platform sender until they buy Own Local Number add-on
 * and complete workspace sender verification.
 */
export async function ensureMctbPlatformSenderDefault(workspaceId: string): Promise<void> {
  const [config, commercial] = await Promise.all([
    loadMissedCallTextConfig(workspaceId),
    resolveMctbCommercialEntitlements(workspaceId),
  ]);
  if (commercial.ownSenderAddOnEntitled && config.senderMode === "WORKSPACE") {
    return;
  }
  if (config.senderMode === "PLATFORM") return;
  await updateMissedCallTextConfig({
    workspaceId,
    patch: { sender_mode: "PLATFORM" },
  });
}
