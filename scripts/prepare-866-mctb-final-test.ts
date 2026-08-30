/**
 * Prepare 866 for final MCTB cert tests (Telnyx voice_url + consent mode).
 *
 *   npx tsx scripts/prepare-866-mctb-final-test.ts press_1
 *   npx tsx scripts/prepare-866-mctb-final-test.ts existing_consent
 *
 * press_1        → cert C3: prerecorded audio + Gather press 1 + SMS
 * existing_consent → cert D: play audio + hangup + auto SMS on texml-status
 */
import { execSync } from "node:child_process";

const mode = (process.argv[2] || "press_1").trim().toLowerCase();
const WS = process.env.WORKSPACE_ID || "ws_1";

if (mode !== "press_1" && mode !== "existing_consent") {
  console.error("Usage: prepare-866-mctb-final-test.ts press_1|existing_consent");
  process.exit(1);
}

const nodeOpts = "NODE_OPTIONS='--import ./scripts/preload-server-only.mjs'";

function run(cmd: string) {
  console.log(`\n$ ${cmd}\n`);
  execSync(cmd, { stdio: "inherit", cwd: process.cwd(), env: process.env });
}

async function main() {
  run(`${nodeOpts} npx tsx scripts/disable-ws1-mctb-cooldown.ts`);
  run(`${nodeOpts} npx tsx scripts/lock-866-mctb-texml-db.ts`);
  run(
    `${nodeOpts} npx tsx scripts/mctb-set-workspace-consent-mode.ts --workspace-id ${WS} --mode ${mode}`,
  );

  const cert = mode === "press_1" ? "C3" : "D";
  run(`npx tsx scripts/set-866-mctb-cert-mode.ts ${cert}`);

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode,
        cert,
        expectedBehavior:
          mode === "press_1"
            ? "Hear prerecorded consent audio → press 1 → SMS from 571"
            : "Hear prerecorded audio → hangup → auto SMS (no press 1)",
        next: `Conditional-forward to 866 and test. Switch modes by re-running with the other argument.`,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
