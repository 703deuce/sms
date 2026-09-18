#!/usr/bin/env npx tsx
/**
 * Scheduling preference without save_intake + no date reask (PSTN regression).
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v2-scheduling-preference-headless.ts
 */
import {
  clearVoiceV2CallSessions,
  getVoiceV2CallContext,
  setVoiceV2CallContext,
} from "../src/lib/voice-receptionist-wizard/intake/session-store";
import { intakeSchemaFromWizardOnly } from "../src/lib/voice-receptionist-wizard/intake/compile-schema";
import { executeVoiceV2SaveIntakeFields } from "../src/lib/voice-receptionist-wizard/intake/save-intake-fields";
import { saveIntakePublicFields } from "../src/lib/voice-receptionist-wizard/intake/format-save-tool-response";
import { workflowFromContext } from "../src/lib/voice-receptionist-wizard/booking-workflow";
import type { VoiceV2CallContext } from "../src/lib/voice-receptionist-wizard/intake/types";
const failures: string[] = [];
function pass(name: string, cond: boolean, detail?: string) {
  if (!cond) failures.push(detail ? `${name}: ${detail}` : name);
}

function seed(): VoiceV2CallContext {
  const schema = intakeSchemaFromWizardOnly({
    fields: {
      name: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" },
      service_reason: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" },
      email: { enabled: true, requirementLevel: "REQUIRED_FOR_RECORD" },
    },
  });
  const ctx: VoiceV2CallContext = {
    sessionKey: "cc:sched-pref-test",
    workspaceId: "ws_test",
    agentId: "agent_test",
    businessTimezone: "America/Los_Angeles",
    intakeSchema: schema,
    intakeState: {
      phone: {
        value: "+15551234567",
        status: "PREFILLED",
        source: "CALLER_ID",
        updatedAt: new Date().toISOString(),
      },
    },
    askedFields: {},
    compiledAt: new Date().toISOString(),
    capabilities: {
      bookingStrategy: "MICROSOFT_365",
      voiceV2PstnLiveBooking: true,
    },
  };
  setVoiceV2CallContext(ctx);
  return ctx;
}

async function save(raw: Record<string, unknown>) {
  return executeVoiceV2SaveIntakeFields(
    { call_id: "sched-pref-test", ...raw },
    "ws_test",
    "agent_test",
  );
}

async function main() {
  clearVoiceV2CallSessions();
  seed();

  const step2 = await save({
    fields: {},
    scheduling_preference: { requested_date: "2026-09-17" },
    booking_intent_active: true,
  });
  pass("STEP2_NOT_INTAKE_SAVED", step2.status === "SCHEDULING_PREFERENCE_NOTED", String(step2.status));
  pass("STEP2_NO_EMPTY_SAVE", step2.status !== "INTAKE_SAVED");
  const pub2 = saveIntakePublicFields(step2);
  pass(
    "STEP2_HINT_NO_REASK",
    String(pub2.runtime_hint || "").toLowerCase().includes("do not ask for the day"),
    String(pub2.runtime_hint),
  );
  const wf2 = workflowFromContext(getVoiceV2CallContext("cc:sched-pref-test")!);
  pass("STEP2_DATE_STORED", wf2.requestedDate === "2026-09-17");

  const step3 = await save({
    fields: { name: "Anthony Johnson", service_reason: "leak in kitchen" },
  });
  pass("STEP3_INTAKE_SAVED", step3.status === "INTAKE_SAVED");
  pass(
    "STEP3_SAVED_BOTH",
    step3.status === "INTAKE_SAVED" &&
      (step3 as { saved: string[] }).saved.includes("name") &&
      (step3 as { saved: string[] }).saved.includes("service_reason"),
  );
  const pub3 = saveIntakePublicFields(step3);
  pass(
    "STEP3_NEXT_FIND",
    pub3.voice_v2_next_stage === "FIND_AVAILABILITY",
    String(pub3.voice_v2_next_stage),
  );
  pass(
    "STEP3_SPEAK_NO_DATE_REASK",
    !String(pub3.speak).toLowerCase().includes("what day works"),
    String(pub3.speak),
  );
  pass(
    "STEP3_KNOWN_DATE",
    (pub3.known_scheduling_preference as { requested_date?: string })?.requested_date ===
      "2026-09-17",
  );

  clearVoiceV2CallSessions();
  seed();
  await save({
    fields: {},
    scheduling_preference: { requested_date: "2026-09-16" },
  });
  const corrected = await save({
    fields: {},
    scheduling_preference: { requested_date: "2026-09-18" },
  });
  pass("CORRECTION_NOTED", corrected.status === "SCHEDULING_PREFERENCE_NOTED");
  const wfC = workflowFromContext(getVoiceV2CallContext("cc:sched-pref-test")!);
  pass("CORRECTION_WEDNESDAY", wfC.requestedDate === "2026-09-18");

  console.log("\n--- Scheduling preference headless ---");
  console.log(`SCHEDULING_REASKS = ${failures.some((f) => f.includes("REASK")) ? 1 : 0}`);
  console.log(`EMPTY_INTAKE_SAVES = ${step2.status === "INTAKE_SAVED" ? 1 : 0}`);
  if (failures.length) {
    console.error("Failures:", failures);
    process.exit(1);
  }
  console.log("All scheduling preference checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
