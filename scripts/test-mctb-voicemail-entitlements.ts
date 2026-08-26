/**
 * MCTB bundles voicemail inbox + AI transcription with the core product.
 * Run: npx tsx scripts/test-mctb-voicemail-entitlements.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const entitlementsSrc = readFileSync(
  resolve("src/lib/products/feature-entitlements.ts"),
  "utf8",
);
const transcriptionSrc = readFileSync(resolve("src/lib/transcription/service.ts"), "utf8");
const voicemailRecordSrc = readFileSync(
  resolve("src/lib/voice/python-runtime-bridge/mctb-sip-voicemail-record.ts"),
  "utf8",
);

assert.match(
  entitlementsSrc,
  /MCTB bundles short voicemail capture \+ AI transcription/,
  "MCTB must bundle visual_voicemail and ai_transcription",
);

assert.match(
  transcriptionSrc,
  /input\.sourceType === "voicemail_message"/,
  "voicemail transcription must bypass paid add-on gates",
);

assert.match(
  voicemailRecordSrc,
  /transcriptStatus: "pending"/,
  "MCTB SIP voicemail messages must always queue transcription",
);

console.log("test-mctb-voicemail-entitlements: ok");
