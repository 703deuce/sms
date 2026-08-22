/**
 * Run: npx tsx scripts/test-telnyx-forwarded-from.ts
 */
import assert from "node:assert/strict";
import {
  parseTelnyxForwardedFrom,
  normalizeForwardedFromE164,
} from "../src/lib/voice/telnyx/forwarded-from";

assert.equal(
  parseTelnyxForwardedFrom({ forwarded_from: "+15405551234" }),
  "+15405551234",
);

assert.equal(
  normalizeForwardedFromE164("sip:+15405551234@one.att.net"),
  "+15405551234",
);

assert.equal(
  parseTelnyxForwardedFrom({ ForwardedFrom: "sip:+15405551234@one.att.net" }),
  "+15405551234",
);

assert.equal(
  parseTelnyxForwardedFrom({
    sip_headers: [
      {
        name: "Diversion",
        value:
          "<sip:+15405551234@one.att.net;user=phone>;privacy=\"off\";reason=no-answer;counter=1",
      },
    ],
  }),
  "+15405551234",
);

assert.equal(parseTelnyxForwardedFrom({ sip_headers: [] }), undefined);

console.log("test-telnyx-forwarded-from: ok");
