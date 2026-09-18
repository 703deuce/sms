#!/usr/bin/env npx tsx
/**
 * Intake facts merge from caller speech without SAVE tool.
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-intake-fact-merge-utterance.ts
 */
import {
  applyCallerIntentToCallContext,
  interpretCallerUtterance,
} from "../src/lib/voice-receptionist-wizard/caller-intent-interpreter";
import { intakeSchemaFromWizardOnly } from "../src/lib/voice-receptionist-wizard/intake/compile-schema";
import type { VoiceV2CallContext } from "../src/lib/voice-receptionist-wizard/intake/types";

const failures: string[] = [];
function pass(name: string, cond: boolean, detail?: string) {
  if (!cond) failures.push(detail ? `${name}: ${detail}` : name);
}

async function main() {
  const schema = intakeSchemaFromWizardOnly({
    fields: {
      name: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" },
      email: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" },
    },
  });
  const ctx: VoiceV2CallContext = {
    sessionKey: "cc:intake-merge",
    workspaceId: "ws_test",
    agentId: "agent_test",
    businessTimezone: "America/Los_Angeles",
    intakeSchema: schema,
    intakeState: {},
    askedFields: {},
    compiledAt: new Date().toISOString(),
    capabilities: { bookingStrategy: "MICROSOFT_365", voiceV2PstnLiveBooking: true },
  };

  const utterance = "My email is jane.doe@example.com";
  const interp = interpretCallerUtterance(utterance, { activeGoal: "UNKNOWN" });
  const applied = await applyCallerIntentToCallContext(ctx, interp, utterance);
  pass(
    "EMAIL_CAPTURED",
    applied.ctx.intakeState.email?.value === "jane.doe@example.com",
    String(applied.ctx.intakeState.email?.value),
  );

  const nameUtterance = "My name is Jane Doe";
  const applied2 = await applyCallerIntentToCallContext(
    applied.ctx,
    interpretCallerUtterance(nameUtterance, { activeGoal: "BOOK_APPOINTMENT" }),
    nameUtterance,
  );
  pass(
    "NAME_CAPTURED",
    applied2.ctx.intakeState.name?.value === "Jane Doe",
    String(applied2.ctx.intakeState.name?.value),
  );

  if (failures.length) {
    console.error("FAILURES:\n" + failures.map((f) => `  - ${f}`).join("\n"));
    process.exit(1);
  }
  console.log("PASS intake fact merge from utterance");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
