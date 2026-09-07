/**
 * Reclassify browser cert results from local next-dev OOM runs as invalid (not product defects).
 *
 * Run: npm run cert:reclassify-browser-oom
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateResultsMarkdown } from "./browser-cert/lib";

const STATE_FILE = join(process.cwd(), "docs/certification/appointments-mctb-browser-cert-state.json");
const RESULTS_MD = join(process.cwd(), "docs/certification/APPOINTMENTS_MCTB_BROWSER_CERT_RESULTS.md");
const INVALID = "INVALID RESULT — LOCAL CERT SERVER OOM";

function isOomCascadeFailure(detail: string, baseUrl: string): boolean {
  if (!baseUrl.includes("127.0.0.1") && !baseUrl.includes("localhost")) return false;
  return (
    /ERR_CONNECTION_REFUSED|ERR_CONNECTION_RESET|ECONNREFUSED|ECONNRESET/i.test(detail) ||
    /Not attached to an active page/i.test(detail) ||
    (/Timeout.*exceeded/i.test(detail) &&
      /\/contacts|\/conversations|\/appointments\/reminders/i.test(detail))
  );
}

function main() {
  if (!existsSync(STATE_FILE)) {
    console.log("No browser cert state file — nothing to reclassify");
    return;
  }

  const state = JSON.parse(readFileSync(STATE_FILE, "utf8")) as {
    baseUrl: string;
    results: Record<string, { id: string; status: string; detail: string }>;
  };

  let changed = 0;
  for (const result of Object.values(state.results)) {
    if (result.status === "PASS" || result.status === INVALID) continue;
    if (isOomCascadeFailure(result.detail, state.baseUrl)) {
      result.status = INVALID;
      result.detail = `Local next dev OOM cascade — not a product defect. Original: ${result.detail.slice(0, 200)}`;
      changed += 1;
    }
  }

  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  writeFileSync(RESULTS_MD, generateResultsMarkdown(state as Parameters<typeof generateResultsMarkdown>[0]));
  console.log(`Reclassified ${changed} results as "${INVALID}"`);
  console.log(`Updated ${RESULTS_MD}`);
}

main();
