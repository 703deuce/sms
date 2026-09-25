/**
 * Static link targets for Voice Overview (no browser).
 */
import assert from "node:assert/strict";

const links = {
  setup: "/mctb/voice-agent",
  receptionist: "/voice/receptionist",
  callsAttention: "/voice/calls?attention=open",
  knowledgeGaps: "/voice/knowledge#knowledge-gaps",
  knowledgeHours: "/voice/knowledge#hours",
  callHandling: "/voice/call-handling",
  analytics: "/voice/analytics?days=7",
  calls: "/voice/calls",
  billing: "/voice/billing",
};

assert.equal(links.setup, "/mctb/voice-agent");
assert.equal(links.analytics, "/voice/analytics?days=7");
assert.ok(links.callsAttention.includes("attention=open"));

console.log("voice-overview-links: PASS");
