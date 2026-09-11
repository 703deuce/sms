import { randomBytes } from "node:crypto";
import { CERT_PRIORITY_PROVIDERS, resolveCertWorkspaceId } from "./constants";
import { cleanupCertCreatedObjects, type CertCreatedObject } from "./cleanup";
import { runFixtureCertification } from "./fixture-cert";
import { runLiveCertification } from "./live-cert";
import { PROVIDER_CATALOG, isCertProviderId } from "./provider-catalog";
import { validateIntegrationConnection } from "./validate-connection";
import {
  getWorkspaceIntegration,
  isWorkspaceIntegrationConnected,
} from "./workspace-integration";
import type {
  CertProviderId,
  IntegrationCertMode,
  IntegrationCertReport,
  ProviderCertReport,
} from "./types";

export type RunIntegrationCertOptions = {
  workspaceId?: string;
  providers?: CertProviderId[];
  certRunId?: string;
  /** Run fixture suite even when live mode is selected (default true). */
  includeFixtures?: boolean;
  /** Dispatch automation triggers during fixture runs (default true). */
  includeTriggerE2E?: boolean;
  /** Only run fixture certification — never attempt live probes. */
  fixtureOnly?: boolean;
  /** Only run live certification for connected providers — skip fixtures. */
  liveOnly?: boolean;
  /** Skip live probes but still validate connection state for reporting. */
  skipLive?: boolean;
  /** Cleanup provider objects created during live runs (default true). */
  cleanup?: boolean;
  providerFilter?: string[];
};

function makeCertRunId(): string {
  return `cert_${randomBytes(6).toString("hex")}`;
}

function resolveProviders(filter?: string[]): CertProviderId[] {
  if (!filter?.length) return [...CERT_PRIORITY_PROVIDERS];
  const ids: CertProviderId[] = [];
  for (const raw of filter) {
    const id = raw.trim().toLowerCase();
    if (isCertProviderId(id)) ids.push(id);
  }
  return ids.length ? ids : [...CERT_PRIORITY_PROVIDERS];
}

function resolveMode(input: {
  connected: boolean;
  validationOk: boolean;
  sandbox: boolean;
  fixtureOnly: boolean;
  skipLive: boolean;
  bucket: ProviderCertReport["bucket"];
}): IntegrationCertMode {
  if (input.fixtureOnly || input.skipLive) return "SIMULATED";
  if (!input.connected || !input.validationOk) return "SIMULATED";
  if (input.sandbox || input.bucket === "sandbox_or_dev_account") return "SANDBOX";
  return "LIVE";
}

function credentialStatus(
  connected: boolean,
  validation: { ok: boolean; message: string } | null,
): ProviderCertReport["credential"] {
  if (!connected) return "Missing";
  if (!validation) return "Not tested";
  return validation.ok ? "Valid" : "Invalid";
}

/**
 * Workspace-aware, connection-aware integration certification.
 * Defaults to ws_1 — never creates a fake workspace.
 */
