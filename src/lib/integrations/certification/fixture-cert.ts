import { processCrmWebhookAutomation } from "@/lib/crm/runtime/webhook-automation";
import { dispatchIntegrationAutomationEvent } from "@/lib/integrations/framework/automation-bridge";
import { getAdapter } from "@/lib/integrations/framework/registry";
import { fixturesForProvider } from "./fixtures";
import { asCrmProviderId, asNativeProviderId } from "./workspace-integration";
import type { CertProviderId, FixtureCertResult } from "./types";

/**
 * Simulated certification — still uses the real workspace + real parsers/runtime.
 * Only the external provider boundary is faked via fixtures.
 */
export async function runFixtureCertification(input: {
  workspaceId: string;
  provider: CertProviderId;
  certRunId: string;
  includeTriggerE2E?: boolean;
}): Promise<FixtureCertResult & { triggerE2EPassed: number; triggerE2EFailed: number }> {
  const fixtures = fixturesForProvider(input.provider, input.certRunId);
  const failures: Array<{ id: string; message: string }> = [];
  let passed = 0;
  let triggerE2EPassed = 0;
  let triggerE2EFailed = 0;

  const crmId = asCrmProviderId(input.provider);
  const nativeId = asNativeProviderId(input.provider);

  for (const fixture of fixtures) {
    try {
      if (crmId) {
        const result = await processCrmWebhookAutomation({
          workspaceId: input.workspaceId,
          provider: crmId,
          eventType: fixture.eventType || fixture.id,
          payload: fixture.payload,
        });
        if (!result || typeof result !== "object") {
          throw new Error("CRM webhook processor returned no result");
        }
      } else if (nativeId) {
        const adapter = getAdapter(nativeId);
        if (!adapter.normalizeWebhook) {
          throw new Error(`${nativeId} adapter has no normalizeWebhook`);
        }
        const events = await adapter.normalizeWebhook(input.workspaceId, fixture.payload);
        if (!Array.isArray(events)) {
          throw new Error("normalizeWebhook did not return events array");
        }
        if (events.length === 0) {
          throw new Error("normalizeWebhook returned zero events");
        }
        if (input.includeTriggerE2E) {
          for (const ev of events) {
            const dispatch = await dispatchIntegrationAutomationEvent({
              workspaceId: input.workspaceId,
              provider: nativeId,
              eventType: ev.eventType,
              phone: ev.phone || null,
              email: ev.email || null,
              payload: {
                ...(ev.payload || {}),
                certRunId: input.certRunId,
              },
            });
            if (dispatch.skipped && dispatch.reason === "no_contact") {
              triggerE2EFailed += 1;
            } else {
              triggerE2EPassed += 1;
            }
          }
        }
      } else {
        throw new Error(`No fixture handler for ${input.provider}`);
      }
      passed += 1;
    } catch (err) {
      failures.push({
        id: fixture.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    total: fixtures.length,
    passed,
    failed: failures.length,
    failures,
    triggerE2EPassed,
    triggerE2EFailed,
  };
}
