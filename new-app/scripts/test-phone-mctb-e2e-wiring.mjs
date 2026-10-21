#!/usr/bin/env node
/**
 * End-to-end wiring checks for Phone-owned MCTB (no live Telnyx/DB required).
 * Run: npx tsx new-app/scripts/test-phone-mctb-e2e-wiring.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(root, "..");

function read(rel) {
  return readFileSync(path.join(appRoot, rel), "utf8");
}

// Nav: MCTB is not a top-level product anymore.
const nav = read("lib/nav.ts");
assert.doesNotMatch(nav, /key: 'mctb'/);
assert.match(nav, /missed-call-text-back/);

// Legacy /app/mctb URLs redirect into Phone.
const nextCfg = readFileSync(path.join(appRoot, "next.config.mjs"), "utf8");
assert.match(nextCfg, /\/app\/mctb/);
assert.match(nextCfg, /missed-call-text-back/);

// API + UI surface for settings.
assert.match(read("app/api/phone/mctb/route.ts"), /getPhoneMctbSettings/);
assert.match(read("components/phone/phone-mctb-settings.tsx"), /templateId/);
assert.match(read("components/phone/phone-mctb-settings.tsx"), /Recovery text template/);

// Runtime chain: missed call → pipeline → send.
assert.match(read("lib/server/mctb/pipeline.ts"), /processPhoneOwnedMctbMissedCall/);
assert.match(read("lib/server/mctb/send-recovery.ts"), /executeMctbRecoverySend/);
assert.match(read("lib/server/mctb/recovery-scheduler.ts"), /processDueMctbRecoverySends/);
assert.match(read("lib/server/jobs/mctb-jobs.ts"), /phone_mctb_recovery_send/);

// Hooks from phone ingress.
assert.match(read("lib/server/phone/calls-service.ts"), /schedulePhoneOwnedMctbIfMissed/);
assert.match(read("lib/server/phone/inbound-runtime.ts"), /schedulePhoneOwnedMctbIfMissed/);

// Platform SMS path.
assert.match(read("app/api/telnyx/messaging/route.ts"), /messaging/);
assert.match(read("lib/messaging/platform-mctb-inbound-dispatch.ts"), /dispatchPlatformMctbInboundSms/);

const { MCTB_FIRST_TEXT_TEMPLATE_ORDER } = await import("../lib/mctb/first-text-templates/registry.ts");
assert.equal(MCTB_FIRST_TEXT_TEMPLATE_ORDER.length, 5);

const { normalizeMctbConsentMode, MCTB_CONSENT_MODE_VERIFIED } = await import(
  "../lib/mctb/consent-mode.ts",
);
assert.equal(normalizeMctbConsentMode("press_1"), MCTB_CONSENT_MODE_VERIFIED);

console.log("test-phone-mctb-e2e-wiring: PASS");
