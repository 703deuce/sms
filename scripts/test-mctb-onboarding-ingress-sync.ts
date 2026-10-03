import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  pickCanonicalWorkspaceIngressCandidate,
  type WorkspaceMctbIngressCandidate,
} from "../src/lib/mctb/provisioning/sync-canonical-workspace-ingress";

const candidates: WorkspaceMctbIngressCandidate[] = [
  { id: "older", e164: "+18886650298", purchasedAt: new Date("2025-01-01") },
  { id: "newer", e164: "+18889210403", purchasedAt: new Date("2025-02-01") },
];

assert.equal(
  pickCanonicalWorkspaceIngressCandidate(candidates, "+18886650298")?.id,
  "older",
);
assert.equal(pickCanonicalWorkspaceIngressCandidate(candidates, null)?.id, "older");
assert.equal(
  pickCanonicalWorkspaceIngressCandidate(candidates, "+18889210403")?.id,
  "older",
  "multiple ingress numbers always resolve to oldest",
);

const ensureSrc = readFileSync(
  resolve("src/lib/mctb/provisioning/ensure-workspace-ingress.ts"),
  "utf8",
);
assert.match(ensureSrc, /syncCanonicalMctbWorkspaceIngress/);

const trialSrc = readFileSync(resolve("src/lib/mctb/onboarding/trial-number.ts"), "utf8");
assert.match(trialSrc, /syncCanonicalMctbWorkspaceIngress/);

const provisionSrc = readFileSync(
  resolve("src/lib/mctb/provisioning/provision-workspace-toll-free-ingress.ts"),
  "utf8",
);
assert.match(provisionSrc, /syncCanonicalMctbWorkspaceIngress/);

console.log("test-mctb-onboarding-ingress-sync: ok");
