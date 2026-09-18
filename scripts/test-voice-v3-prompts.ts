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
    "primary caller",
    "background noise",
    "OTHER PEOPLE SPEAKING",
    "side conversation",
    "thinking",
    "INTERRUPTIONS",
    "backchannel",
    "UNCLEAR AUDIO",
    "CORRECTIONS",
    "WAITING FOR BACKEND",
    "one question at a time",
    "GREETING",
    "Never invent",
  ], "live frontend");

  const astra = buildAstraBackendInstructions({
    businessName: "Acme",
    timezone: "America/New_York",
    currentLocalDateTime: "Friday, September 18, 2026 at 1:00:00 PM EDT",
  });
  includesAll(astra, [
    "authority order",
    "CALLER MEANING",
    "CORRECTIONS",
    "AMBIGUITY",
    "America/New_York",
    "September 18, 2026",
    "DYNAMIC FIELDS",
    "DATE AND TIME LANGUAGE",
    "SPOKEN REFERENCES",
    "Do not claim that an external action succeeded",
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
  assert.equal(session.delegation.responses.model, VOICE_V3_BASIC_BACKEND_MODEL);
  assert.equal(session.delegation.responses.instructions, prompts.astraInstructions);
  assert.equal(session.delegation.responses.reasoning?.effort, "low");
  assert.deepEqual(session.delegation.responses.tools, []);

  console.log("VOICE_V3_PROMPT_WIRING", {
    acceptPath: "src/lib/voice-v3-basic/live-session-config.ts buildBasicLiveSession",
    frontendInstructionsField: "session.instructions",
    backendInstructionsField: "session.delegation.responses.instructions",
    delegationType: "session.delegation.type === 'responses'",
    frontendModel: VOICE_V3_BASIC_LIVE_MODEL,
    backendModel: VOICE_V3_BASIC_BACKEND_MODEL,
    reasoningEffort: "low",
  });

  console.log("PASS voice-v3 prompt regression + accept wiring");
}

main();
