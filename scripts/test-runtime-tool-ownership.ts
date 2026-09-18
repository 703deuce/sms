#!/usr/bin/env npx tsx
/**
 * Runtime owns auto-dispatchable required_action — model delegation must not see those tools.
 */
import { buildVoiceV2ControlPlaneEnvelope } from "../src/lib/voice-receptionist-wizard/control-plane-envelope";
import { defaultVoiceV2BookingWorkflow } from "../src/lib/voice-receptionist-wizard/booking-workflow";
import { intakeSchemaFromWizardOnly } from "../src/lib/voice-receptionist-wizard/intake/compile-schema";
import { VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE } from "../src/lib/voice-receptionist-wizard/telnyx-tool-definition";
import { utteranceLooksLikeSchedulingCorrection } from "../src/lib/voice-receptionist-wizard/scheduling-preference-state";
import { mergeSchedulingPreferenceRecord } from "../src/lib/voice-receptionist-wizard/scheduling-preference-state";

const failures: string[] = [];
function pass(name: string, cond: boolean, detail?: string) {
  if (!cond) failures.push(detail ? `${name}: ${detail}` : name);
}

function main() {
  const schema = intakeSchemaFromWizardOnly({
    fields: {
      name: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" },
      email: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" },
      service_reason: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" },
    },
  });
  const ctx = {
    sessionKey: "cc:ownership",
    workspaceId: "ws_test",
    agentId: "agent_test",
    businessTimezone: "America/Los_Angeles",
    intakeSchema: schema,
    intakeState: {
      name: { value: "A", status: "CAPTURED", source: "CALLER", updatedAt: new Date().toISOString() },
      email: { value: "a@b.com", status: "CAPTURED", source: "CALLER", updatedAt: new Date().toISOString() },
      service_reason: { value: "leak", status: "CAPTURED", source: "CALLER", updatedAt: new Date().toISOString() },
    },
    askedFields: {},
    compiledAt: new Date().toISOString(),
    capabilities: { bookingStrategy: "MICROSOFT_365", voiceV2PstnLiveBooking: true },
    schedulingPreference: { requestedDate: "2026-09-25" },
    dialog: { activeGoal: "BOOK_APPOINTMENT" },
    bookingWorkflow: {
      ...defaultVoiceV2BookingWorkflow(),
      bookingIntentActive: true,
      requestedDate: "2026-09-25",
    },
  };

  const env = buildVoiceV2ControlPlaneEnvelope(ctx, true, "MICROSOFT_365");
  pass(
    "RUNTIME_OWNS_FIND",
    (env.runtime_owned_actions as string[]).includes(VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE),
    JSON.stringify(env.runtime_owned_actions),
  );
  pass(
    "DELEGATION_EXCLUDES_FIND",
    !(env.delegation_allowed_actions as string[]).includes(
      VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE,
    ),
    JSON.stringify(env.delegation_allowed_actions),
  );

  const thu = mergeSchedulingPreferenceRecord(
    { requestedDate: "2026-09-24", requestedDaypart: "morning" },
    {
      requestedDate: "2026-09-25",
      requestedDaypart: "morning",
      source: "caller",
      evidence: "actually Friday",
    },
    { forceReplace: utteranceLooksLikeSchedulingCorrection("actually Friday") },
  );
  pass("CORRECTION_FRIDAY", thu.requestedDate === "2026-09-25");

  if (failures.length) {
    console.error("FAILURES:\n" + failures.map((f) => `  - ${f}`).join("\n"));
    process.exit(1);
  }
  console.log("PASS runtime tool ownership + correction merge");
}

main();
