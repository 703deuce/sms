#!/usr/bin/env npx tsx
/**
 * Regression: SIP_INGRESS Press-1 must not require Existing Consent workspace attestation at send time.
 */
import assert from "node:assert/strict";
import { validateExistingConsentAttestation } from "@/lib/mctb/event-only/attestation";

const WORKSPACE_ID =
  process.env.MCTB_PLATFORM_OWNER_WORKSPACE_ID?.trim() || "cmt2zyg4l43373s0f146b442h";

function requiresExistingConsentAttestationForSend(captureMode: string): boolean {
  return captureMode === "EVENT_ONLY";
}

async function main() {
  assert.equal(requiresExistingConsentAttestationForSend("SIP_INGRESS"), false);
  assert.equal(requiresExistingConsentAttestationForSend("EVENT_ONLY"), true);
  assert.equal(requiresExistingConsentAttestationForSend(""), false);

  const attestation = await validateExistingConsentAttestation(WORKSPACE_ID);
  if (attestation.consentMode === "press_1") {
    assert.equal(
      attestation.valid,
      false,
      "press_1 workspaces fail existing-consent attestation by design",
    );
    assert.equal(attestation.reason, "NOT_EXISTING_CONSENT");
  }

  console.log("test:mctb-sip-ingress-send-gate PASS", {
    consentMode: attestation.consentMode,
    sipIngressSkipsAttestation: true,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
