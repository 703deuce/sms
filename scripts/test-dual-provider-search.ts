/**
 * Hermetic tests for dual-provider number search (no live API calls).
 */
import { dedupeCandidatesByE164, resolvePhoneNumberProvider } from "../src/lib/numbers/providers/normalize";
import type { NormalizedNumberCandidate } from "../src/lib/numbers/providers/types";
import { scoreCandidate, sortCandidates } from "../src/lib/premium-numbers/scoring";
import { buildKeywordEntries } from "../src/lib/premium-numbers/industry-keywords";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function sampleCandidate(
  e164: string,
  provider: "telnyx" | "twilio",
): NormalizedNumberCandidate {
  return {
    e164,
    nationalNumber: e164.replace(/\D/g, "").slice(-10),
    provider,
    providerReference: `${provider}-ref`,
    monthlyCost: "1.00",
    upfrontCost: null,
    currency: "USD",
    locality: null,
    region: null,
    rateCenter: null,
    capabilities: { voice: true, sms: true, mms: true },
    raw: {},
  };
}

function testDedupePrefersTelnyx() {
  const a = sampleCandidate("+15714073615", "twilio");
  const b = sampleCandidate("+15714073615", "telnyx");
  const out = dedupeCandidatesByE164([a, b]);
  assert(out.length === 1, "dedupe should collapse to one");
  assert(out[0].provider === "telnyx", "telnyx should win dedupe");
}

function testDedupeKeepsDistinctE164() {
  const a = sampleCandidate("+15714073615", "twilio");
  const b = sampleCandidate("+15714073616", "telnyx");
  const out = dedupeCandidatesByE164([a, b]);
  assert(out.length === 2, "distinct e164 should remain");
}

function testProviderSurvivesScoring() {
  const keywords = buildKeywordEntries({ customKeywords: ["lawyer"] });
  const scored = scoreCandidate({
    phoneNumber: "+15715269379",
    keywords,
    provider: "twilio",
    providerReference: "PN123",
    rawTelnyx: {},
  });
  assert(scored?.provider === "twilio", "provider should survive scoring");
  assert(scored?.providerReference === "PN123", "providerReference should survive scoring");
  const ranked = sortCandidates([scored!]);
  assert(ranked[0].provider === "twilio", "provider should survive ranking");
}

function testResolveProviderFromTwilioSid() {
  assert(
    resolvePhoneNumberProvider({ twilioSid: "PNabc", providerNumberId: "id" }) === "twilio",
    "twilioSid should imply twilio when explicit provider missing",
  );
  assert(
    resolvePhoneNumberProvider({ provider: "telnyx", twilioSid: null, providerNumberId: "telnyx-id" }) ===
      "telnyx",
    "explicit telnyx provider should win",
  );
}

function main() {
  testDedupePrefersTelnyx();
  testDedupeKeepsDistinctE164();
  testProviderSurvivesScoring();
  testResolveProviderFromTwilioSid();
  console.log("dual-provider search tests: PASS");
}

main();
