#!/usr/bin/env npx tsx
/**
 * Lock check: repo + Telnyx config match VOICE_V2_KNOWN_GOOD_BASELINE.
 *
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 * npx tsx scripts/certify-voice-v2-known-good-baseline.ts
 *
 * Optional: REQUIRE_BASELINE_COMMIT=1 fails if HEAD !== 06125f5f
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  VOICE_V2_KNOWN_GOOD_BASELINE,
  VOICE_V2_FROZEN_PATHS,
  VOICE_V2_BASELINE_REGRESSION,
} from "../src/lib/voice-receptionist-wizard/baseline-lock";
import {
  VOICE_V2_TELNYX_TOOL_NAME,
  VOICE_V2_BOOK_TELNYX_TOOL_NAME,
} from "../src/lib/voice-receptionist-wizard/telnyx-tool-definition";

const REQUIRE_COMMIT = process.env.REQUIRE_BASELINE_COMMIT === "1";

function headCommit(): string {
  return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
}

async function main() {
  const head = headCommit();
  const checks: Array<{ name: string; pass: boolean; detail: string }> = [];

  checks.push({
    name: "baseline_commit_documented",
    pass: VOICE_V2_KNOWN_GOOD_BASELINE.gitCommit.startsWith("06125f5f"),
    detail: VOICE_V2_KNOWN_GOOD_BASELINE.gitCommit,
  });

  if (REQUIRE_COMMIT) {
    checks.push({
      name: "head_matches_baseline",
      pass: head === VOICE_V2_KNOWN_GOOD_BASELINE.gitCommit,
      detail: `HEAD=${head}`,
    });
  } else {
    checks.push({
      name: "head_matches_baseline",
      pass: head.startsWith(VOICE_V2_KNOWN_GOOD_BASELINE.shortSha),
      detail: `HEAD=${head} (set REQUIRE_BASELINE_COMMIT=1 to enforce exact)`,
    });
  }

  for (const rel of VOICE_V2_FROZEN_PATHS) {
    const abs = join(process.cwd(), rel);
    checks.push({
      name: `frozen_path_exists:${rel}`,
      pass: existsSync(abs),
      detail: existsSync(abs) ? "ok" : "missing",
    });
  }

  let telnyxOk = false;
  try {
    const ai = await import("../src/lib/voice/telnyx/ai-client");
    const listed = await ai.listSharedTools();
    const tools = (listed as { data?: Array<{ id: string; display_name?: string }> }).data || [];
    const find = tools.some((t) => t.display_name === VOICE_V2_TELNYX_TOOL_NAME);
    const book = tools.some((t) => t.display_name === VOICE_V2_BOOK_TELNYX_TOOL_NAME);
    telnyxOk = find && book;
    checks.push({
      name: "telnyx_v2_shared_tools_present",
      pass: telnyxOk,
      detail: `find=${find} book=${book}`,
    });
  } catch (err) {
    checks.push({
      name: "telnyx_v2_shared_tools_present",
      pass: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  const mdPath = join(process.cwd(), "src/lib/voice-receptionist-wizard/KNOWN_GOOD_BASELINE.md");
  checks.push({
    name: "baseline_doc_present",
    pass: existsSync(mdPath),
    detail: mdPath,
  });

  console.log(`\n=== ${VOICE_V2_KNOWN_GOOD_BASELINE.label} ===\n`);
  console.log(`Commit: ${VOICE_V2_KNOWN_GOOD_BASELINE.gitCommit}`);
  console.log(`Certified PSTN: ${VOICE_V2_KNOWN_GOOD_BASELINE.certifiedPstnUtc}`);
  console.log(`Reference FIND WEBHOOK_TOTAL_MS: ${VOICE_V2_KNOWN_GOOD_BASELINE.referenceFindWebhookTotalMs}\n`);

  for (const c of checks) {
    console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.name}`);
    console.log(`       ${c.detail}\n`);
  }

  console.log("=== REGRESSION RUBRIC (manual PSTN after any change to frozen paths) ===");
  for (const r of VOICE_V2_BASELINE_REGRESSION) {
    console.log(`  ${r} .............. (verify on call)`);
  }

  console.log("\n=== OBSERVER-ONLY LINKAGE (not in baseline) ===");
  console.log("  VoiceAppointment.callId / appointmentBooked / telnyxConversationId — async after BOOK\n");

  const fail = checks.some((c) => !c.pass);
  if (fail) process.exit(1);
  console.log("BASELINE_LOCK: PASS (automated); run PSTN find+book before shipping frozen-path edits.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
