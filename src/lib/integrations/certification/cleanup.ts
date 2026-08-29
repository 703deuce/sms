import { buildAdapterContext } from "@/lib/integrations/framework/context";
import { getAdapter } from "@/lib/integrations/framework/registry";
import { asCrmProviderId, asNativeProviderId } from "./workspace-integration";
import type { CertProviderId } from "./types";

export type CertCreatedObject = {
  provider: CertProviderId;
  objectType: string;
  externalId: string;
  retainForWebhook?: boolean;
};

/**
 * Best-effort cleanup of certification objects created during a live run.
 * Skips objects marked retainForWebhook (delayed webhook validation).
 */
export async function cleanupCertCreatedObjects(input: {
  workspaceId: string;
  objects: CertCreatedObject[];
}): Promise<{ removed: number; retained: number; failures: string[] }> {
  let removed = 0;
  let retained = 0;
  const failures: string[] = [];

  for (const obj of input.objects) {
    if (obj.retainForWebhook) {
      retained += 1;
      continue;
    }

    try {
      const nativeId = asNativeProviderId(obj.provider);
      if (nativeId) {
        const adapter = getAdapter(nativeId);
        if (adapter.cleanupTestRecord) {
          const ctx = await buildAdapterContext(input.workspaceId, nativeId);
          await adapter.cleanupTestRecord(ctx, obj.objectType, obj.externalId);
          removed += 1;
          continue;
        }
      }

      const crmId = asCrmProviderId(obj.provider);
      if (crmId) {
        // CRM acceptance suites create labeled test records; dedicated CRM cleanup
        // hooks are not yet implemented — report for operator follow-up.
        failures.push(`${obj.provider}:${obj.externalId} — CRM cleanup not implemented`);
        continue;
      }

      failures.push(`${obj.provider}:${obj.externalId} — no cleanup adapter`);
    } catch (err) {
      failures.push(
        `${obj.provider}:${obj.externalId} — ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return { removed, retained, failures };
}
