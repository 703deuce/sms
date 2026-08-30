/**
 * Workspace accessible numbers — dedupe + MCTB setup options.
 * Run: npx tsx scripts/test-workspace-accessible-numbers.ts
 */
import assert from "node:assert/strict";
import {
  loadMctbSetupPhoneOptions,
  loadWorkspaceAccessiblePhoneNumbers,
} from "../src/lib/numbers/workspace-accessible-numbers";

const WS = "ws_1";

async function main() {
  const accessible = await loadWorkspaceAccessiblePhoneNumbers(WS);
  const setupOptions = await loadMctbSetupPhoneOptions(WS);

  const e164Counts = accessible.reduce<Record<string, number>>((acc, n) => {
    acc[n.e164] = (acc[n.e164] || 0) + 1;
    return acc;
  }, {});
  const dupes = Object.entries(e164Counts).filter(([, c]) => c > 1);
  assert.equal(dupes.length, 0, `duplicate e164 in accessible list: ${JSON.stringify(dupes)}`);

  const setup571 = setupOptions.filter((n) => n.e164 === "+15714073615");
  assert.equal(
    setup571.length,
    1,
    `expected one 571 in setup dropdown, got ${setup571.length}: ${JSON.stringify(setup571)}`,
  );
  assert.equal(setup571[0]?.source, "owned");
  assert.equal(setup571[0]?.id, "cmsgtjms84g6l2h0o255w1e3v");

  assert.ok(
    !setupOptions.some((n) => String(n.status || "").toLowerCase() === "released"),
    "released numbers should not appear in MCTB setup options",
  );

  console.log("test-workspace-accessible-numbers: ok");
  console.log(
    "setup options:",
    setupOptions.map((n) => ({ id: n.id, e164: n.e164, source: n.source })),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
