/**
 * Fresh-workspace ingress provisioning contracts (static + optional DB idempotency).
 *
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-trial-ingress-provision-contract.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const trialSrc = readFileSync(resolve("src/lib/mctb/onboarding/trial-number.ts"), "utf8");
const onboardingApi = readFileSync(resolve("src/app/api/mctb/onboarding/route.ts"), "utf8");
const numbersApi = readFileSync(resolve("src/app/api/mctb/numbers/route.ts"), "utf8");
const texmlProvision = readFileSync(
  resolve("src/lib/mctb/texml-ingress/texml-mode-provision.ts"),
  "utf8",
);

assert.match(
  trialSrc,
  /if \(existing\.provisioned && existing\.trialNumber\)/,
  "trial TFN provision must short-circuit when workspace already has ingress",
);
assert.match(trialSrc, /provisionMctbCustomerTelnyxLocalNumber/, "default trial path uses Telnyx local");
assert.match(texmlProvision, /mctbTexmlEntryVoiceUrl/, "save-time ingress must bind frozen mctb-entry URL");
assert.match(onboardingApi, /provisionTrialMctbNumber/, "onboarding must request trial ingress");
assert.match(numbersApi, /provisionTrialMctbNumber/, "numbers API must request trial ingress");

async function main() {
  console.log("test-mctb-trial-ingress-provision-contract: PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
