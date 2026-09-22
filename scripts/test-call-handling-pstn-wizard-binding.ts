#!/usr/bin/env tsx
/**
 * Deterministic PSTN wizard binding for Call Handling ingress (pure + static guards).
 * npx tsx scripts/test-call-handling-pstn-wizard-binding.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { mergeCallHandlingIntoSettings } from "../src/lib/call-handling/phone-settings";
import {
  decideExplicitCallHandlingPstnBind,
  pickFirstPublishedReceptionistAgentId,
} from "../src/lib/voice-v3/pstn-wizard-agent-selection";

const AGENT_123 = "agent-123";
const AGENT_456 = "agent-456";

function aiIngressSettings(parkedId: string) {
  return mergeCallHandlingIntoSettings(
    {},
    {
      activeCallHandler: "ai_receptionist",
      parkedAiReceptionistAgentId: parkedId,
      explicitSelectionAt: "2026-09-22T00:00:00.000Z",
    },
  );
}

// Multiple receptionists: explicit #123 beats newer #456 in legacy order
const ingressSettings = aiIngressSettings(AGENT_123);
const explicit = decideExplicitCallHandlingPstnBind(ingressSettings);
assert.equal(explicit.useExplicit, true);
if (explicit.useExplicit) {
  assert.equal(explicit.agentId, AGENT_123);
}
const legacyPick = pickFirstPublishedReceptionistAgentId(
  [AGENT_456, AGENT_123],
  (id) => id === AGENT_456 || id === AGENT_123,
);
assert.equal(legacyPick, AGENT_456, "legacy path would wrongly prefer newer #456");
assert.notEqual(
  explicit.useExplicit && explicit.agentId,
  legacyPick,
  "explicit call handling must not use legacy recency when configured",
);

// One receptionist
const one = decideExplicitCallHandlingPstnBind(aiIngressSettings(AGENT_123));
assert.equal(one.useExplicit, true);

// MCTB active — do not use parked AI
const mctbSettings = mergeCallHandlingIntoSettings(
  {},
  {
    activeCallHandler: "mctb",
    parkedAiReceptionistAgentId: AGENT_123,
    explicitSelectionAt: "2026-09-22T00:00:00.000Z",
  },
);
assert.equal(decideExplicitCallHandlingPstnBind(mctbSettings).useExplicit, false);

// Legacy / no explicit selection — parked id ignored
const parkedOnly = mergeCallHandlingIntoSettings(
  {},
  {
    activeCallHandler: "ai_receptionist",
    parkedAiReceptionistAgentId: AGENT_123,
  },
);
assert.equal(decideExplicitCallHandlingPstnBind(parkedOnly).useExplicit, false);

// Legacy recency unchanged
assert.equal(
  pickFirstPublishedReceptionistAgentId(["a", "b"], (id) => id === "b"),
  "b",
);

const resolverSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/voice-v3/resolve-pstn-wizard-binding.ts"),
  "utf8",
);
assert.ok(resolverSource.includes("decideExplicitCallHandlingPstnBind"));
assert.ok(resolverSource.includes("VOICE_V3_PSTN_EXPLICIT_CALL_HANDLING_AGENT_INVALID"));
assert.ok(resolverSource.includes("bindSource: \"explicit_call_handling\""));
assert.ok(resolverSource.includes("bindSource: \"legacy_recency\""));
assert.ok(!resolverSource.includes("syncVoiceAgentPhoneAssignment"));
assert.ok(!resolverSource.includes("voiceAgentPhoneNumber"));

const switchSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/call-handling/set-active-call-handler.ts"),
  "utf8",
);
assert.ok(
  !switchSource.includes("notePstnLegWizardContext"),
  "switch must not write PSTN call context",
);

console.log("test-call-handling-pstn-wizard-binding: PASS");
