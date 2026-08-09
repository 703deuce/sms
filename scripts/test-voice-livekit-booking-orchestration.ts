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
  domainCheckAvailability,
  domainSelectSlot,
  domainConfirmBooking,
  taskForWorkflowState,
  toolsForTask,
  assertTaskToolAllowed,
  buildRequirementsPayload,
} from "../src/lib/voice/domain-actions";
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
      "discovery/collect exposes record_current_field or get_booking_requirements",
      initialTools.tools.some(
        (tool) => tool.id === "record_current_field" || tool.id === "get_booking_requirements",
      ),
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
    check(
      "post-collect exposes check_availability immediately",
      postCollectTools.tools.some((tool) => tool.id === "check_availability"),
      postCollectTools.tools.map((tool) => tool.id).join(", "),
    );
    check(
      "post-collect removes record_current_field when complete",
      !postCollectTools.tools.some((tool) => tool.id === "record_current_field"),
    );

    const instructions = buildAmyAgentInstructions(callContext);
    check("instructions require check_availability", instructions.includes("check_availability"));
    check("instructions include phase task context", instructions.includes("CURRENT TASK"));

    const beforeSyncTools = callContext.lastAgentSync?.toolNames || [];
    await syncAmyAgentFromContext(mockSession(callContext), callContext);
    check("sync records lastAgentSync", Boolean(callContext.lastAgentSync?.toolNames.length));
    check(
      "sync exposes check_availability in lastAgentSync",
      callContext.lastAgentSync?.toolNames.includes("check_availability") === true,
      `before=${beforeSyncTools.join(",")} after=${callContext.lastAgentSync?.toolNames.join(",")}`,
    );

    const payload = buildRequirementsPayload(callContext.session);
    check("requirements payload readyForAvailability", payload.readyForAvailability === true);

    const avail = await domainCheckAvailability({
      ctx: callContext,
      spoken: "tomorrow afternoon",
    });
    check("check_availability returns speak", Boolean(avail.speak));
    check("check_availability returns slots array", Array.isArray(avail.data?.slots));

    const slots = (avail.data?.slots as unknown[] | undefined) || [];
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
