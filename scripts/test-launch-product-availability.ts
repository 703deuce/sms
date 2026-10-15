#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import {
  isVoiceProductCustomerVisible,
  voiceCustomerHiddenRedirect,
  LAUNCH_PRODUCT_AVAILABILITY,
  mctbLaunchCustomerHome,
} from "../src/lib/products/launch-product-availability";

assert.equal(LAUNCH_PRODUCT_AVAILABILITY.mctb.customerVisible, true);
assert.equal(LAUNCH_PRODUCT_AVAILABILITY.voice.enabled, true);
assert.equal(LAUNCH_PRODUCT_AVAILABILITY.voice.customerVisible, true);

const prev = process.env.TRANSOVO_VOICE_CUSTOMER_VISIBLE;
delete process.env.TRANSOVO_VOICE_CUSTOMER_VISIBLE;
assert.equal(isVoiceProductCustomerVisible(), true);
assert.equal(voiceCustomerHiddenRedirect("/voice/receptionist"), null);
assert.equal(voiceCustomerHiddenRedirect("/voice/receptionist/edit"), null);
assert.equal(voiceCustomerHiddenRedirect("/mctb"), null);
assert.equal(voiceCustomerHiddenRedirect("/conversations"), null);
assert.equal(voiceCustomerHiddenRedirect("/api/voice/agents"), null);

process.env.TRANSOVO_VOICE_CUSTOMER_VISIBLE = "0";
assert.equal(isVoiceProductCustomerVisible(), false);
// Bundled MCTB voice-agent wizard stays reachable when Voice product is hidden.
assert.equal(voiceCustomerHiddenRedirect("/voice/receptionist"), null);
assert.equal(voiceCustomerHiddenRedirect("/voice/receptionist/edit"), null);
const hiddenVoiceHome = mctbLaunchCustomerHome();
assert.equal(voiceCustomerHiddenRedirect("/voice/calls"), hiddenVoiceHome);
assert.equal(voiceCustomerHiddenRedirect("/voice/settings"), hiddenVoiceHome);
assert.equal(voiceCustomerHiddenRedirect("/voice/testing"), hiddenVoiceHome);
assert.equal(voiceCustomerHiddenRedirect("/voice/billing"), hiddenVoiceHome);
assert.equal(voiceCustomerHiddenRedirect("/voice/setup"), hiddenVoiceHome);
assert.equal(voiceCustomerHiddenRedirect("/voice/missed-calls/abc"), hiddenVoiceHome);
assert.equal(voiceCustomerHiddenRedirect("/voice/agents/new"), hiddenVoiceHome);

process.env.TRANSOVO_VOICE_CUSTOMER_VISIBLE = "1";
assert.equal(isVoiceProductCustomerVisible(), true);
assert.equal(voiceCustomerHiddenRedirect("/voice/receptionist"), null);

if (prev === undefined) delete process.env.TRANSOVO_VOICE_CUSTOMER_VISIBLE;
else process.env.TRANSOVO_VOICE_CUSTOMER_VISIBLE = prev;

console.log("PASS launch-product-availability");
