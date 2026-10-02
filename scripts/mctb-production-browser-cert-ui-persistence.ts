/**
 * Matrix G — customer UI Save → backend → hard refresh → restore for editable MCTB settings.
 *
 * MCTB_PROD_CERT_BASE_URL=... MCTB_PROD_CERT_EMAIL=... \
 *   npx tsx scripts/mctb-production-browser-cert-ui-persistence.ts
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { loadSkipKeys, recordRow, type CertRow } from "./mctb-browser-cert/matrix";
import { authenticateMctbProd, healthSha } from "./mctb-browser-cert/auth";
import {
  captureCertBaseline,
  restoreCertWorkspaceBaseline,
} from "./mctb-browser-cert/ui-persistence-helpers";
import { runUiSettingsPersistenceCert } from "./mctb-browser-cert/ui-settings-persistence-cert";

const BASE = process.env.MCTB_PROD_CERT_BASE_URL?.replace(/\/$/, "") || "";
const WORKSPACE_ID = process.env.MCTB_PROD_CERT_WORKSPACE_ID?.trim() || "ws_1";
const EMAIL =
  process.env.MCTB_PROD_CERT_EMAIL?.trim() ||
  process.env.ADMIN_EMAILS?.split(",")[0]?.trim() ||
  "";
const ARTIFACT_DIR =
  process.env.MCTB_PROD_CERT_ARTIFACTS || "/opt/cursor/artifacts/mctb-ui-persistence-cert";
const MATRIX_PATH =
  process.env.MCTB_PROD_CERT_MATRIX_G ||
  join(process.cwd(), "docs/MCTB-UI-PERSISTENCE-CERT-RESULTS.md");

const G_MARKER = "## Matrix G — UI Save → backend → refresh";

function ensureMatrixHeader(sha: string) {
  if (existsSync(MATRIX_PATH) && readFileSync(MATRIX_PATH, "utf8").includes(G_MARKER)) return;
  const block = `
${G_MARKER}

**Production SHA:** ${sha}  
**Workspace:** ${WORKSPACE_ID}  
**Run:** ${new Date().toISOString()}

| Route | Page | Tab/Surface | Control | Browser Action | UI Result | Backend Result | Refresh Result | Runtime Result | Status | Defect/Fix |
|-------|------|-------------|---------|----------------|-----------|----------------|----------------|----------------|--------|------------|
`;
  writeFileSync(MATRIX_PATH, block, { flag: existsSync(MATRIX_PATH) ? "a" : "w" });
}

async function main() {
  if (!BASE) throw new Error("Set MCTB_PROD_CERT_BASE_URL");
  mkdirSync(ARTIFACT_DIR, { recursive: true });

  const sha = await healthSha(BASE);
  ensureMatrixHeader(sha);

  const skipKeys = loadSkipKeys(MATRIX_PATH);
  const rows: CertRow[] = [];
  const record = (row: CertRow) => {
    if (recordRow(MATRIX_PATH, row, skipKeys)) rows.push(row);
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await authenticateMctbProd(context, BASE, WORKSPACE_ID, EMAIL);
  const page = await context.newPage();
  const baseline = captureCertBaseline(WORKSPACE_ID);

  const results = await runUiSettingsPersistenceCert(page, BASE, WORKSPACE_ID, record);

  await page.screenshot({ path: join(ARTIFACT_DIR, "ui-persistence-final.png"), fullPage: true });
  await browser.close();

  try {
    restoreCertWorkspaceBaseline(baseline);
  } catch (e) {
    console.error("baseline restore failed", e);
  }

  const summary = {
    sha,
    workspaceId: WORKSPACE_ID,
    at: new Date().toISOString(),
    results,
    pass: results.filter((r) => r.status === "PASS").length,
    fail: results.filter((r) => r.status === "FAIL").length,
    skip: results.filter((r) => r.status === "SKIP").length,
  };
  writeFileSync(join(ARTIFACT_DIR, "ui-persistence-summary.json"), JSON.stringify(summary, null, 2));

  console.log(JSON.stringify(summary, null, 2));

  if (summary.fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
