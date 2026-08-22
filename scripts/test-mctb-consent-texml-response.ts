/**
 * Unit checks for MCTB TeXML response builder (no HTTP).
 * Run: npx tsx scripts/test-mctb-consent-texml-response.ts
 */
import assert from "node:assert/strict";
import {
  buildMctbConsentInboundTexml,
  wrapMctbConsentTexmlBody,
} from "../src/lib/mctb/consent-prompt/texml-response";

process.env.APP_URL = "https://app.example.com";
process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";

const sampleForwarder = process.env.MCTB_TEST_FORWARDED_FROM || "+15714776175"; // pragma: allowlist secret

const built = buildMctbConsentInboundTexml(sampleForwarder);
const xml = wrapMctbConsentTexmlBody(built.body);

assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
assert.match(xml, /<Gather[^>]*action="https:\/\/app\.example\.com\/api\/telnyx\/voice\/mctb-consent\?event=gather/);
assert.match(xml, /forwardedFrom=%2B15714776175|forwardedFrom=%2B1/);
assert.match(xml, /<Say voice="female">/);
assert.equal(built.usesGather, true);
assert.equal(built.usesSay, true);
assert.equal(built.usesPlay, false);
assert.match(built.audioUrl, /^https:\/\/app\.example\.com\/api\/public\/smart-routing-audio\//);

process.env.MCTB_CONSENT_TEXML_PROMPT = "say-only";
const sayOnly = buildMctbConsentInboundTexml(sampleForwarder);
assert.equal(sayOnly.promptMode, "say-only");
assert.equal(sayOnly.usesGather, false);
assert.match(wrapMctbConsentTexmlBody(sayOnly.body), /Press 1 to receive a text/);

console.log("test-mctb-consent-texml-response: ok");
