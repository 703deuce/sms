import assert from "node:assert/strict";
import { transcriptSignalsBookingIntent } from "../lib/server/voice-v3/intake/booking-intent-from-transcript";
import { callerAffirmsBookingLinkToInboundNumber } from "../lib/server/voice-v3/intake/sms-to-inbound-affirmation";

assert.equal(transcriptSignalsBookingIntent("I need to book an appointment"), true);
assert.equal(transcriptSignalsBookingIntent("hello"), false);
assert.equal(callerAffirmsBookingLinkToInboundNumber("This number"), true);
assert.equal(callerAffirmsBookingLinkToInboundNumber("no thanks"), false);

console.log("PASS booking link caller-turn heuristics");
