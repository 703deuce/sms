#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import {
  isVoiceProductCustomerVisible,
  voiceCustomerHiddenRedirect,
  LAUNCH_PRODUCT_AVAILABILITY,
} from "../src/lib/products/launch-product-availability";

assert.equal(LAUNCH_PRODUCT_AVAILABILITY.mctb.customerVisible, true);
assert.equal(LAUNCH_PRODUCT_AVAILABILITY.voice.enabled, true);
assert.equal(LAUNCH_PRODUCT_AVAILABILITY.voice.customerVisible, false);

const prev = process.env.TRANSOVO_VOICE_CUSTOMER_VISIBLE;
delete process.env.TRANSOVO_VOICE_CUSTOMER_VISIBLE;
assert.equal(isVoiceProductCustomerVisible(), false);
assert.equal(voiceCustomerHiddenRedirect("/voice/receptionist"), "/mctb");
assert.equal(voiceCustomerHiddenRedirect("/voice/receptionist/edit"), "/mctb");
assert.equal(voiceCustomerHiddenRedirect("/voice/settings"), "/mctb");
assert.equal(voiceCustomerHiddenRedirect("/voice/testing"), "/mctb");
assert.equal(voiceCustomerHiddenRedirect("/voice/billing"), "/mctb");
assert.equal(voiceCustomerHiddenRedirect("/voice/setup"), "/mctb");
assert.equal(voiceCustomerHiddenRedirect("/voice/missed-calls/abc"), "/mctb");
assert.equal(voiceCustomerHiddenRedirect("/voice/agents/new"), "/mctb");
assert.equal(voiceCustomerHiddenRedirect("/mctb"), null);
assert.equal(voiceCustomerHiddenRedirect("/conversations"), null);
assert.equal(voiceCustomerHiddenRedirect("/api/voice/agents"), null);

process.env.TRANSOVO_VOICE_CUSTOMER_VISIBLE = "1";
assert.equal(isVoiceProductCustomerVisible(), true);
assert.equal(voiceCustomerHiddenRedirect("/voice/receptionist"), null);

if (prev === undefined) delete process.env.TRANSOVO_VOICE_CUSTOMER_VISIBLE;
else process.env.TRANSOVO_VOICE_CUSTOMER_VISIBLE = prev;

console.log("PASS launch-product-availability");
