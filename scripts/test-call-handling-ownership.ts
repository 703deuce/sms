#!/usr/bin/env tsx
/**
 * Call Handling ownership layer — focused unit tests (no Telnyx).
 * npx tsx scripts/test-call-handling-ownership.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  hasExplicitCallHandlingSelection,
  mergeCallHandlingIntoSettings,
  readCallHandlingBlock,
} from "../src/lib/call-handling/phone-settings";
import { shouldShowCallHandlingSwitcher } from "../src/lib/call-handling/show-switcher";

assert.deepEqual(readCallHandlingBlock({}), {
  activeCallHandler: null,
  parkedAiReceptionistAgentId: null,
  explicitSelectionAt: null,
  lastSwitchAt: null,
  lastSwitchByUserId: null,
});

const merged = mergeCallHandlingIntoSettings(
  { voiceEnabled: true },
  {
    activeCallHandler: "mctb",
    parkedAiReceptionistAgentId: "agent-123",
    explicitSelectionAt: "2026-01-01T00:00:00.000Z",
  },
);
assert.equal(readCallHandlingBlock(merged).activeCallHandler, "mctb");
assert.equal(readCallHandlingBlock(merged).parkedAiReceptionistAgentId, "agent-123");
assert.equal(hasExplicitCallHandlingSelection(merged), true);
assert.equal(hasExplicitCallHandlingSelection({ callHandling: { activeCallHandler: "mctb" } }), false);

assert.equal(shouldShowCallHandlingSwitcher({ hasMctb: true, hasVoice: true }), true);
assert.equal(shouldShowCallHandlingSwitcher({ hasMctb: true, hasVoice: false }), false);

const switcherSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/call-handling/set-active-call-handler.ts"),
  "utf8",
);
assert.ok(
  switcherSource.includes("routePhoneToVoiceV3BasicCallControl"),
  "AI switch must use Voice V3 Basic Call Control",
);
assert.ok(
  !switcherSource.includes("routePhoneToTexmlAssistant"),
  "AI switch must NOT use routePhoneToTexmlAssistant",
);
assert.ok(
  switcherSource.includes("routePhoneToMctbCallHandlingIngress"),
  "MCTB switch must use non-destructive MCTB TeXML route",
);
assert.ok(
  !switcherSource.includes("switchDidToMctbTexmlIngress"),
  "MCTB switch must NOT use destructive switchDidToMctbTexmlIngress",
);

const publishGate = fs.readFileSync(
  path.join(process.cwd(), "src/lib/call-handling/publish-gate.ts"),
  "utf8",
);
assert.ok(publishGate.includes('activeCallHandler === "mctb"'));

console.log("test-call-handling-ownership: PASS");
