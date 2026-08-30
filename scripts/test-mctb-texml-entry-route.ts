/**
 * Assert MCTB TeXML webhook returns valid XML (not HTML 404).
 *
 * Run: npx tsx scripts/test-mctb-texml-entry-route.ts
 */
import assert from "node:assert/strict";
import {
  preflightTexmlVoiceUrl,
  resolveMctbTexmlVoiceUrlCandidates,
} from "../src/lib/mctb/texml-ingress/preflight";

function assertParsesAsResponseXml(body: string) {
  const trimmed = body.trim();
  assert.ok(trimmed.includes("<Response>"), "body must include Response root");
  assert.ok(!trimmed.includes("<!DOCTYPE"), "body must not be HTML");
  assert.ok(!trimmed.includes("<html"), "body must not be HTML");
}

async function assertValidTexmlWebhook(name: string, url: string, required = false) {
  const result = await preflightTexmlVoiceUrl(url);
  console.log(JSON.stringify({ target: name, ...result }, null, 2));

  if (!result.ok) {
    if (required) {
      throw new Error(`${name} must return valid TeXML (got ${result.status})`);
    }
    return false;
  }

  assert.equal(result.status, 200, `${name} must return HTTP 200`);
  assert.ok(result.contentType?.includes("xml"), `${name} Content-Type must be xml`);
  assert.equal(result.isHtml, false, `${name} must not return HTML`);
  assert.ok(result.bodyPreview.includes("<Response>"), `${name} must include <Response>`);
  assert.ok(
    result.bodyPreview.trim().startsWith("<?xml") || result.bodyPreview.includes("<Response>"),
    `${name} body must be valid TeXML envelope`,
  );
  assertParsesAsResponseXml(result.bodyPreview);

  return true;
}

async function main() {
  const urls = resolveMctbTexmlVoiceUrlCandidates();
  const entryOk = await assertValidTexmlWebhook("mctb-entry", urls.entry, false);
  const sayOnlyOk = await assertValidTexmlWebhook("mctb-consent-say-only", urls.consentSayOnly, !entryOk);

  if (!entryOk && !sayOnlyOk) {
    console.error("FAIL: no TeXML voice_url candidate returned valid XML");
    process.exit(1);
  }

  console.log(
    entryOk
      ? "PASS: mctb-entry returns valid TeXML"
      : "PASS: fallback mctb-consent?say-only returns valid TeXML (mctb-entry not deployed yet)",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
