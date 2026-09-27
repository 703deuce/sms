import "server-only";

import { classifyProductionNumber } from "@/lib/messaging/compliance/phone-number-class";
import { getMessagingProviderName } from "@/lib/messaging/provider-config";
import {
  loadMctbSetupPhoneOptions,
  type WorkspaceAccessiblePhoneRow,
} from "@/lib/numbers/workspace-accessible-numbers";

function isTelnyxLocalA2pPhone(row: {
  e164: string;
  provider?: string | null;
  type?: string | null;
  settingsJson?: unknown;
}): boolean {
  return (
    String(row.provider || "").toLowerCase() === "telnyx" &&
    classifyProductionNumber(row) === "TELNYX_LOCAL_A2P"
  );
}

/** Sync MCTB setup numbers from live Telnyx brand/campaign/profile state. */
export async function syncMctbSetupPhoneMessagingFromTelnyx(
  workspaceId: string,
): Promise<void> {
  if (getMessagingProviderName() !== "telnyx") return;

  const phones = await loadMctbSetupPhoneOptions(workspaceId);
  const telnyxLocal = phones.filter(isTelnyxLocalA2pPhone);
  if (telnyxLocal.length === 0) return;

  const { reconcileTelnyxLocalNumberToWorkspace } = await import(
    "@/lib/messaging/telnyx/reconcile-local-number"
  );

  for (const phone of telnyxLocal) {
    try {
      await reconcileTelnyxLocalNumberToWorkspace({
        workspaceId,
        phoneE164: phone.e164,
      });
    } catch (err) {
      console.warn(
        JSON.stringify({
          service: "transovo-web",
          event: "mctb_setup_telnyx_sync_failed",
          workspaceId,
          phoneE164: phone.e164,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}

/**
 * Reload setup phone options after a live Telnyx reconcile.
 * Do not call on read-path GET handlers (setup overview, shell) — use {@link loadMctbSetupPhoneOptions} instead.
 */
export async function loadMctbSetupPhoneOptionsWithTelnyxSync(
  workspaceId: string,
): Promise<WorkspaceAccessiblePhoneRow[]> {
  await syncMctbSetupPhoneMessagingFromTelnyx(workspaceId);
  return loadMctbSetupPhoneOptions(workspaceId);
}
