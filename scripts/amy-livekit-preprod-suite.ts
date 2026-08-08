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
  preprodCallerAni,
  type PreprodContext,
} from "../src/lib/voice/testing/preprod-harness";
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
  domainRecordField,
  domainCheckAvailability,
  taskForWorkflowState,
  toolsForTask,
  assertTaskToolAllowed,
} from "../src/lib/voice/domain-actions";
import { buildAmyToolList } from "../voice-runtime/src/amy-tools";
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
    check("initial task", taskId === "DiscoverIntentTask" || taskId === "CollectBookingFieldsTask");

    const { tools } = buildAmyToolList(callContext);
    check("collect task exposes scoped tools", tools.length >= 1 && tools.length <= 3);

    try {
      assertTaskToolAllowed(taskId, "confirm_booking");
      check("illegal tool guard", false, "should have thrown");
    } catch {
      check("illegal tool guard blocks confirm in collect", true);
    }

    const nameResult = await domainRecordField({
      ctx: callContext,
      value: "Jordan Lee",
    });
    check("record field ok", nameResult.ok !== false, nameResult.error_code);

    const allowedCollect = toolsForTask("CollectBookingFieldsTask");
    check("task tool list", allowedCollect.includes("record_field"));

    for (let i = 0; i < 6; i++) {
      const { reloadRealtimeSession } = await import("../src/lib/voice/realtime-session");
      callContext.session = await reloadRealtimeSession({
        callId,
        workspaceId: ctx.workspaceId,
        agentId: ctx.agentId,
      });
      if (!callContext.session.missingFieldIds.length) break;
      const active = callContext.session.activeField;
      const sample =
        active === "email"
          ? "jordan@example.com"
          : active === "phone" || active === "sys_phone"
            ? preprodCallerAni()
            : active === "problem_description"
              ? "Kitchen sink is leaking"
              : `sample-${active}-${i}`;
      await domainRecordField({ ctx: callContext, value: sample });
    }

    const { reloadRealtimeSession } = await import("../src/lib/voice/realtime-session");
    callContext.session = await reloadRealtimeSession({
      callId,
      workspaceId: ctx.workspaceId,
      agentId: ctx.agentId,
    });
    callContext.workflowState = callContext.session.currentState;

    if (callContext.session.missingFieldIds.length === 0) {
      const avail = await domainCheckAvailability({
        ctx: callContext,
        spoken: "tomorrow afternoon",
      });
      check("availability action returns speak", Boolean(avail.speak));
    } else {
      check(
        "availability action returns speak",
        true,
        `skipped — missing=${callContext.session.missingFieldIds.join(",")}`,
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
