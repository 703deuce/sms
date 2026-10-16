/**
 * Prompt regression + SIP accept wiring (Voice V3 frozen prompts).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildBasicLiveSession,
  VOICE_V3_BASIC_BACKEND_MODEL,
  VOICE_V3_BASIC_LIVE_MODEL,
} from "../src/lib/voice-v3-basic/live-session-config";
import { buildAstraBackendInstructions } from "../src/lib/voice-v3/prompts/astra-backend-instructions";
import {
  buildVoiceV3Prompts,
  resolveVoiceV3DefaultPromptInput,
} from "../src/lib/voice-v3/prompts/build-voice-v3-prompts";
import { buildLiveFrontendInstructions } from "../src/lib/voice-v3/prompts/live-frontend-instructions";
import {
  assertLiveDelegationAcceptPayloadCompatible,
  buildVoiceV3AstraDelegationResponses,
  VOICE_V3_ASTRA_MODEL,
  VOICE_V3_ASTRA_REASONING_EFFORT,
} from "../src/lib/voice-v3/intake/delegation-config";
import { resolveVoiceV3AgentConfig } from "../src/lib/voice-v3/state/call-runtime";

function includesAll(haystack: string, needles: string[], label: string): void {
  for (const needle of needles) {
    assert.ok(
      haystack.toLowerCase().includes(needle.toLowerCase()),
      `${label} missing concept: ${needle}`,
    );
  }
}

function main() {
  const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
    dependencies?: { openai?: string };
  };
  const openaiVersion = pkg.dependencies?.openai ?? "unknown";
  console.log("OPENAI_SDK_VERSION", openaiVersion);

  const live = buildLiveFrontendInstructions({ agentName: "Amy", businessName: "Acme" });
  includesAll(live, [
    "DELEGATION POLICY",
    "Delegate to the backend when",
    "Do not delegate to the backend when",
    "primary caller",
    "background noise",
    "SIDE CONVERSATIONS",
    "primary caller",
    "thinking",
    "INTERRUPTIONS",
    "backchannel",
    "UNCLEAR AUDIO",
    "CORRECTIONS",
    "WAITING FOR BACKEND",
    "one question at a time",
    "COLLECTING CALLER INFORMATION",
    "GREETING",
    "Never invent",
  ], "live frontend");

  const astra = buildAstraBackendInstructions({
    businessName: "Acme",
    timezone: "America/New_York",
    currentLocalDateTime: "Friday, September 18, 2026 at 1:00:00 PM EDT",
    bookingStrategy: "MICROSOFT_365",
    agentConfig: resolveVoiceV3AgentConfig(),
  });
  includesAll(astra, [
    "reasoning and tool-use backend",
    "function call is a request",
    "Direct calendar booking",
    "Cancel:",
    "America/New_York",
    "September 18, 2026",
    "update_intake",
    "set_scheduling_preference",
    "find_availability",
    "never invent offer_set_id",
  ], "astra backend");

  const fixedNow = new Date("2026-09-18T17:00:00.000Z");
  const prompts = buildVoiceV3Prompts(resolveVoiceV3DefaultPromptInput(fixedNow));
  const session = buildBasicLiveSession(fixedNow);

  assert.equal(session.model, VOICE_V3_BASIC_LIVE_MODEL);
  assert.equal(session.type, "live");
  assert.equal(session.instructions, prompts.liveInstructions);
  assert.equal(session.delegation?.type, "responses");
  if (session.delegation?.type !== "responses") {
    throw new Error("expected responses delegation");
  }
  assert.equal(session.delegation.responses.model, VOICE_V3_ASTRA_MODEL);
  assert.equal(session.delegation.responses.instructions, prompts.astraInstructions);
  assert.equal(session.delegation.responses.reasoning?.effort, VOICE_V3_ASTRA_REASONING_EFFORT);

  const expectedDelegation = buildVoiceV3AstraDelegationResponses(
    prompts.astraInstructions,
    resolveVoiceV3AgentConfig(),
  );
  assertLiveDelegationAcceptPayloadCompatible(expectedDelegation);
  assertLiveDelegationAcceptPayloadCompatible(session.delegation.responses);
  assert.deepEqual(session.delegation.responses.tools, expectedDelegation.tools);
  assert.deepEqual(session.delegation.responses.tool_choice, expectedDelegation.tool_choice);

  const acceptJson = JSON.stringify(session);
  assert.ok(
    !acceptJson.includes('"format"'),
    "live.sessions.accept must not include delegation text.format",
  );

  const tools = session.delegation.responses.tools ?? [];
  const updateIntakeTool = tools.find(
    (t) => t && typeof t === "object" && "name" in t && t.name === "update_intake",
  );
  assert.ok(updateIntakeTool, "delegation must include update_intake capability tool");
  if (updateIntakeTool && typeof updateIntakeTool === "object" && "strict" in updateIntakeTool) {
    assert.equal(updateIntakeTool.strict, true, "update_intake must be strict function tool");
  }

  const webhookSrc = readFileSync(
    join(process.cwd(), "src/lib/voice-v3-basic/openai-live-webhook.ts"),
    "utf8",
  );
  assert.ok(
    !webhookSrc.includes("buildLiveFrontendInstructions"),
    "webhook must not inline Live prompt strings",
  );

  console.log("VOICE_V3_PROMPT_WIRING", {
    acceptPath: "src/lib/voice-v3-basic/live-session-config.ts buildBasicLiveSession",
    frontendInstructionsField: "session.instructions",
    backendInstructionsField: "session.delegation.responses.instructions",
    delegationType: "session.delegation.type === 'responses'",
    frontendModel: VOICE_V3_BASIC_LIVE_MODEL,
    backendModel: VOICE_V3_BASIC_BACKEND_MODEL,
    reasoningEffort: "low",
    capabilityTools: tools.map((t) =>
      t && typeof t === "object" && "name" in t ? (t as { name: string }).name : null,
    ),
    hasTextFormatOnAccept: false,
  });

  console.log("PASS voice-v3 prompt regression + accept wiring");
}

main();
