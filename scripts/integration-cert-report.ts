/**
 * Integration certification report — workspace-aware, connection-aware.
 *
 * Run:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/integration-cert-report.ts
 *
 * Env:
 *   CERT_WORKSPACE_ID=ws_1   (default ws_1)
 *   CERT_FIXTURE_ONLY=1      (skip live probes)
 *   CERT_SKIP_LIVE=1         (same as fixture-only for live path)
 *   CERT_LIVE_ONLY=1         (skip fixture suite)
 *
 * Args:
 *   --workspace ws_1
 *   --providers pipedrive,calendly,zoho,salesforce,jotform
 *   --fixture-only
 *   --live-only
 *   --json [path]
 *   --markdown [path]
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import dotenv from "dotenv";
import {
  formatIntegrationCertConsole,
  formatIntegrationCertMarkdown,
  integrationCertOverallPass,
  isCertProviderId,
  resolveCertWorkspaceId,
  runIntegrationCertification,
  summarizeModes,
} from "../src/lib/integrations/certification";

for (const file of [".env.local", ".env"]) {
  const path = join(process.cwd(), file);
  if (existsSync(path)) dotenv.config({ path });
}

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

async function main() {
  const workspaceId = resolveCertWorkspaceId(argValue("--workspace"));
  const providersRaw = argValue("--providers");
  const providerFilter = providersRaw
    ? providersRaw.split(",").map((p) => p.trim()).filter(Boolean)
    : undefined;

  if (providerFilter?.some((p) => !isCertProviderId(p))) {
    console.error("Unknown provider in --providers. Supported: pipedrive, calendly, zoho, salesforce, jotform");
    process.exit(1);
  }

  const fixtureOnly = hasFlag("--fixture-only") || process.env.CERT_FIXTURE_ONLY === "1";
  const liveOnly = hasFlag("--live-only") || process.env.CERT_LIVE_ONLY === "1";
  const skipLive = hasFlag("--skip-live") || process.env.CERT_SKIP_LIVE === "1" || fixtureOnly;

  console.log(`Running integration certification for workspace=${workspaceId}`);
  if (fixtureOnly) console.log("Mode override: fixture-only (no live provider probes)");
  if (liveOnly) console.log("Mode override: live-only (skip fixture suite)");
  console.log("");

  const report = await runIntegrationCertification({
    workspaceId,
    providerFilter,
    fixtureOnly,
    liveOnly,
    skipLive,
  });

  const consoleText = formatIntegrationCertConsole(report);
  console.log(consoleText);

  const modes = summarizeModes(report);
  console.log(
    `Summary: LIVE=${modes.LIVE} SANDBOX=${modes.SANDBOX} SIMULATED=${modes.SIMULATED} SKIPPED=${modes.SKIPPED}`,
  );

  const pass = integrationCertOverallPass(report);
  console.log(pass ? "\nOVERALL: PASS" : "\nOVERALL: FAIL");

  const artifactsDir = process.env.CERT_ARTIFACTS || join(process.cwd(), "artifacts");
  mkdirSync(artifactsDir, { recursive: true });

  const jsonPath = argValue("--json") || join(artifactsDir, `integration-cert-${report.certRunId}.json`);
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`JSON report: ${jsonPath}`);

  const mdPath = argValue("--markdown") || join(artifactsDir, `integration-cert-${report.certRunId}.md`);
  writeFileSync(mdPath, formatIntegrationCertMarkdown(report));
  console.log(`Markdown report: ${mdPath}`);

  if (!pass) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
