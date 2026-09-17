#!/usr/bin/env npx tsx
/**
 * Fact capture is independent of SAVE timing — scheduling before email must survive to FIND.
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-merge-caller-facts-scheduling-ordering.ts
 */
import {
  clearVoiceV2CallSessions,
  getVoiceV2CallContext,
  setVoiceV2CallContext,
} from "../src/lib/voice-v2/intake/session-store";
import { intakeSchemaFromWizardOnly } from "../src/lib/voice-v2/intake/compile-schema";
import {
  applyCallerIntentToCallContext,
  interpretCallerUtterance,
} from "../src/lib/voice-v2/caller-intent-interpreter";
import { executeVoiceV2SaveIntakeFields } from "../src/lib/voice-v2/intake/save-intake-fields";
import { saveIntakePublicFields } from "../src/lib/voice-v2/intake/format-save-tool-response";
import { dialogFromContext } from "../src/lib/voice-v2/dialog-goal";
import { workflowFromContext } from "../src/lib/voice-v2/booking-workflow";
import { workflowPayloadForContext } from "../src/lib/voice-v2/booking-workflow-hooks";
import type { VoiceV2CallContext } from "../src/lib/voice-v2/intake/types";

const failures: string[] = [];
function pass(name: string, cond: boolean, detail?: string) {
  if (!cond) failures.push(detail ? `${name}: ${detail}` : name);
}

const SESSION = "cc:merge-facts-ordering";

function seed(): VoiceV2CallContext {
  const schema = intakeSchemaFromWizardOnly({
    fields: {
      name: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" },
      service_reason: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" },
      email: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" },
    },
  });
  const ctx: VoiceV2CallContext = {
    sessionKey: SESSION,
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

async function applyUtterance(ctx: VoiceV2CallContext, utterance: string) {
  const prior = dialogFromContext(ctx).activeGoal;
  const interpretation = interpretCallerUtterance(utterance, { activeGoal: prior });
  return applyCallerIntentToCallContext(ctx, interpretation, utterance);
}

async function saveEmail() {
  return executeVoiceV2SaveIntakeFields(
    {
      call_id: "merge-facts-ordering",
      fields: {
        name: "Jane Caller",
        service_reason: "leak repair",
        email: "jane@example.com",
      },
    },
    "ws_test",
    "agent_test",
  );
}

async function scenarioDateBeforeEmail() {
  clearVoiceV2CallSessions();
  let ctx = seed();
  const utterance =
    "I need an appointment on September 25, 2026 in the morning.";
  const applied = await applyUtterance(ctx, utterance);
  ctx = applied.ctx;
  setVoiceV2CallContext(ctx);

  pass("GOAL_BOOK", dialogFromContext(ctx).activeGoal === "BOOK_APPOINTMENT", dialogFromContext(ctx).activeGoal);
  pass(
    "DATE_DURABLE",
    ctx.schedulingPreference?.requestedDate === "2026-09-25",
    String(ctx.schedulingPreference?.requestedDate),
  );
  pass(
    "DAYPART_MORNING",
    ctx.schedulingPreference?.requestedDaypart === "morning",
    String(ctx.schedulingPreference?.requestedDaypart),
  );
  const wf1 = workflowFromContext(ctx);
  pass(
    "STAGE_COLLECT_INTAKE",
    wf1.nextStage === "COLLECT_REQUIRED_INTAKE",
    wf1.nextStage,
  );
  pass("WORKFLOW_DATE_SYNC", wf1.requestedDate === "2026-09-25", String(wf1.requestedDate));

  const saveResult = await saveEmail();
  pass("EMAIL_SAVED", saveResult.status === "INTAKE_SAVED", String(saveResult.status));
  const hydrated = getVoiceV2CallContext(SESSION)!;
  pass(
    "DATE_AFTER_EMAIL",
    hydrated.schedulingPreference?.requestedDate === "2026-09-25",
    String(hydrated.schedulingPreference?.requestedDate),
  );
  const wf2 = workflowFromContext(hydrated);
  pass("STAGE_FIND", wf2.nextStage === "FIND_AVAILABILITY", wf2.nextStage);
  const pub = saveIntakePublicFields(saveResult);
  pass(
    "REQUIRED_ACTION_FIND",
    pub.required_action === "voice_v2_find_availability",
    String(pub.required_action),
  );
  const envelope = workflowPayloadForContext(hydrated, true, "MICROSOFT_365");
  pass(
    "ALLOWED_FIND",
    (envelope.allowed_next_actions as string[]).includes("voice_v2_find_availability"),
    JSON.stringify(envelope.allowed_next_actions),
  );
}

async function scenarioEmailBeforeDate() {
  clearVoiceV2CallSessions();
  let ctx = seed();
  const emailFirst = await executeVoiceV2SaveIntakeFields(
    {
      call_id: "merge-facts-ordering",
      fields: { email: "early@example.com" },
    },
    "ws_test",
    "agent_test",
  );
  pass("EMAIL_FIRST_SAVED", emailFirst.status === "INTAKE_SAVED", String(emailFirst.status));
  ctx = getVoiceV2CallContext(SESSION)!;
  const applied = await applyUtterance(
    ctx,
    "Can we do September 26, 2026 afternoon?",
  );
  setVoiceV2CallContext(applied.ctx);
  const wf = workflowFromContext(applied.ctx);
  pass(
    "DATE_AFTER_EMAIL_UTTERANCE",
    applied.ctx.schedulingPreference?.requestedDate === "2026-09-26",
    String(applied.ctx.schedulingPreference?.requestedDate),
  );
  pass(
    "STILL_MISSING_NAME",
    wf.nextStage === "COLLECT_REQUIRED_INTAKE",
    wf.nextStage,
  );

  const complete = await executeVoiceV2SaveIntakeFields(
    {
      call_id: "merge-facts-ordering",
      fields: { name: "Pat", service_reason: "HVAC" },
    },
    "ws_test",
    "agent_test",
  );
  const finalCtx = getVoiceV2CallContext(SESSION)!;
  pass(
    "EMAIL_FIRST_THEN_FIND",
    workflowFromContext(finalCtx).nextStage === "FIND_AVAILABILITY",
    workflowFromContext(finalCtx).nextStage,
  );
  pass(
    "EMAIL_FIRST_DATE_KEPT",
    finalCtx.schedulingPreference?.requestedDate === "2026-09-26",
    String(finalCtx.schedulingPreference?.requestedDate),
  );
}

async function scenarioCorrection() {
  clearVoiceV2CallSessions();
  let ctx = seed();
  ctx = (await applyUtterance(ctx, "Book me September 25, 2026 morning")).ctx;
  setVoiceV2CallContext(ctx);
  ctx = (await applyUtterance(ctx, "Actually make it September 24, 2026 afternoon")).ctx;
  setVoiceV2CallContext(ctx);
  pass(
    "CORRECTION_DATE",
    ctx.schedulingPreference?.requestedDate === "2026-09-24",
    String(ctx.schedulingPreference?.requestedDate),
  );
  pass(
    "CORRECTION_DAYPART",
    ctx.schedulingPreference?.requestedDaypart === "afternoon",
    String(ctx.schedulingPreference?.requestedDaypart),
  );
}

async function main() {
  await scenarioDateBeforeEmail();
  await scenarioEmailBeforeDate();
  await scenarioCorrection();
  if (failures.length) {
    console.error("FAILURES:\n" + failures.map((f) => `  - ${f}`).join("\n"));
    process.exit(1);
  }
  console.log("PASS merge-caller-facts scheduling ordering");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
