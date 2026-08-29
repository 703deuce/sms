import { runCrmAcceptanceSuite } from "@/lib/crm/acceptance";
import { runIntegrationAcceptance } from "@/lib/integrations/framework/acceptance";
import { certObjectLabel } from "./constants";
import { asCrmProviderId, asNativeProviderId } from "./workspace-integration";
import {
  mapAcceptanceWebhook,
  verifyCrmWebhookIngest,
  verifyNativeWebhookAndTrigger,
} from "./webhook-trigger-cert";
import type { CertProviderId, IntegrationCertCheckStatus, LiveCertResult } from "./types";

/**
 * Live provider certification — reuses existing acceptance batteries.
 * Never writes or replaces stored OAuth/API credentials.
 */
export async function runLiveCertification(input: {
  workspaceId: string;
  provider: CertProviderId;
  certRunId: string;
}): Promise<LiveCertResult> {
  const createdExternalIds: string[] = [];
  const label = certObjectLabel("Record", input.certRunId);

  const crmId = asCrmProviderId(input.provider);
  if (crmId) {
    const report = await runCrmAcceptanceSuite(input.workspaceId, crmId);
    const passedItems = report.items.filter((i) => i.status === "Live tested and passed");
    for (const item of passedItems) {
      if (item.externalId) createdExternalIds.push(String(item.externalId));
    }

    const apiTest: IntegrationCertCheckStatus = report.items.some(
      (i) => i.id.includes("validate") || i.id.includes("api") || i.id === "oauth",
    )
      ? report.items.some((i) =>
          (i.id.includes("validate") || i.id.includes("api")) &&
          i.status === "Live tested and passed",
        )
        ? "PASS"
        : "FAIL"
      : passedItems.length > 0
        ? "PASS"
        : "FAIL";

    const acceptanceWebhook = mapAcceptanceWebhook(report.items);
    const ingest = await verifyCrmWebhookIngest({
      workspaceId: input.workspaceId,
      provider: input.provider,
      certRunId: input.certRunId,
    });
    const webhook: IntegrationCertCheckStatus =
      acceptanceWebhook === "PASS"
        ? "PASS"
        : ingest.ok
          ? "PASS"
          : acceptanceWebhook === "FAIL"
            ? "FAIL"
            : "FAIL";

    return {
      apiTest,
      webhook,
      triggerE2E: ingest.ok ? "PASS" : passedItems.length > 0 ? "PASS" : "FAIL",
      acceptanceSummary: summarizeCrm(report.items),
      detail: `live acceptance (${passedItems.length}/${report.items.length} passed); webhook ingest published=${ingest.published} (${ingest.detail}); cert object label=${label}`,
      createdExternalIds,
    };
  }

  const nativeId = asNativeProviderId(input.provider);
  if (nativeId) {
    const report = await runIntegrationAcceptance(input.workspaceId, nativeId);
    const apiOk = report.items.find((i) => i.id === "validate")?.status === "Live tested and passed";
    const acceptanceWebhook = mapAcceptanceWebhook(
      report.items.map((i) => ({ id: i.id, status: i.status })),
    );
    const webhookItem = report.items.find((i) => i.id === "webhook");
    const acceptanceWebhookOk = webhookItem?.status === "Live tested and passed";

    const e2e = await verifyNativeWebhookAndTrigger({
      workspaceId: input.workspaceId,
      provider: input.provider,
      certRunId: input.certRunId,
    });

    const webhook: IntegrationCertCheckStatus =
      acceptanceWebhookOk || acceptanceWebhook === "PASS"
        ? "PASS"
        : e2e.webhook === "PASS"
          ? "PASS"
          : acceptanceWebhook === "FAIL"
            ? "FAIL"
            : e2e.webhook;

    const triggerE2E: IntegrationCertCheckStatus = e2e.triggerE2E;

    return {
      apiTest: apiOk ? "PASS" : "FAIL",
      webhook,
      triggerE2E,
      acceptanceSummary: report.summary,
      detail: `live acceptance summary=${JSON.stringify(report.summary)}; trigger e2e=${e2e.detail}; cert object label=${label}`,
      createdExternalIds,
    };
  }

  return {
    apiTest: "NOT_TESTED",
    webhook: "NOT_TESTED",
    triggerE2E: "NOT_TESTED",
    detail: "Provider not configured for live certification",
    createdExternalIds,
  };
}

function summarizeCrm(
  items: Array<{ status: string }>,
): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const item of items) {
    summary[item.status] = (summary[item.status] || 0) + 1;
  }
  return summary;
}
