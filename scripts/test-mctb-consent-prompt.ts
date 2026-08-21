/**
 * MCTB Verified Consent prompt — unit checks for script/audio versioning.
 * Run: npx tsx scripts/test-mctb-consent-prompt.ts
 */
import assert from "node:assert/strict";
import {
  canPublishConsentPrompt,
  computeConsentScriptHash,
  defaultConsentPromptConfig,
} from "../src/lib/mctb/consent-prompt/store";
import { defaultMctbConsentScript } from "../src/lib/mctb/consent-prompt/defaults";

const base = defaultConsentPromptConfig("Acme Plumbing");
assert.match(base.scriptText, /Acme Plumbing/i);
assert.match(base.scriptText, /press 1/i);

const hash1 = computeConsentScriptHash(base.scriptText, base.voiceId, 1);
const hash2 = computeConsentScriptHash(
  defaultMctbConsentScript("Other"),
  base.voiceId,
  1,
);
assert.notEqual(hash1, hash2);

const ready = {
  ...base,
  audioAssetId: "asset_1",
  scriptHash: hash1,
  audioStatus: "ready" as const,
};
assert.equal(canPublishConsentPrompt(ready).ok, true);

const stale = { ...ready, audioStatus: "stale" as const };
assert.equal(canPublishConsentPrompt(stale).ok, false);

const mismatch = { ...ready, scriptText: "Changed script without regen" };
assert.equal(canPublishConsentPrompt(mismatch).ok, false);

console.log("test-mctb-consent-prompt: ok");
