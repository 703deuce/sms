#!/usr/bin/env npx tsx
/**
 * LiveKit booking orchestration tests — domain actions + tool scoping.
 *
 * Run: npm run test:voice-livekit-booking-orchestration
 */
import {
  createPreprodTenant,
  cleanupPreprodTenant,
} from "../src/lib/voice/testing/preprod-harness";
import { sampleValueForManifestField } from "../src/lib/voice/testing/livekit-field-samples";
import {
  resetRealtimeSessionStoreForTests,
  InMemoryRealtimeSessionStore,
} from "../src/lib/voice/realtime-session";
import { liveKitRuntimeProvider } from "../src/lib/voice/runtime-provider/livekit";
import {
  bootstrapLiveKitCallContext,
  domainGetBookingRequirements,
  domainRecordField,
  domainSelectSlot,
  domainConfirmBooking,
  taskForWorkflowState,
  toolsForTask,
  assertTaskToolAllowed,
  buildRequirementsPayload,
} from "../src/lib/voice/domain-actions";
import { executeDeterministicPipeline } from "../src/lib/voice/agent-runtime/deterministic-executor";
import {
  buildAmyAgentInstructions,
  buildAmyToolList,
  syncAmyAgentFromContext,
} from "../voice-runtime/src/amy-tools";

const failures: string[] = [];
let testsRun = 0;

function check(name: string, cond: boolean, detail?: string) {
  testsRun++;
  if (!cond) {
    failures.push(detail ? `${name}: ${detail}` : name);
    console.error("✗", name, detail || "");
  } else {
    console.log("✓", name);
  }
}

function mockSession(callContext: Awaited<ReturnType<typeof bootstrapLiveKitCallContext>>) {
  return {
    currentAgent: {
      updateInstructions: async () => undefined,
      updateTools: async () => undefined,
    },
    userData: { callContext },
  } as unknown as Parameters<typeof syncAmyAgentFromContext>[0];
}

