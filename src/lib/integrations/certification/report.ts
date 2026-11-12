import type {
  IntegrationCertCheckStatus,
  IntegrationCertMode,
  IntegrationCertReport,
  ProviderCertReport,
} from "./types";

function checkLabel(status: IntegrationCertCheckStatus | undefined): string {
  if (!status || status === "NOT_TESTED") return "NOT TESTED";
  return status;
}

function fixtureLine(fixture: ProviderCertReport["fixture"]): string {
  if (fixture.total === 0) return "No fixtures";
  const ratio = `${fixture.passed}/${fixture.total} PASS`;
  return fixture.failed === 0 ? ratio : `${ratio} (${fixture.failed} FAIL)`;
}

function connectionLabel(connection: ProviderCertReport["connection"]): string {
  if (connection === "none") return "None";
  if (connection === "oauth") return "OAuth";
  if (connection === "api_key") return "API key";
  if (connection === "webhook_credentials") return "Webhook credentials";
  return "App credentials";
}

export function formatIntegrationCertMarkdown(report: IntegrationCertReport): string {
  const lines: string[] = [];
  lines.push(`# Integration Certification — ${report.workspaceId}`);
  lines.push("");
  lines.push(`**certRunId:** \`${report.certRunId}\``);
  lines.push(`**Started:** ${report.startedAt}`);
  lines.push(`**Finished:** ${report.finishedAt}`);
  lines.push("");

  for (const p of report.providers) {
    lines.push(`## ${p.displayName}`);
    lines.push("");
    lines.push(`- **Connection:** ${connectionLabel(p.connection)}`);
    lines.push(`- **Credential:** ${p.credential}`);
    lines.push(`- **Mode:** ${p.mode}`);
    lines.push(`- **Fixtures:** ${fixtureLine(p.fixture)}`);

    if (p.mode === "LIVE" || p.mode === "SANDBOX") {
      lines.push(`- **API test:** ${checkLabel(p.live?.apiTest)}`);
      lines.push(`- **Webhook:** ${checkLabel(p.live?.webhook)}`);
      lines.push(`- **Trigger E2E:** ${checkLabel(p.live?.triggerE2E)}`);
    } else if (p.mode === "SIMULATED") {
      lines.push(`- **Fixture coverage:** ${fixtureLine(p.fixture)}`);
      lines.push(`- **Live OAuth:** NOT TESTED`);
      lines.push(`- **Live webhook:** NOT TESTED`);
      if (p.live?.apiTest === "PASS" || p.live?.webhook === "PASS") {
        lines.push(`- **Note:** Simulated PASS — not a live-provider PASS`);
      }
    } else {
      lines.push(`- **Status:** SKIPPED`);
    }

    for (const note of p.notes) {
      lines.push(`- ${note}`);
    }
    lines.push("");
  }

  lines.push("## Matrix");
  lines.push("");
  lines.push("| Provider | Connection | Fixtures | Live Webhook | Trigger E2E | Mode |");
  lines.push("|----------|------------|----------|--------------|-------------|------|");
  for (const p of report.providers) {
    const fixtures =
      p.fixture.total === 0
        ? "—"
        : p.fixture.failed === 0
          ? "PASS"
          : "FAIL";
    const liveWebhook =
      p.mode === "LIVE" || p.mode === "SANDBOX"
        ? checkLabel(p.live?.webhook)
        : p.mode === "SIMULATED"
          ? "SIMULATED"
          : "SKIPPED";
    const triggerE2E =
      p.mode === "LIVE" || p.mode === "SANDBOX"
        ? checkLabel(p.live?.triggerE2E)
        : p.fixture.failed === 0 && p.fixture.passed > 0
          ? "PASS (fixture)"
          : p.fixture.failed > 0
            ? "FAIL"
            : "NOT TESTED";
    lines.push(
      `| ${p.displayName} | ${p.credential === "Valid" ? "PASS" : p.credential === "Missing" ? "NONE" : "FAIL"} | ${fixtures} | ${liveWebhook} | ${triggerE2E} | ${p.mode} |`,
    );
  }

  return lines.join("\n");
}

export function formatIntegrationCertConsole(report: IntegrationCertReport): string {
  const lines: string[] = [];
  lines.push(`Integration Certification — ${report.workspaceId}`);
  lines.push(`certRunId=${report.certRunId}`);
  lines.push("");

  for (const p of report.providers) {
    lines.push(p.displayName);
    lines.push(`  Connection: ${connectionLabel(p.connection)}`);
    lines.push(`  Credential: ${p.credential}`);
    lines.push(`  Mode: ${p.mode}`);

    if (p.mode === "LIVE" || p.mode === "SANDBOX") {
      lines.push(`  API test: ${checkLabel(p.live?.apiTest)}`);
      lines.push(`  Webhook: ${checkLabel(p.live?.webhook)}`);
      lines.push(`  Trigger E2E: ${checkLabel(p.live?.triggerE2E)}`);
    } else if (p.mode === "SIMULATED") {
      lines.push(`  Fixture coverage: ${fixtureLine(p.fixture)}`);
      lines.push(`  Live OAuth: NOT TESTED`);
      lines.push(`  Live webhook: NOT TESTED`);
    } else {
      lines.push(`  Status: SKIPPED`);
    }

    for (const note of p.notes) {
      lines.push(`  Note: ${note}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function integrationCertOverallPass(report: IntegrationCertReport): boolean {
  for (const p of report.providers) {
    if (p.mode === "SKIPPED") continue;
    if (p.fixture.failed > 0) return false;
    if (p.mode === "LIVE" || p.mode === "SANDBOX") {
      if (p.live?.apiTest === "FAIL" || p.live?.webhook === "FAIL" || p.live?.triggerE2E === "FAIL") {
        return false;
      }
    }
  }
  return report.providers.some((p) => p.mode !== "SKIPPED");
}

export function summarizeModes(report: IntegrationCertReport): Record<IntegrationCertMode, number> {
  const out: Record<IntegrationCertMode, number> = {
    LIVE: 0,
    SANDBOX: 0,
    SIMULATED: 0,
    SKIPPED: 0,
  };
  for (const p of report.providers) {
    out[p.mode] += 1;
  }
  return out;
}
