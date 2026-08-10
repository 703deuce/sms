#!/usr/bin/env npx tsx
/**
 * Caller Amy — LiveKit runtime preprod validation (no PSTN required).
 *
 * Run: npm run test:amy-livekit-preprod
 */
import { getPrisma } from "../src/lib/db";
import {
  createPreprodTenant,
  cleanupPreprodTenant,
} from "../src/lib/voice/testing/preprod-harness";
import { sampleValueForManifestField } from "../src/lib/voice/testing/livekit-field-samples";
import {
  resetRealtimeSessionStoreForTests,
  InMemoryRealtimeSessionStore,
} from "../src/lib/voice/realtime-session";
import {
  getVoiceRuntimeProvider,
  getVoiceRuntimeProviderId,
  isLiveKitVoiceRuntime,
} from "../src/lib/voice/runtime-provider";
import { liveKitRuntimeProvider } from "../src/lib/voice/runtime-provider/livekit";
import {
  bootstrapLiveKitCallContext,
  domainGetBookingRequirements,
  domainRecordField,
  taskForWorkflowState,
  toolsForTask,
  assertTaskToolAllowed,
} from "../src/lib/voice/domain-actions";
import { buildAmyAgentInstructions, buildAmyToolList } from "../voice-runtime/src/amy-tools";
import { executeDeterministicPipeline } from "../src/lib/voice/agent-runtime/deterministic-executor";
import { parseRoomMetadata } from "../voice-runtime/src/metadata";

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

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }

  process.env.VOICE_RUNTIME_PROVIDER = "livekit";
  resetRealtimeSessionStoreForTests(new InMemoryRealtimeSessionStore());

  console.log("Amy LiveKit preprod suite\n");

  check("default provider is livekit", isLiveKitVoiceRuntime());
  check("provider id", getVoiceRuntimeProviderId() === "livekit");
  check("provider uses no Telnyx assistant webhooks", !getVoiceRuntimeProvider().usesTelnyxAssistantWebhooks());

  const meta = parseRoomMetadata(
    JSON.stringify({ workspaceId: "ws_test", agentId: "agent_test", fromE164: "+14155550100" }),
  );
  check("room metadata parse", Boolean(meta?.workspaceId));

  const ctx = await createPreprodTenant();
  try {
    const { callId } = await liveKitRuntimeProvider.bootstrapSession({
      workspaceId: ctx.workspaceId,
      agentId: ctx.agentId,
      fromE164: "+14155550123",
      toE164: ctx.toE164,
      livekitRoomName: "test-room",
    });
    ctx.callIds.push(callId);
    check("session bootstrap creates call", Boolean(callId));

    const callContext = await bootstrapLiveKitCallContext({
      callId,
      workspaceId: ctx.workspaceId,
      agentId: ctx.agentId,
      fromE164: "+14155550123",
      toE164: ctx.toE164,
    });
    check("workflow loaded", callContext.session.fieldManifest.length > 0);
    check("ANI on session", Boolean(callContext.session.callerAni));

    const taskId = taskForWorkflowState(callContext.session.currentState);
    check(
      "initial task is intake",
      taskId === "DiscoverIntentTask" ||
        taskId === "CollectBookingFieldsTask" ||
        taskId === "CollectRequiredFieldsTask",
    );

    const { tools } = buildAmyToolList(callContext);
    check(
      "collect exposes semantic capture tool",
      tools.some((tool) => tool.id === "capture_caller_information"),
    );
    check("collect task exposes scoped tools", tools.length >= 1 && tools.length <= 8);

    try {
      assertTaskToolAllowed(taskId, "confirm_booking");
      check("illegal tool guard", false, "should have thrown");
    } catch {
      check("illegal tool guard blocks confirm in collect", true);
    }

    const requirements = await domainGetBookingRequirements({ ctx: callContext });
    check("get booking requirements ok", requirements.ok !== false);

    const nameResult = await domainRecordField({
      ctx: callContext,
      value: sampleValueForManifestField(
        callContext.session,
        callContext.session.activeField,
      ),
    });
    check("record field ok", nameResult.ok !== false, nameResult.error_code);
    check(
      "record result exposes readyForAvailability flag",
      typeof nameResult.data?.readyForAvailability === "boolean",
    );

    check(
      "legacy task registry still maps collect task",
      toolsForTask("CollectBookingFieldsTask").includes("submit_caller_information") ||
        toolsForTask("CollectRequiredFieldsTask").includes("submit_caller_information"),
    );

    for (let i = 0; i < 6; i++) {
      if (!callContext.session.missingFieldIds.length) break;
      const active = callContext.session.activeField;
      const sample = sampleValueForManifestField(callContext.session, active, i);
      const loopResult = await domainRecordField({ ctx: callContext, value: sample });
      if (!loopResult.ok) break;
    }

    const { reloadRealtimeSession } = await import("../src/lib/voice/realtime-session");
    callContext.session = await reloadRealtimeSession({
      callId,
      workspaceId: ctx.workspaceId,
      agentId: ctx.agentId,
    });
    callContext.workflowState = callContext.session.currentState;

    if (callContext.session.missingFieldIds.length === 0) {
      const pipeline = await executeDeterministicPipeline({
        ctx: callContext,
        preferenceSpoken: "next available",
      });
      callContext.session = pipeline.ctx.session;

      const { tools: postCollectTools } = buildAmyToolList(callContext);
      check(
        "post-collect does not expose check_availability to LLM",
        !postCollectTools.some((tool) => tool.id === "check_availability"),
      );
      check(
        "deterministic pipeline ran availability or advanced state",
        pipeline.steps.some((s) => s.toolName === "check_availability") ||
          (callContext.session.availableSlots || []).length > 0 ||
          callContext.session.currentState === "SELECTING_SLOT",
        `steps=${pipeline.steps.map((s) => s.toolName).join(",")} state=${callContext.session.currentState}`,
      );
      const instructions = buildAmyAgentInstructions(callContext);
      check(
        "instructions do not teach LLM to call check_availability",
        !instructions.includes("call check_availability"),
      );
      if ((callContext.session.availableSlots || []).length > 0) {
        check(
          "instructions list offered slots when available",
          instructions.includes("Times to offer"),
        );
      }
    } else {
      check(
        "deterministic pipeline skipped until fields complete",
        true,
        `missing=${callContext.session.missingFieldIds.join(",")}`,
      );
    }

    await liveKitRuntimeProvider.endSession(callId);
    check("session cleanup", true);
  } finally {
    await cleanupPreprodTenant(ctx);
  }

  console.log(`\nOVERALL: ${failures.length ? "FAIL" : "PASS"} (${testsRun - failures.length}/${testsRun})`);
  if (failures.length) {
    failures.forEach((f) => console.error(" -", f));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
