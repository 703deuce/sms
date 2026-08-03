/**
 * Offline checks for channel readiness separation (voice vs A2P SMS).
 * Run: npx tsx scripts/test-number-provision-readiness.ts
 */

import assert from "assert";

function computeFullyProvisioned(input: {
  voiceOk: boolean;
  outboundOk: boolean;
  smsCapable: boolean;
  messagingProfileConfigured: boolean;
  smsSendingEnabled: boolean;
}) {
  // Infrastructure only — SMS send must not be required.
  return (
    input.voiceOk &&
    input.outboundOk &&
    (!input.smsCapable || input.messagingProfileConfigured)
  );
}

assert.equal(
  computeFullyProvisioned({
    voiceOk: true,
    outboundOk: true,
    smsCapable: true,
    messagingProfileConfigured: true,
    smsSendingEnabled: false,
  }),
  true,
  "A2P pending must not block fullyProvisioned",
);

assert.equal(
  computeFullyProvisioned({
    voiceOk: true,
    outboundOk: true,
    smsCapable: true,
    messagingProfileConfigured: false,
    smsSendingEnabled: false,
  }),
  false,
  "SMS-capable numbers still need Messaging Profile for infrastructure",
);

assert.equal(
  computeFullyProvisioned({
    voiceOk: true,
    outboundOk: true,
    smsCapable: false,
    messagingProfileConfigured: false,
    smsSendingEnabled: false,
  }),
  true,
  "Voice-only numbers do not require Messaging Profile",
);

assert.equal(
  computeFullyProvisioned({
    voiceOk: true,
    outboundOk: false,
    smsCapable: true,
    messagingProfileConfigured: true,
    smsSendingEnabled: true,
  }),
  false,
  "Outbound voice required for fullyProvisioned",
);

console.log("number provision readiness checks passed");
