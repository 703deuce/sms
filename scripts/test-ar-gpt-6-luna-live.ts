/**
 * Bounded live OpenAI check for AR AI Rescheduler model (default gpt-6-luna).
 * Does not substitute models on failure.
 *
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-ar-gpt-6-luna-live.ts
 */
import assert from "node:assert/strict";
import { hydrateProdTestEnvFromCoolify } from "./cloud-agent/hydrate-prod-test-env";
import { getArAiReschedulerModelId, AR_AI_RESCHEDULER_MODEL_ID } from "@/lib/appointment-reminders/ai-rescheduler/model";
import { openAiChatCompletion, getOpenAiApiKey } from "@/lib/ai/openai";
import {
  UNDERSTANDING_JSON_SCHEMA,
  validateUnderstandingResult,
} from "@/lib/appointments/ai-scheduling/schema";
import { UNDERSTANDING_AGENT_SYSTEM_PROMPT } from "@/lib/appointments/ai-scheduling/prompts";

async function main() {
  hydrateProdTestEnvFromCoolify();

  const model = getArAiReschedulerModelId();
  assert.equal(model, AR_AI_RESCHEDULER_MODEL_ID, "model id must remain gpt-6-luna unless AR_AI_RESCHEDULER_MODEL is set");

  if (!getOpenAiApiKey()) {
    console.log("BLOCKER test-ar-gpt-6-luna-live: CONFIGURATION REQUIRED — OPENAI_API_KEY missing");
    process.exit(2);
  }

  const system = `${UNDERSTANDING_AGENT_SYSTEM_PROMPT}

Return ONLY valid JSON matching this schema:
${UNDERSTANDING_JSON_SCHEMA}`;

  const user = [
    "Workspace timezone: America/New_York",
    "Locked appointment id: appt_test_1",
    "Customer message: Can we move to Friday at 2pm?",
    "JSON:",
  ].join("\n");

  let raw: string | null;
  try {
    raw = await openAiChatCompletion(system, user, {
      temperature: 0.1,
      maxTokens: 700,
      model,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`FAIL test-ar-gpt-6-luna-live: OpenAI rejected model "${model}"`);
    console.error(msg.slice(0, 500));
    process.exit(1);
  }

  if (!raw) {
    console.error("FAIL test-ar-gpt-6-luna-live: empty completion");
    process.exit(1);
  }

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  assert.ok(jsonMatch, "response must contain JSON object");
  const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  parsed.originalText = "Can we move to Friday at 2pm?";
  const validated = validateUnderstandingResult(parsed, {
    appointmentTypeIds: new Set<string>(),
    staffIds: new Set<string>(),
    locationIds: new Set<string>(),
    appointmentIds: new Set(["appt_test_1"]),
  });
  assert.ok(validated, "understanding JSON must pass validateUnderstandingResult");
  assert.ok(
    validated.intent === "RESCHEDULE" || validated.intent === "UNKNOWN",
    `expected RESCHEDULE-ish intent, got ${validated.intent}`,
  );

  console.log(`PASS test-ar-gpt-6-luna-live (model=${model}, intent=${validated.intent})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
