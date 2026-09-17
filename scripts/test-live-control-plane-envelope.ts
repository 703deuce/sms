#!/usr/bin/env npx tsx
/**
 * Control plane envelope: forbidden_actions + required_action from registry.
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-live-control-plane-envelope.ts
 */
import { buildVoiceV2ControlPlaneEnvelope } from "../src/lib/voice-v2/control-plane-envelope";
import { defaultVoiceV2BookingWorkflow } from "../src/lib/voice-v2/booking-workflow";
import { intakeSchemaFromWizardOnly } from "../src/lib/voice-v2/intake/compile-schema";
import type { VoiceV2CallContext } from "../src/lib/voice-v2/intake/types";
import { VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE } from "../src/lib/voice-v2/telnyx-tool-definition";

const failures: string[] = [];
function pass(name: string, cond: boolean, detail?: string) {
  if (!cond) failures.push(detail ? `${name}: ${detail}` : name);
}

function seedCtx(partial: Partial<VoiceV2CallContext>): VoiceV2CallContext {
  const schema = intakeSchemaFromWizardOnly({
    fields: {
      name: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" },
      email: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" },
      service_reason: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" },
    },
  });
  return {
    sessionKey: "cc:envelope-test",
    workspaceId: "ws_test",
    agentId: "agent_test",
    businessTimezone: "America/Los_Angeles",
    intakeSchema: schema,
    intakeState: {
      name: {
        value: "Test User",
        status: "CAPTURED",
        source: "CALLER",
        updatedAt: new Date().toISOString(),
      },
      email: {
        value: "t@example.com",
        status: "CAPTURED",
        source: "CALLER",
        updatedAt: new Date().toISOString(),
      },
      service_reason: {
        value: "HVAC tune-up",
        status: "CAPTURED",
        source: "CALLER",
        updatedAt: new Date().toISOString(),
      },
    },
    askedFields: {},
    compiledAt: new Date().toISOString(),
    capabilities: { bookingStrategy: "MICROSOFT_365", voiceV2PstnLiveBooking: true },
    schedulingPreference: { requestedDate: "2026-09-25" },
    dialog: { activeGoal: "BOOK_APPOINTMENT", explicitCallbackRequested: false },
    bookingWorkflow: {
      ...defaultVoiceV2BookingWorkflow(),
      bookingIntentActive: true,
      requestedDate: "2026-09-25",
      nextStage: "FIND_AVAILABILITY",
    },
    ...partial,
  };
}

function main() {
  const env = buildVoiceV2ControlPlaneEnvelope(seedCtx({}), true, "MICROSOFT_365");
  pass("STAGE_FIND", env.voice_v2_next_stage === "FIND_AVAILABILITY", String(env.voice_v2_next_stage));
  pass(
    "REQUIRED_FIND",
    env.required_action === VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE,
    String(env.required_action),
  );
  pass(
    "FORBIDDEN_NONEMPTY",
    Array.isArray(env.forbidden_actions) && env.forbidden_actions.length > 0,
    JSON.stringify(env.forbidden_actions),
  );
  pass(
    "FIND_NOT_FORBIDDEN",
    !(env.forbidden_actions as string[]).includes(VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE),
  );

  const offerCtx = seedCtx({
    currentOfferSet: { offerSetId: "v2offer_test", slotIds: ["slot_11am"] },
    bookingState: { selectedSlotId: "slot_11am", status: "selected" },
  });
  const offerEnv = buildVoiceV2ControlPlaneEnvelope(offerCtx, true, "MICROSOFT_365");
  pass(
    "STAGE_BOOK_SELECTED",
    offerEnv.voice_v2_next_stage === "BOOK_SELECTED_SLOT",
    String(offerEnv.voice_v2_next_stage),
  );
  pass(
    "REQUIRED_BOOK",
    offerEnv.required_action === "voice_v2_book_offered_slot",
    String(offerEnv.required_action),
  );

  if (failures.length) {
    console.error("FAILURES:\n" + failures.map((f) => `  - ${f}`).join("\n"));
    process.exit(1);
  }
  console.log("PASS live control plane envelope");
}

main();