export async function runIntegrationCertification(
  options: RunIntegrationCertOptions = {},
): Promise<IntegrationCertReport> {
  const workspaceId = resolveCertWorkspaceId(options.workspaceId);
  const certRunId = options.certRunId || makeCertRunId();
  const providers = resolveProviders(options.providerFilter || options.providers);
  const includeFixtures = options.includeFixtures !== false;
  const includeTriggerE2E = options.includeTriggerE2E !== false;
  const fixtureOnly = options.fixtureOnly === true;
  const liveOnly = options.liveOnly === true;
  const skipLive = options.skipLive === true;
  const shouldCleanup = options.cleanup !== false;

  const startedAt = new Date().toISOString();
  const providerReports: ProviderCertReport[] = [];
  const allCreated: CertCreatedObject[] = [];

  for (const provider of providers) {
    const catalog = PROVIDER_CATALOG[provider];
    const notes: string[] = [];
    const connectionView = await getWorkspaceIntegration({ workspaceId, provider });
    const connected = isWorkspaceIntegrationConnected(connectionView);

    let validation: Awaited<ReturnType<typeof validateIntegrationConnection>> | null = null;
    if (connected) {
      validation = await validateIntegrationConnection(workspaceId, provider);
      if (!validation.ok) {
        notes.push(`Connection problem: ${validation.message}`);
      } else if (validation.refreshed) {
        notes.push("OAuth token refreshed during validation");
      }
    } else if (connectionView) {
      notes.push(`Integration record exists but status=${connectionView.status}`);
    } else {
      notes.push("No integration connection record — using fixture simulation on real workspace");
    }

    const mode = resolveMode({
      connected,
      validationOk: Boolean(validation?.ok),
      sandbox: connectionView?.sandbox === true,
      fixtureOnly,
      skipLive,
      bucket: catalog.bucket,
    });

    const effectiveMode = mode;

    let fixture = {
      total: 0,
      passed: 0,
      failed: 0,
      failures: [] as Array<{ id: string; message: string }>,
    };

    if (!liveOnly && includeFixtures) {
      const fixtureResult = await runFixtureCertification({
        workspaceId,
        provider,
        certRunId,
        includeTriggerE2E,
      });
      fixture = {
        total: fixtureResult.total,
        passed: fixtureResult.passed,
        failed: fixtureResult.failed,
        failures: fixtureResult.failures,
      };
      if (fixtureResult.triggerE2EFailed > 0) {
        notes.push(
          `Fixture trigger E2E: ${fixtureResult.triggerE2EPassed} passed, ${fixtureResult.triggerE2EFailed} failed`,
        );
      }
    }

    let live: ProviderCertReport["live"];
    if (
      !fixtureOnly &&
      !skipLive &&
      connected &&
      validation?.ok &&
      (effectiveMode === "LIVE" || effectiveMode === "SANDBOX")
    ) {
      try {
        const liveResult = await runLiveCertification({ workspaceId, provider, certRunId });
        live = liveResult;
        for (const externalId of liveResult.createdExternalIds) {
          allCreated.push({
            provider,
            objectType: "cert_record",
            externalId,
          });
        }
        if (liveResult.detail) notes.push(liveResult.detail);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        notes.push(`Live certification error: ${message}`);
        live = {
          apiTest: "FAIL",
          webhook: "NOT_TESTED",
          triggerE2E: "NOT_TESTED",
          detail: message,
          createdExternalIds: [],
        };
      }
    } else if (effectiveMode === "SIMULATED" && catalog.bucket === "sandbox_or_dev_account") {
      notes.push(
        "Salesforce live OAuth/webhook certification pending — connect a developer/sandbox org to ws_1",
      );
    }

    providerReports.push({
      provider,
      displayName: catalog.displayName,
      bucket: catalog.bucket,
      connection: connectionView?.connectionMethod || "none",
      credential: credentialStatus(connected, validation),
      mode: effectiveMode,
      fixture,
      live,
      notes,
    });
  }

  if (shouldCleanup && allCreated.length > 0) {
    const cleanup = await cleanupCertCreatedObjects({ workspaceId, objects: allCreated });
    if (cleanup.removed > 0) {
      providerReports.forEach((p) => {
        if (p.live?.createdExternalIds?.length) {
          p.notes.push(`Cleaned up ${cleanup.removed} cert object(s) at provider`);
        }
      });
    }
    if (cleanup.retained > 0) {
      providerReports.forEach((p) => {
        p.notes.push(`${cleanup.retained} cert object(s) retained for delayed webhook validation`);
      });
    }
    if (cleanup.failures.length) {
      providerReports[0]?.notes.push(
        `Cleanup failures: ${cleanup.failures.slice(0, 3).join("; ")}`,
      );
    }
  }

  return {
    certRunId,
    workspaceId,
    startedAt,
    finishedAt: new Date().toISOString(),
    providers: providerReports,
  };
}
