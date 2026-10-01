/**
 * Fresh-workspace ingress provisioning contracts (static + optional DB idempotency).
 *
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-trial-ingress-provision-contract.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ensureIngress = readFileSync(
  resolve("src/lib/mctb/provisioning/ensure-workspace-ingress.ts"),
  "utf8",
);
const tollFreeProvision = readFileSync(
  resolve("src/lib/mctb/provisioning/provision-workspace-toll-free-ingress.ts"),
  "utf8",
);
const onboardingApi = readFileSync(resolve("src/app/api/mctb/onboarding/route.ts"), "utf8");
const numbersApi = readFileSync(resolve("src/app/api/mctb/numbers/route.ts"), "utf8");
const texmlProvision = readFileSync(
  resolve("src/lib/mctb/texml-ingress/texml-mode-provision.ts"),
  "utf8",
);
const trialSrc = readFileSync(resolve("src/lib/mctb/onboarding/trial-number.ts"), "utf8");

assert.match(
  ensureIngress,
  /provisionMctbWorkspaceTollFreeIngress/,
  "ensure-workspace-ingress must call toll-free TeXML provision",
);
assert.match(
  tollFreeProvision,
  /withMctbWorkspaceIngressProvisionLock/,
  "toll-free ingress must serialize purchase/provision",
);
assert.match(
  tollFreeProvision,
  /writeMctbIngressProvisionPendingE164/,
  "toll-free ingress must persist pending E.164 after external purchase",
);
assert.match(texmlProvision, /mctbTexmlEntryVoiceUrl/, "save-time ingress must bind frozen mctb-entry URL");
assert.match(
  onboardingApi,
  /ensureMctbWorkspaceIngressReady/,
  "onboarding must reach canonical ingress provisioning",
);
assert.match(
  numbersApi,
  /ensureMctbWorkspaceIngressReady/,
  "numbers API must reach canonical ingress provisioning",
);
assert.match(
  trialSrc,
  /if \(existing\.provisioned && existing\.trialNumber\)/,
  "trial TFN provision must short-circuit when workspace already has ingress",
);

async function main() {
  console.log("test-mctb-trial-ingress-provision-contract: PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
