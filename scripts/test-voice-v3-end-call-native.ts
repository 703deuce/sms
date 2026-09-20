#!/usr/bin/env npx tsx
/**
 * Voice V3 native EndCallTool — registration, Astra bypass, Amy policy invariants.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildAmyEndCallInstructions } from "../src/lib/voice-v3/prompts/amy-end-call-instructions";
import { buildLiveFrontendInstructions } from "../src/lib/voice-v3/prompts/live-frontend-instructions";
import { VOICE_V3_LIVEKIT_NATIVE_TOOL_NAMES } from "../src/lib/voice/python-runtime-bridge/voice-v3-livekit";
import {
  buildVoiceV3AstraFunctionToolsFromCatalog,
  listVoiceV3AstraToolNamesForConfig,
} from "../src/lib/voice-v3/tools/voice-tool-catalog";
import { resolveVoiceV3AgentConfig } from "../src/lib/voice-v3/state/call-runtime";

function main() {
  const amyEnd = buildAmyEndCallInstructions();
  assert.match(amyEnd, /Do NOT end the call merely because/i);
  assert.match(amyEnd, /appointment was booked/i);
  assert.match(amyEnd, /explicitly says goodbye/i);
  assert.match(amyEnd, /Ambiguous acknowledgements/i);
  assert.match(amyEnd, /another question, new objective/i);
  assert.doesNotMatch(amyEnd, /LiveKit|end_call/i);

  const live = buildLiveFrontendInstructions({
    agentConfig: resolveVoiceV3AgentConfig(),
  });
  assert.ok(live.includes("ENDING THE CALL"));

  const config = resolveVoiceV3AgentConfig();
  const catalogNames = listVoiceV3AstraToolNamesForConfig(config);
  assert.ok(catalogNames.includes("end_call"), "catalog retains legacy end_call entry");

  const astraTools = buildVoiceV3AstraFunctionToolsFromCatalog(config);
  const native = new Set<string>(VOICE_V3_LIVEKIT_NATIVE_TOOL_NAMES);
  const delegationNames = astraTools
    .map((t) => String(t.name))
    .filter((n) => !native.has(n));
  assert.ok(!delegationNames.includes("end_call"), "Astra delegation must not include end_call");
  assert.deepEqual(VOICE_V3_LIVEKIT_NATIVE_TOOL_NAMES, ["end_call"]);

  const sessionPy = readFileSync(
    "voice-runtime-python/transovo_voice/voice_v3/session.py",
    "utf8",
  );
  assert.match(sessionPy, /build_voice_v3_end_call_toolset/);
  assert.doesNotMatch(sessionPy, /EndCallTool\(/);

  const endCallPy = readFileSync(
    "voice-runtime-python/transovo_voice/voice_v3/end_call_tool.py",
    "utf8",
  );
  assert.match(endCallPy, /delete_room=True/);
  assert.match(endCallPy, /ignore_on_enter=True/);
  assert.match(endCallPy, /VOICE_V3_END_CALL_REQUESTED/);
  assert.match(endCallPy, /VOICE_V3_END_CALL_COMPLETED/);

  console.log("VOICE_V3_END_CALL_NATIVE_TESTS_PASS");
}

main();
