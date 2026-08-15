/**
 * Number product preprod gate — hermetic checks for launch scope.
 * Run: npm run test:number-product-preprod
 */

import { spawnSync } from "child_process";
import assert from "assert";
import { existsSync } from "fs";
import { join } from "path";

const root = join(__dirname, "..");

function run(cmd: string, args: string[]) {
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8", shell: false });
  if (r.status !== 0) {
    console.error(r.stdout);
    console.error(r.stderr);
    throw new Error(`${cmd} ${args.join(" ")} failed`);
  }
}

const requiredFiles = [
  "src/lib/numbers/acquire-guard.ts",
  "src/lib/numbers/release-service.ts",
  "src/lib/numbers/state-service.ts",
  "src/lib/numbers/purchase-service.ts",
  "src/lib/payments/number-payment-provider.ts",
  "src/app/api/numbers/premium/complete/route.ts",
];

for (const f of requiredFiles) {
  assert.ok(existsSync(join(root, f)), `missing ${f}`);
}

run("npx", ["tsx", "scripts/test-number-product-lifecycle.ts"]);
run("npx", ["tsx", "scripts/test-smart-routing-compiler.ts"]);

console.log("number product preprod gate: PASS (hermetic)");

if (process.env.NUMBER_PRODUCT_LIVE_TEST === "1") {
  console.log("NUMBER_PRODUCT_LIVE_TEST=1 — run smart-routing-preprod with Telnyx env separately");
}
