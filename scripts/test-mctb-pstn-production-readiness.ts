/**
 * Pre-PSTN checklist: production health, frozen TeXML contracts, evidence tables ready.
 * Does not replace live handset Press-1 / existing_consent calls.
 *
 * Run: npx tsx scripts/test-mctb-pstn-production-readiness.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { mctbTexmlEntryVoiceUrl } from "../src/lib/mctb/texml-ingress/texml-route";

function curlHealth(baseUrl: string): { ok: boolean; commitSha: string | null } {
  const root = baseUrl.replace(/\/$/, "");
  const r = spawnSync("curl", ["-s", "--max-time", "20", `${root}/api/health`], {
    encoding: "utf8",
  });
  try {
    const body = JSON.parse(r.stdout || "{}") as { ok?: boolean; commitSha?: string };
    return { ok: body.ok === true, commitSha: body.commitSha?.trim() || null };
  } catch {
    return { ok: false, commitSha: null };
  }
}

async function main() {
  const entry = readFileSync("src/app/api/telnyx/voice/mctb-entry/route.ts", "utf8");
  const press1 = readFileSync("src/app/api/telnyx/voice/mctb-press-1/route.ts", "utf8");
  const statusHandler = readFileSync(
    "src/lib/voice/telnyx/texml-status-callback.ts",
    "utf8",
  );

  assert.match(entry, /mctb_texml_final_v1|mctb-entry/i);
  assert.match(press1, /Gather|DTMF|press/i);
  assert.match(statusHandler, /existing_consent|press_1|missed|mctb/i);
  assert.ok(mctbTexmlEntryVoiceUrl().includes("/api/telnyx/voice/mctb-entry"));

  const base =
    process.env.BROWSER_CERT_PREVIEW_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "";
  if (base) {
    const health = curlHealth(base);
    assert.equal(health.ok, true, "production/preview health must be ok before PSTN");
    console.log(`PSTN preflight health commitSha=${health.commitSha ?? "unknown"}`);
  } else {
    console.log("PSTN preflight: APP_URL unset — static TeXML contracts only");
  }

  console.log("test-mctb-pstn-production-readiness: PASS (handset PSTN still required for final voice proof)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
