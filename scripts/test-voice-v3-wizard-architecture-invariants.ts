#!/usr/bin/env npx tsx
/**
 * Fail if production V3 resolver reintroduces V2 intake compilation.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const fromPublished = readFileSync(
  resolve("src/lib/voice-v3/config/from-published-agent.ts"),
  "utf8",
);

assert.ok(
  !fromPublished.includes("compileVoiceV2IntakeSchema"),
  "from-published-agent must not use compileVoiceV2IntakeSchema",
);
assert.ok(
  fromPublished.includes("compileVoiceV3AgentConfig"),
  "from-published-agent must call compileVoiceV3AgentConfig",
);

const liveSession = readFileSync(
  resolve("src/lib/voice-v3-basic/live-session-config.ts"),
  "utf8",
);
assert.ok(
  !liveSession.includes('voice: "marin"') || liveSession.includes("config.telephony"),
  "Live voice should come from config.telephony.liveVoiceId when published",
);

console.log("VOICE_V3_WIZARD_ARCHITECTURE_INVARIANTS: PASS");
