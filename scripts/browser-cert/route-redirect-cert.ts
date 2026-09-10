/**
 * Batch 8H-1 — browser verification of retired Appointments routes → canonical destinations.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { APPT_LEGACY_REDIRECT_SAMPLES } from "./canonical-appointments-routes";
import { resolveLegacyAppointmentsRedirect } from "../../src/lib/products/appointments-legacy-redirects";
import { authenticateMasterUat } from "./master-uat-auth";
import { resolveCertBaseUrl } from "./server-guard";

export type RouteRedirectResult = {
  from: string;
  expected: string;
  finalUrl: string;
  status: "PASS" | "FAIL_ROUTE" | "FAIL_AUTHORIZATION";
  detail: string;
};

function normalizePath(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.hash || ""}`;
  } catch {
    return url;
  }
}

function pathsMatch(finalPath: string, expected: string): boolean {
  const finalBase = finalPath.split("?")[0];
  const expectedBase = expected.split("?")[0];
  if (finalBase !== expectedBase && !finalPath.startsWith(expectedBase)) {
    return false;
  }
  if (expected.includes("?")) {
    const expectedParams = new URLSearchParams(expected.split("?")[1] || "");
    const finalParams = new URLSearchParams(finalPath.split("?")[1] || "");
    for (const [k, v] of expectedParams) {
      if (finalParams.get(k) !== v) return false;
    }
  }
  if (expected.includes("#")) {
    return finalPath.includes(expected.split("#")[1] || "");
  }
  return true;
}

export async function runRouteRedirectCert(): Promise<RouteRedirectResult[]> {
  const baseUrl = resolveCertBaseUrl();
  const auth = await authenticateMasterUat(baseUrl);
  if (!auth.ok) {
    throw new Error("Route redirect cert requires authenticated session (DEV_AUTH_BYPASS=1 or credentials)");
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    baseURL: baseUrl,
    storageState: auth.storageState,
  });
  const page = await context.newPage();
  const results: RouteRedirectResult[] = [];

  for (const sample of APPT_LEGACY_REDIRECT_SAMPLES) {
    const expected = resolveLegacyAppointmentsRedirect(sample.from);
    try {
      const health = await page.request.get("/api/health").catch(() => null);
      if (!health?.ok()) {
        throw new Error("Server unreachable before navigation (TEST_ENVIRONMENT)");
      }
      await page.goto(sample.from, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForTimeout(2000);
      const finalUrl = page.url();
      const finalPath = normalizePath(finalUrl);
      const ok = pathsMatch(finalPath, expected);
      results.push({
        from: sample.from,
        expected,
        finalUrl: finalPath,
        status: ok ? "PASS" : "FAIL_ROUTE",
        detail: ok ? "Redirect landed on canonical destination" : `Expected ${expected}, got ${finalPath}`,
      });
    } catch (err) {
      results.push({
        from: sample.from,
        expected,
        finalUrl: "",
        status: "FAIL_ROUTE",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  await browser.close();
  return results;
}

export function writeRouteRedirectAudit(results: RouteRedirectResult[], outPath: string) {
  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.length - pass;
  const lines = [
    "# Appointments Browser Route Compatibility Audit (8H-1)",
    "",
    `**Generated:** ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
    `- **Samples tested:** ${results.length}`,
    `- **PASS:** ${pass}`,
    `- **FAIL_ROUTE:** ${fail}`,
    "",
    "## Results",
    "",
    "| Legacy URL | Expected canonical | Final URL | Status | Detail |",
    "|------------|------------------|-----------|--------|--------|",
    ...results.map(
      (r) =>
        `| \`${r.from}\` | \`${r.expected}\` | \`${r.finalUrl}\` | ${r.status} | ${r.detail.replace(/\|/g, "\\|")} |`,
    ),
    "",
  ];
  mkdirSync(join(outPath, ".."), { recursive: true });
  writeFileSync(outPath, lines.join("\n"));
}
