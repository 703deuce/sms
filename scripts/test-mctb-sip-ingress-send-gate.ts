/**
 * MCTB send gate: SIP_INGRESS (Press-1) must not require Existing Consent attestation.
 * Run: npx tsx scripts/test-mctb-sip-ingress-send-gate.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve("src/lib/agents/missed-call-text-back/send.ts"),
  "utf8",
);

assert.match(
  source,
  /requiresExistingConsentAttestation\s*=\s*captureMode\s*===\s*["']EVENT_ONLY["']/,
  "attestation gate must only apply to EVENT_ONLY capture mode",
);

assert.match(
  source,
  /if\s*\(\s*requiresExistingConsentAttestation\s*\)/,
  "send worker must branch on requiresExistingConsentAttestation, not isEventOnly",
);

assert.doesNotMatch(
  source,
  /if\s*\(\s*isEventOnly\s*\)\s*\{[\s\S]*?validateExistingConsentAttestation/,
  "must not require attestation for SIP_INGRESS / isEventOnly broadly",
);

console.log("test-mctb-sip-ingress-send-gate: ok");
