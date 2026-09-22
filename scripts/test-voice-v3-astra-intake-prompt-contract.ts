/**
 * Static contract: Astra intake prompt persistence rules (no live API).
 * Cases A–F from intake-persistence correction — prompt/tool-description level.
 */
import assert from "node:assert/strict";
import { UPDATE_INTAKE_TOOL_DESCRIPTION } from "../src/lib/voice-v3/tools/astra-tool-contracts";
import { buildAstraIntakeInstructions } from "../src/lib/voice-v3/prompts/astra-intake-instructions";
import { buildAstraCrossToolInstructions } from "../src/lib/voice-v3/prompts/astra-cross-tool-instructions";
import {
  buildVoiceV3Prompts,
  resolveVoiceV3DefaultPromptInput,
} from "../src/lib/voice-v3/prompts/build-voice-v3-prompts";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";

const intake = buildAstraIntakeInstructions();
const cross = buildAstraCrossToolInstructions(VOICE_V3_BOOKING_TEST_CONFIG);
const prompts = buildVoiceV3Prompts({
  ...resolveVoiceV3DefaultPromptInput(new Date()),
  agentConfig: VOICE_V3_BOOKING_TEST_CONFIG,
});
const astra = prompts.astraInstructions;

// Case A/B/C/D/E/F — policy encoded in prompts (tool selection certified separately when OPENAI_API_KEY set)
assert.ok(
  intake.includes("persist it with update_intake during the current delegated work"),
  "intake: prompt persistence timing",
);
assert.ok(
  intake.includes("Do not intentionally defer clearly supplied intake information"),
  "intake: no defer until book",
);
assert.ok(
  intake.includes("updated_fields") && intake.includes("missing_required_fields"),
  "intake: use tool return fields",
);
assert.ok(
  intake.includes("newest clear correction supersedes the earlier persisted value"),
  "intake: correction supersedes persisted (Case D)",
);
assert.ok(
  intake.includes("Do not save uncertain fragments"),
  "intake: uncertainty (Case F)",
);

assert.ok(
  UPDATE_INTAKE_TOOL_DESCRIPTION.includes("during the current delegated work"),
  "tool desc: timing explicit",
);
assert.ok(
  UPDATE_INTAKE_TOOL_DESCRIPTION.includes("clearly provides or corrects"),
  "tool desc: retains clarity gate",
);

assert.ok(
  cross.includes("FIND may occur while intake is still incomplete"),
  "cross-tool: FIND allowed before full intake",
);
assert.ok(
  cross.includes("persist it promptly with update_intake"),
  "cross-tool: prompt persistence during scheduling",
);
assert.ok(
  cross.includes("Before book_appointment, rely on the current authoritative intake state"),
  "cross-tool: BOOK uses deterministic preconditions",
);
assert.ok(
  !astra.toLowerCase().includes("all required intake before find"),
  "must not require all intake before FIND",
);
assert.ok(
  !astra.toLowerCase().includes("collect all required intake before find"),
  "must not rigidly block FIND on intake completion",
);

console.log("PASS voice-v3 astra intake prompt contract");
