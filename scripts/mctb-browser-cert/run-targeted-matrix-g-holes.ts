/**
 * Run individual Matrix G holes only (AI Recovery, Voicemail, etc.).
 *
 * MCTB_PROD_CERT_BASE_URL=... MCTB_PROD_CERT_EMAIL=... \
 *   npx tsx scripts/mctb-browser-cert/run-targeted-matrix-g-holes.ts ai-recovery voicemail
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { authenticateMctbProd } from "./auth";
import {
  captureCertBaseline,
  restoreCertWorkspaceBaseline,
} from "./ui-persistence-helpers";
import {
  certAiRecoveryConfig,
  certVoicemailGreeting,
} from "./ui-settings-persistence-cert";

const BASE = process.env.MCTB_PROD_CERT_BASE_URL?.replace(/\/$/, "") || "";
const WORKSPACE_ID = process.env.MCTB_PROD_CERT_WORKSPACE_ID?.trim() || "ws_1";
const EMAIL =
  process.env.MCTB_PROD_CERT_EMAIL?.trim() ||
  process.env.ADMIN_EMAILS?.split(",")[0]?.trim() ||
  "";
const holes = process.argv.slice(2);

const RUNNERS: Record<string, typeof certAiRecoveryConfig> = {
  "ai-recovery": certAiRecoveryConfig,
  voicemail: certVoicemailGreeting,
};

async function main() {
  if (!BASE) throw new Error("Set MCTB_PROD_CERT_BASE_URL");
  if (!holes.length) {
    throw new Error(`Usage: ... run-targeted-matrix-g-holes.ts ${Object.keys(RUNNERS).join("|")}`);
  }
  mkdirSync("/opt/cursor/artifacts/mctb-browser-settings-cert", { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await authenticateMctbProd(context, BASE, WORKSPACE_ID, EMAIL);
  const page = await context.newPage();
  const baseline = captureCertBaseline(WORKSPACE_ID);
  const record = () => undefined;

  const results = [];
  for (const key of holes) {
    const fn = RUNNERS[key];
    if (!fn) throw new Error(`Unknown hole key: ${key}`);
    const r = await fn(page, BASE, WORKSPACE_ID, record);
    results.push(r);
    console.log(JSON.stringify(r));
  }

  await browser.close();
  restoreCertWorkspaceBaseline(baseline);

  const fail = results.filter((r) => r.status === "FAIL").length;
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