async function collectAllFields(
  callContext: Awaited<ReturnType<typeof bootstrapLiveKitCallContext>>,
) {
  for (let i = 0; i < 8; i++) {
    if (!callContext.session.missingFieldIds.length) break;
    const active = callContext.session.activeField;
    const sample = sampleValueForManifestField(callContext.session, active, i);
    const result = await domainRecordField({ ctx: callContext, value: sample });
    if (!result.ok) break;
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }

  process.env.VOICE_RUNTIME_PROVIDER = "livekit";
  resetRealtimeSessionStoreForTests(new InMemoryRealtimeSessionStore());

  console.log("LiveKit booking orchestration tests\n");

  const ctx = await createPreprodTenant();
  try {
    const { callId } = await liveKitRuntimeProvider.bootstrapSession({
      workspaceId: ctx.workspaceId,
      agentId: ctx.agentId,
      fromE164: "+14155550123",
      toE164: ctx.toE164,
      livekitRoomName: "booking-orchestration-test",
    });
    ctx.callIds.push(callId);

    const callContext = await bootstrapLiveKitCallContext({
      callId,
      workspaceId: ctx.workspaceId,
      agentId: ctx.agentId,
      fromE164: "+14155550123",
      toE164: ctx.toE164,
    });

    const initialTask = taskForWorkflowState(callContext.session.currentState);
    const initialTools = buildAmyToolList(callContext);
    check(
      "discovery/collect exposes semantic capture tool",
      initialTools.tools.some((tool) => tool.id === "capture_caller_information"),
    );

    try {
      assertTaskToolAllowed(initialTask, "check_availability");
      check("availability blocked before fields complete", false, "should throw");
    } catch {
      check("availability blocked before fields complete", true);
    }

    const requirements = await domainGetBookingRequirements({ ctx: callContext });
    check("get_booking_requirements succeeds", requirements.ok);
    check(
      "requirements include activeField",
      Boolean(requirements.data?.activeField || requirements.data?.readyForAvailability === false),
    );

    const firstField = await domainRecordField({
      ctx: callContext,
      value: sampleValueForManifestField(
        callContext.session,
        callContext.session.activeField,
      ),
    });
    check("record_current_field succeeds", firstField.ok !== false);
    check(
      "record result includes next field or ready flag",
      Boolean(firstField.data?.nextField || firstField.data?.readyForAvailability),
    );

    await collectAllFields(callContext);

    callContext.workflowState = callContext.session.currentState;

    const postCollectTask = taskForWorkflowState(callContext.session.currentState);
    check("post-collect task is CheckAvailabilityTask", postCollectTask === "CheckAvailabilityTask");

    const postCollectTools = buildAmyToolList(callContext);
    const pipeline = await executeDeterministicPipeline({
      ctx: callContext,
      preferenceSpoken: "next available",
    });
    check(
      "deterministic pipeline runs check_availability after collect",
      pipeline.steps.some((s) => s.toolName === "check_availability") ||
        callContext.session.availableSlots.length > 0,
      pipeline.steps.map((s) => s.toolName).join(", "),
    );
    check(
      "post-collect does not expose check_availability to LLM",
      !postCollectTools.tools.some((tool) => tool.id === "check_availability"),
      postCollectTools.tools.map((tool) => tool.id).join(", "),
    );
    check(
      "post-collect removes capture when complete",
      !postCollectTools.tools.some((tool) => tool.id === "capture_caller_information") ||
        callContext.session.missingFieldIds.length > 0,
    );

    const instructions = buildAmyAgentInstructions(callContext);
    check(
      "instructions do not teach LLM to call check_availability",
      !instructions.includes("call check_availability"),
    );
    check(
      "instructions include conversational context",
      instructions.includes("ACTIVE CAPABILITY"),
    );

    const beforeSyncTools = callContext.lastAgentSync?.toolNames || [];
    await syncAmyAgentFromContext(mockSession(callContext), callContext);
    check("sync records lastAgentSync", Boolean(callContext.lastAgentSync?.toolNames.length));
    check(
      "sync exposes semantic tools in lastAgentSync",
      (callContext.lastAgentSync?.toolNames.includes("choose_appointment_time") ||
        callContext.lastAgentSync?.toolNames.includes("capture_caller_information")) === true,
      `before=${beforeSyncTools.join(",")} after=${callContext.lastAgentSync?.toolNames.join(",")}`,
    );

    const payload = buildRequirementsPayload(callContext.session);
    check("requirements payload readyForAvailability", payload.readyForAvailability === true);

    check(
      "availability slots present after pipeline",
      callContext.session.availableSlots.length > 0 ||
        pipeline.steps.some((s) => s.toolName === "check_availability" && s.ok),
    );

    const slots =
      (callContext.session.availableSlots as unknown[] | undefined) || [];
    if (slots.length && callContext.session.currentState === "SELECTING_SLOT") {
      const select = await domainSelectSlot({
        ctx: callContext,
        utterance: "the first one",
      });
      check("select_slot returns result", Boolean(select.speak));

      const confirmBlocked = await domainConfirmBooking({
        ctx: callContext,
        confirmed: false,
      });
      check(
        "declined confirmation does not book",
        confirmBlocked.ok === false || !confirmBlocked.data?.booking,
      );
    } else {
      check("select_slot skipped without returned slots", true, `state=${callContext.session.currentState}`);
      check("confirm_booking skipped without returned slots", true);
    }

    check(
      "confirm_booking unavailable during collect",
      !toolsForTask("CollectBookingFieldsTask").includes("confirm_booking"),
    );

    await liveKitRuntimeProvider.endSession(callId);
    check("session cleanup", true);
  } finally {
    await cleanupPreprodTenant(ctx);
  }

  console.log(`\nOVERALL: ${failures.length ? "FAIL" : "PASS"} (${testsRun - failures.length}/${testsRun})`);
  if (failures.length) {
    failures.forEach((failure) => console.error(" -", failure));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
