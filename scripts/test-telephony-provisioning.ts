/**
 * Offline tests for telephony provisioning helpers.
 * Run: npx tsx scripts/test-telephony-provisioning.ts
 */
import assert from "node:assert/strict";
import {
  parseDispatchAttributes,
  parseRoomMetadata,
  roomMetadataSchema,
} from "../src/lib/telephony/provisioning/metadata";

assert.equal(
  parseRoomMetadata(JSON.stringify({ toE164: "+18663464256" }))?.toE164,
  "+18663464256",
);

assert.equal(
  parseDispatchAttributes({
    "sip.trunkPhoneNumber": "+18663464256",
    "sip.phoneNumber": "+14155550100",
  })?.toE164,
  "+18663464256",
);

const partial = roomMetadataSchema.safeParse({ toE164: "+15715551234" });
assert.equal(partial.success, true);

console.log("telephony provisioning unit tests: PASS");
