/**
 * Full MCTB browser settings certification:
 * - Matrix G (UI Save → backend → refresh) except notifications (use stable H variant)
 * - Matrix H (remaining settings not covered by main 27-row cert)
 *
 * MCTB_PROD_CERT_BASE_URL=... MCTB_PROD_CERT_EMAIL=... \
 *   npm run test:mctb-browser-settings-cert
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
import {
  certAiRecoveryConfig,
  certCooldownMaxMessages,
  certMissedCallTriggerRules,
  certPhoneMetadata,
  certSenderMode,
  certTextBackTemplateAndDelay,
  certVoicemailGreeting,
} from "./mctb-browser-cert/ui-settings-persistence-cert";
import { runUiSettingsPersistenceRemaining } from "./mctb-browser-cert/ui-settings-persistence-remaining";
import type { UiPersistenceHoleResult } from "./mctb-browser-cert/ui-persistence-helpers";

const BASE = process.env.MCTB_PROD_CERT_BASE_URL?.replace(/\/$/, "") || "";
const WORKSPACE_ID = process.env.MCTB_PROD_CERT_WORKSPACE_ID?.trim() || "ws_1";
const EMAIL =
  process.env.MCTB_PROD_CERT_EMAIL?.trim() ||
  process.env.ADMIN_EMAILS?.split(",")[0]?.trim() ||
  "";
const ARTIFACT_DIR =
  process.env.MCTB_PROD_CERT_ARTIFACTS || "/opt/cursor/artifacts/mctb-browser-settings-cert";
const MATRIX_PATH =
  process.env.MCTB_PROD_CERT_MATRIX_FULL ||
  join(process.cwd(), "docs/MCTB-BROWSER-SETTINGS-FULL-CERT-RESULTS.md");

const FULL_MARKER = "## Matrix G+H — Full browser settings persistence";

function ensureMatrixHeader(sha: string) {
  if (existsSync(MATRIX_PATH) && readFileSync(MATRIX_PATH, "utf8").includes(FULL_MARKER)) return;
  const block = `
${FULL_MARKER}

**Production SHA:** ${sha}  
**Workspace:** ${WORKSPACE_ID}  
**Run:** ${new Date().toISOString()}

| Route | Page | Tab/Surface | Control | Browser Action | UI Result | Backend Result | Refresh Result | Runtime Result | Status | Defect/Fix |
|-------|------|-------------|---------|----------------|-----------|----------------|----------------|----------------|--------|------------|
`;
  writeFileSync(MATRIX_PATH, block, { flag: existsSync(MATRIX_PATH) ? "a" : "w" });
}

async function runHole(
  hole: string,
  fn: () => Promise<UiPersistenceHoleResult>,
): Promise<UiPersistenceHoleResult> {
  console.log(`[settings-cert] start: ${hole}`);
  try {
    const result = await fn();
    console.log(`[settings-cert] done: ${hole} → ${result.status} (${result.detail})`);
    return result;
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.log(`[settings-cert] done: ${hole} → FAIL (${detail})`);
    return { hole, status: "FAIL", detail };
  }
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

  const matrixG: UiPersistenceHoleResult[] = [
    await runHole("Missed-call trigger rules", () =>
      certMissedCallTriggerRules(page, BASE, WORKSPACE_ID, record),
    ),
    await runHole("Text-back template/delay", () =>
      certTextBackTemplateAndDelay(page, BASE, WORKSPACE_ID, record),
    ),
    await runHole("Cooldown/max messages", () =>
      certCooldownMaxMessages(page, BASE, WORKSPACE_ID, record),
    ),
    await runHole("Phone/business-line metadata", () =>
      certPhoneMetadata(page, BASE, WORKSPACE_ID, record),
    ),
    await runHole("Voicemail greeting/settings", () =>
      certVoicemailGreeting(page, BASE, WORKSPACE_ID, record),
    ),
    await runHole("AI Recovery configuration", () =>
      certAiRecoveryConfig(page, BASE, WORKSPACE_ID, record),
    ),
    await runHole("Sender mode", () => certSenderMode(page, BASE, WORKSPACE_ID, record)),
  ];

  const matrixH = await runUiSettingsPersistenceRemaining(page, BASE, WORKSPACE_ID, record, {
    includeProvenRegistry: true,
  });

  const results = [...matrixG, ...matrixH];

  await page.screenshot({ path: join(ARTIFACT_DIR, "settings-full-final.png"), fullPage: true });
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
    matrixGCount: matrixG.length,
    matrixHCount: matrixH.length,
    results,
    pass: results.filter((r) => r.status === "PASS").length,
    fail: results.filter((r) => r.status === "FAIL").length,
    skip: results.filter((r) => r.status === "SKIP").length,
  };
  writeFileSync(join(ARTIFACT_DIR, "settings-full-summary.json"), JSON.stringify(summary, null, 2));

  console.log(JSON.stringify(summary, null, 2));

  if (summary.fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
