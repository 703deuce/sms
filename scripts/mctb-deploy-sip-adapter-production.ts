#!/usr/bin/env npx tsx
/**
 * One-shot production cutover for MCTB Asterisk SIP adapter.
 * Runs Telnyx FQDN + 866 assignment from the cloud agent (no manual docker/SSH).
 *
 *   npx tsx scripts/mctb-deploy-sip-adapter-production.ts
 *   npx tsx scripts/mctb-deploy-sip-adapter-production.ts --apply
 */
import { execSync } from "node:child_process";

const apply = process.argv.includes("--apply");
const e164 = process.argv.find((a) => a.startsWith("+")) || "+18663464256";

function run(cmd: string) {
  console.log(`\n$ ${cmd}\n`);
  execSync(cmd, { stdio: "inherit", env: process.env });
}

async function main() {
  console.log("MCTB SIP adapter production deploy");
  console.log(`  apply: ${apply}`);
  console.log(`  e164:  ${e164}`);
  console.log("");
  console.log("Deploy model: transovo-mctb-sip Coolify app (mctb-sip-adapter/Dockerfile, host network).");
  console.log("transovo-voice stays LiveKit-only — redeploy voice after merge to fix broken Asterisk apt build.");
  console.log("SIP target: voice.transovo.ai:5070 (no new DNS — LiveKit keeps :5060).");
  console.log("");

  if (!process.env.TELNYX_API_KEY?.trim()) {
    throw new Error("TELNYX_API_KEY required");
  }

  run(`npx tsx scripts/test-mctb-sip-adapter-scaffold.ts`);

  const telnyxArgs = [
    "NODE_OPTIONS='--import ./scripts/preload-server-only.mjs'",
    "npx tsx scripts/mctb-point-fqdn-to-sip-adapter.ts",
    `--e164 ${e164}`,
    apply ? "--apply" : "",
  ]
    .filter(Boolean)
    .join(" ");

  run(telnyxArgs);

  if (!apply) {
    console.log("\nDry run complete. Re-run with --apply to cut over Telnyx.");
    console.log(
      "Ensure transovo-mctb-sip Coolify app is deployed (host network) — see docs/deployment-mctb-sip-adapter.md.",
    );
    return;
  }

  console.log("\n✓ Telnyx cutover applied for", e164);
  console.log("After transovo-mctb-sip deploys, run: npm run test:mctb-sip-adapter-e2e");
  console.log("Certification: npx tsx scripts/mctb-certify-sip-adapter.ts");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
