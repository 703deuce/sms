#!/usr/bin/env node
/**
 * Fail the new-app production build if authority sync truncated Amy live tool contracts.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..");
const CONTRACTS = path.join(
  REPO_ROOT,
  "new-app/lib/server/voice-v3/tools/astra-tool-contracts.ts",
);

const REQUIRED_EXPORTS = [
  "COLLECT_CALLER_INTAKE_TOOL_DESCRIPTION",
  "TAKE_MESSAGE_TOOL_DESCRIPTION",
  "SEARCH_BUSINESS_KNOWLEDGE_TOOL_DESCRIPTION",
  "buildSendBookingLinkToolDescription",
];

const FORBIDDEN_PATH_FRAGMENTS = [
  "intake/booking-intent-from-transcript.ts",
  "intake/sms-to-inbound-affirmation.ts",
];

function fail(message) {
  console.error(`[verify-astra-contracts-sync] ${message}`);
  process.exit(1);
}

let text;
try {
  text = readFileSync(CONTRACTS, "utf8");
} catch {
  fail(`missing contracts file at ${CONTRACTS}`);
}

const lineCount = text.split("\n").length;
if (lineCount < 120) {
  fail(
    `astra-tool-contracts.ts looks truncated (${lineCount} lines) — authority sync may have overwritten full Amy contracts`,
  );
}

for (const exportName of REQUIRED_EXPORTS) {
  if (!text.includes(`export const ${exportName}`) && !text.includes(`export function ${exportName}`)) {
    fail(`missing required export ${exportName}`);
  }
}

for (const fragment of FORBIDDEN_PATH_FRAGMENTS) {
  const full = path.join(REPO_ROOT, "new-app/lib/server/voice-v3", fragment);
  try {
    readFileSync(full);
    fail(`rejected regex routing file still present: ${fragment}`);
  } catch {
    // expected absent
  }
}

console.log(
  JSON.stringify({
    event: "verify_astra_contracts_sync",
    ok: true,
    lineCount,
    requiredExports: REQUIRED_EXPORTS.length,
  }),
);
