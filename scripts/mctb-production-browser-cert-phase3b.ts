/**
 * Phase 3b — harness-corrected nav retry + notifications persistence + state-changing verification.
 * Harness-only fixes; product FAIL rows tagged FAIL — PRODUCT.
 *
 * MCTB_PROD_CERT_BASE_URL=... MCTB_PROD_CERT_EMAIL=... \
 *   npx tsx scripts/mctb-production-browser-cert-phase3b.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { authenticateMctbProd, healthSha } from "./mctb-browser-cert/auth";
import { recordRow, type CertRow } from "./mctb-browser-cert/matrix";
import { PHASE3_NAV_RETRY_CASES, retryGlobalNavLink } from "./mctb-browser-cert/harness-nav";
import { phase3bNotificationsPersistence } from "./mctb-browser-cert/phase3b-notifications";
import { phase3bStateChanging } from "./mctb-browser-cert/phase3b-state-changing";
import { attachHttpWatch } from "./mctb-browser-cert/live-exercise";

const BASE = process.env.MCTB_PROD_CERT_BASE_URL?.replace(/\/$/, "") || "";
const EMAIL =
  process.env.MCTB_PROD_CERT_EMAIL?.trim() ||
  process.env.ADMIN_EMAILS?.split(",")[0]?.trim() ||
  "";
const WORKSPACE_ID = process.env.MCTB_PROD_CERT_WORKSPACE_ID?.trim() || "ws_1";
const ARTIFACT_DIR = process.env.MCTB_PROD_CERT_ARTIFACTS || "/tmp/mctb-prod-browser-cert-phase3b";
const MATRIX_PATH =
  process.env.MCTB_PROD_CERT_PHASE3B_MATRIX ||
  join(process.cwd(), "docs/MCTB-PRODUCTION-BROWSER-CERTIFICATION-PHASE3B.md");

const rows: CertRow[] = [];
const skipKeys = new Set<string>();

function record(row: CertRow) {
  if (!recordRow(MATRIX_PATH, row, skipKeys)) return;
  rows.push(row);
}

async function main() {
  if (!BASE || !EMAIL) throw new Error("Set MCTB_PROD_CERT_BASE_URL and MCTB_PROD_CERT_EMAIL");
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  const sha = await healthSha(BASE);

  writeFileSync(
    MATRIX_PATH,
    `# MCTB Production Browser Certification — Phase 3b

**Production SHA:** ${sha}  
**Workspace:** ${WORKSPACE_ID}  
**Started:** ${new Date().toISOString()}

Non-product (do not fix in app): Phase 3 sidebar timeouts, clipboard denied, Base UI #31, React #418, superseded Analytics row.

| Route | Page | Tab/Surface | Control | Browser Action | UI Result | Backend Result | Refresh Result | Runtime Result | Status | Defect/Fix |
|-------|------|-------------|---------|----------------|-----------|----------------|----------------|----------------|--------|------------|
`,
  );

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  context.setDefaultTimeout(90_000);
  await authenticateMctbProd(context, BASE, WORKSPACE_ID, EMAIL);
  const page = await context.newPage();
  const httpErrors: string[] = [];
  attachHttpWatch(page, BASE, httpErrors);

  if (process.env.MCTB_PHASE3B_SKIP_NAV !== "1") {
    for (const c of PHASE3_NAV_RETRY_CASES) {
      await retryGlobalNavLink(page, BASE, c, record);
    }
  }

  const persistPage = await context.newPage();
  attachHttpWatch(persistPage, BASE, httpErrors);
  try {
    await phase3bNotificationsPersistence(persistPage, BASE, record);
  } catch (e) {
    record({
      route: "/mctb/notifications",
      page: "Notifications",
      tab: "3b",
      control: "Add recipient",
      browserAction: "click",
      uiResult: String(e).slice(0, 240),
      backendResult: "—",
      refreshResult: "—",
      effectiveRuntime: "—",
      status: "FAIL — HARNESS",
      defectFix: "dismiss overlay / dialog handling",
    });
  }
  try {
    await phase3bStateChanging(persistPage, BASE, record);
  } catch (e) {
    record({
      route: "—",
      page: "3b state-changing",
      tab: "3b",
      control: "runner",
      browserAction: "phase3bStateChanging",
      uiResult: String(e).slice(0, 240),
      backendResult: "—",
      refreshResult: "—",
      effectiveRuntime: "—",
      status: "FAIL — HARNESS",
      defectFix: "navigation",
    });
  }

  await persistPage.close().catch(() => undefined);
  await browser.close();

  const productFails = rows.filter((r) => r.status.includes("FAIL — PRODUCT"));
  const harnessFails = rows.filter((r) => r.status.includes("FAIL — HARNESS"));
  const pass = rows.filter((r) => r.status.startsWith("PASS")).length;

  const summary = {
    sha,
    rows: rows.length,
    pass,
    failProduct: productFails.length,
    failHarness: harnessFails.length,
    productFailures: productFails.map((r) => ({
      route: r.route,
      control: r.control,
      ui: r.uiResult,
      backend: r.backendResult,
    })),
    harnessFailures: harnessFails.map((r) => ({ route: r.route, control: r.control, ui: r.uiResult })),
  };

  writeFileSync(join(ARTIFACT_DIR, "phase3b-summary.json"), JSON.stringify(summary, null, 2));
  writeFileSync(
    MATRIX_PATH,
    `${readFileSync(MATRIX_PATH, "utf8")}\n## Summary\n\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\`\n`,
  );
  console.log(JSON.stringify(summary, null, 2));
  process.exit(productFails.length > 0 || harnessFails.length > 0 ? 2 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
