import { runCrmAcceptanceSuite } from "@/lib/crm/acceptance";
import { runIntegrationAcceptance } from "@/lib/integrations/framework/acceptance";
import { certObjectLabel } from "./constants";
import { asCrmProviderId, asNativeProviderId } from "./workspace-integration";
import type { CertProviderId, IntegrationCertCheckStatus, LiveCertResult } from "./types";

function acceptancePassRatio(summary: Record<string, number> | undefined): boolean {
  if (!summary) return false;
  const passed = summary["Live tested and passed"] || 0;
  const failed = summary["Failed and fixed"] || 0;
  return passed > 0 && failed === 0;
}

function mapAcceptanceWebhook(items: Array<{ id: string; status: string }>): IntegrationCertCheckStatus {
  const webhookItems = items.filter((i) => i.id.includes("webhook"));
  if (webhookItems.length === 0) return "NOT_TESTED";
  if (webhookItems.every((i) => i.status === "Live tested and passed")) return "PASS";
  if (webhookItems.some((i) => i.status === "Live tested and passed")) return "PASS";
  return "FAIL";
}

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

    return {
      apiTest,
      webhook: mapAcceptanceWebhook(report.items),
      triggerE2E: passedItems.length > 0 ? "PASS" : "FAIL",
      acceptanceSummary: summarizeCrm(report.items),
      detail: `live acceptance (${passedItems.length}/${report.items.length} passed); cert object label=${label}`,
      createdExternalIds,
    };
  }

  const nativeId = asNativeProviderId(input.provider);
  if (nativeId) {
    const report = await runIntegrationAcceptance(input.workspaceId, nativeId);
    const apiOk = report.items.find((i) => i.id === "validate")?.status === "Live tested and passed";
    const webhookOk = report.items.find((i) => i.id === "webhook")?.status === "Live tested and passed";

    return {
      apiTest: apiOk ? "PASS" : "FAIL",
      webhook: webhookOk ? "PASS" : mapAcceptanceWebhook(
        report.items.map((i) => ({ id: i.id, status: i.status })),
      ),
      triggerE2E: acceptancePassRatio(report.summary) ? "PASS" : "FAIL",
      acceptanceSummary: report.summary,
      detail: `live acceptance summary=${JSON.stringify(report.summary)}; cert object label=${label}`,
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
