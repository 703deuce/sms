/**
 * Telnyx speech path unit tests (Amy 866 production path).
 * Run: npx tsx scripts/test-telnyx-speech-path.ts
 */
import assert from "node:assert/strict";
import { formatSpeakForVoice, formatTelnyxToolPayload } from "../src/lib/voice/telnyx/format-speak-text";
import { TELNYX_SPEECH_PROMPT_GUIDANCE } from "../src/lib/voice/telnyx/speech-prompt-guidance";
import { applyAmyProductionVoiceTuning, AMY_PRONUNCIATION_NOTES } from "../src/lib/voice/telnyx/amy-production-voice-tuning";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";
import { buildWizardAgentConfig } from "../src/lib/solutions/appointment-receptionist/build-agent-config";
import { createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import { applyHarborDrainProsWizardKnowledge } from "../src/lib/receptionist-wizard/harbor-drain-pros-config";
import { compileCallerConstitution } from "../src/lib/agents/appointment-booking/intelligence/caller-constitution";

function main() {
  const spoken = formatSpeakForVoice("Call us at 555-555-0123. Estimate is $89.");
  assert.ok(spoken.includes("five five five"), spoken);
  assert.ok(spoken.includes("dollars"), spoken);

  const payload = formatTelnyxToolPayload({
    ok: true,
    speak: "Your appointment is at 2:30 PM on 09/03/2026.",
    data: { startsAt: "2026-09-03T14:30:00Z" },
  });
  assert.ok(String(payload.speak).includes("P.M."), String(payload.speak));
  assert.equal(
    (payload.data as { startsAt: string }).startsAt,
    "2026-09-03T14:30:00Z",
    "canonical data unchanged",
  );

  assert.ok(TELNYX_SPEECH_PROMPT_GUIDANCE.includes("SPOKEN LANGUAGE"));
  assert.ok(TELNYX_SPEECH_PROMPT_GUIDANCE.includes("FAILURE TAXONOMY"));

  const tuned = applyAmyProductionVoiceTuning(parseVoiceAgentConfig(null));
  assert.equal(tuned.voiceLanguage?.elevenLabsStyle, 0);
  assert.ok((tuned.voiceLanguage?.elevenLabsStability ?? 0) >= 0.65);
  assert.ok(tuned.instructions?.pronunciation?.includes("Transovo"));

  const wizard = applyHarborDrainProsWizardKnowledge(createDefaultWizardState());
  const cfg = buildWizardAgentConfig(wizard);
  assert.equal(cfg.instructions?.pronunciation, AMY_PRONUNCIATION_NOTES);
  assert.ok(cfg.voiceLanguage?.pronunciationDictionary?.Transovo);

  const constitution = compileCallerConstitution("Harbor Drain Pros");
  assert.ok(constitution.includes("September third"));
  assert.ok(constitution.includes("Was that Woodbridge"));

  console.log("test-telnyx-speech-path: PASS");
}

main();
