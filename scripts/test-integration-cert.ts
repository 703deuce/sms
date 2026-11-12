/**
 * Integration certification module contract tests (no live provider calls).
 * Run: npx tsx scripts/test-integration-cert.ts
 */

import assert from "node:assert/strict";
import {
  CERT_PRIORITY_PROVIDERS,
  DEFAULT_CERT_WORKSPACE_ID,
  PROVIDER_CATALOG,
  certObjectLabel,
  fixturesForProvider,
  formatIntegrationCertConsole,
  formatIntegrationCertMarkdown,
  integrationCertOverallPass,
  isCertProviderId,
  resolveCertWorkspaceId,
  summarizeModes,
} from "../src/lib/integrations/certification";
import type { IntegrationCertReport } from "../src/lib/integrations/certification";

let passed = 0;

function ok(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    throw err;
  }
}

function sampleReport(): IntegrationCertReport {
  return {
    certRunId: "cert_abc123",
    workspaceId: "ws_1",
    startedAt: "2026-08-29T12:00:00.000Z",
    finishedAt: "2026-08-29T12:01:00.000Z",
    providers: [
      {
        provider: "pipedrive",
        displayName: "Pipedrive",
        bucket: "connected_live_account",
        connection: "oauth",
        credential: "Valid",
        mode: "LIVE",
        fixture: { total: 2, passed: 2, failed: 0, failures: [] },
        live: { apiTest: "PASS", webhook: "PASS", triggerE2E: "PASS", createdExternalIds: [] },
        notes: [],
      },
      {
        provider: "salesforce",
        displayName: "Salesforce",
        bucket: "sandbox_or_dev_account",
        connection: "none",
        credential: "Missing",
        mode: "SIMULATED",
        fixture: { total: 2, passed: 2, failed: 0, failures: [] },
        notes: ["Salesforce live OAuth/webhook certification pending"],
      },
    ],
  };
}

ok("defaults workspace to ws_1", () => {
  const prev = process.env.CERT_WORKSPACE_ID;
  delete process.env.CERT_WORKSPACE_ID;
  assert.equal(resolveCertWorkspaceId(), DEFAULT_CERT_WORKSPACE_ID);
  process.env.CERT_WORKSPACE_ID = "ws_custom";
  assert.equal(resolveCertWorkspaceId(), "ws_custom");
  assert.equal(resolveCertWorkspaceId("ws_explicit"), "ws_explicit");
  if (prev) process.env.CERT_WORKSPACE_ID = prev;
  else delete process.env.CERT_WORKSPACE_ID;
});

ok("priority providers include five V1 integrations", () => {
  assert.deepEqual(CERT_PRIORITY_PROVIDERS, [
    "pipedrive",
    "calendly",
    "zoho",
    "salesforce",
    "jotform",
  ]);
  for (const id of CERT_PRIORITY_PROVIDERS) {
    assert.ok(isCertProviderId(id));
    assert.ok(PROVIDER_CATALOG[id]);
  }
});

ok("cert object labels are obviously temporary", () => {
  const label = certObjectLabel("Lead", "cert_deadbeef");
  assert.match(label, /^\[TRANSOVO CERT\] Lead \d{4}-\d{2}-\d{2}-deadbeef$/);
});

ok("fixtures embed certRunId correlation", () => {
  const fixtures = fixturesForProvider("pipedrive", "cert_test123");
  assert.ok(fixtures.length >= 2);
  const payload = JSON.stringify(fixtures);
  assert.match(payload, /TRANSOVO CERT|cert_test123/);
});

ok("markdown report distinguishes LIVE vs SIMULATED", () => {
  const md = formatIntegrationCertMarkdown(sampleReport());
  assert.match(md, /\*\*Mode:\*\* LIVE/);
  assert.match(md, /\*\*Mode:\*\* SIMULATED/);
  assert.match(md, /\*\*Live OAuth:\*\* NOT TESTED/);
  assert.doesNotMatch(md, /## Salesforce[\s\S]*\*\*Mode:\*\* LIVE/);
});

ok("console report never labels simulated provider as live pass", () => {
  const text = formatIntegrationCertConsole(sampleReport());
  const sfBlock = text.split("Salesforce")[1] || "";
  assert.match(sfBlock, /Mode: SIMULATED/);
  assert.match(sfBlock, /Live webhook: NOT TESTED/);
});

ok("overall pass requires fixture and live gates", () => {
  assert.equal(integrationCertOverallPass(sampleReport()), true);
  const fail = sampleReport();
  fail.providers[0].live!.apiTest = "FAIL";
  assert.equal(integrationCertOverallPass(fail), false);
  const simOnly = sampleReport();
  simOnly.providers[0].mode = "SIMULATED";
  simOnly.providers[0].live = undefined;
  assert.equal(integrationCertOverallPass(simOnly), true);
});

ok("summarizeModes counts provider modes", () => {
  const modes = summarizeModes(sampleReport());
  assert.equal(modes.LIVE, 1);
  assert.equal(modes.SIMULATED, 1);
});

console.log(`\n${passed} passed`);
if (passed === 0) process.exit(1);
