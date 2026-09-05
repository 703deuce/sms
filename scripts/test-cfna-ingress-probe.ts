import assert from "node:assert/strict";
import {
  buildCfnaProbeEvent,
  extractCfnaIngressFields,
  isCfnaProbeDbEnabled,
  isWatchedCfnaDid,
  shouldProbeCfnaPayload,
} from "../src/lib/mctb/cfna-ingress-probe";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    throw err;
  }
}

test("watched DID includes new and old 571", () => {
  assert.equal(isWatchedCfnaDid("+15717491060"), true);
  assert.equal(isWatchedCfnaDid("+15714073615"), true);
  assert.equal(isWatchedCfnaDid("+15555550100"), false);
});

test("should probe when @one.att.net appears even on unknown DID", () => {
  assert.equal(
    shouldProbeCfnaPayload({ to: "+15555550100", FromSipUri: "sip:+15555550100@one.att.net" }),
    true,
  );
});

test("build probe flags programmable leg when CallSid present", () => {
  const event = buildCfnaProbeEvent({
    layer: "telnyx-voice-cc",
    eventType: "call.initiated",
    payload: {
      to: "+15714073615",
      from: "+15555550100",
      call_control_id: "v3:test",
      to_sip_uri: "+15714073615@one.att.net",
    },
  });
  assert.equal(event.forwardSignals.attNetInPayload, true);
  assert.equal(event.forwardSignals.hasCallControlId, true);
  assert.equal(event.forwardSignals.programmableLegLikely, true);
});

test("build probe marks failed texml hangup without CallSid", () => {
  const event = buildCfnaProbeEvent({
    layer: "texml-status",
    eventType: "texml.call.hangup",
    payload: {
      To: "+15717491060",
      CallDuration: "0",
      ToSipUri: "+15717491060@one.att.net",
    },
  });
  assert.equal(event.forwardSignals.hasCallControlId, false);
  assert.equal(event.forwardSignals.programmableLegLikely, false);
});

test("extract ingress fields captures request-uri and diversion", () => {
  const extracted = extractCfnaIngressFields({
    To: "+15717491060",
    From: "+15555550100",
    CallSid: "v3:test",
    ToSipUri: "+15717491060@one.att.net",
    sip_headers: [
      { name: "Diversion", value: "<sip:+14107900000@one.att.net>;reason=unconditional" },
    ],
  });
  assert.equal(extracted.requestUri, "+15717491060@one.att.net");
  assert.match(String(extracted.diversionHeader), /one\.att\.net/);
  assert.equal(extracted.hasDiversionHeader, true);
});

test("db probe enabled in dev by default", () => {
  const prevDb = process.env.MCTB_CFNA_PROBE_DB;
  const prevNode = process.env.NODE_ENV;
  delete process.env.MCTB_CFNA_PROBE_DB;
  process.env.NODE_ENV = "development";
  assert.equal(isCfnaProbeDbEnabled(), true);
  process.env.NODE_ENV = "production";
  assert.equal(isCfnaProbeDbEnabled(), false);
  if (prevDb) process.env.MCTB_CFNA_PROBE_DB = prevDb;
  else delete process.env.MCTB_CFNA_PROBE_DB;
  if (prevNode) process.env.NODE_ENV = prevNode;
  else delete process.env.NODE_ENV;
});

console.log("cfna-ingress-probe tests passed");
