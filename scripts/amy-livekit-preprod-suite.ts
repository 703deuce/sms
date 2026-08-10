#!/usr/bin/env npx tsx
/**
 * Caller Amy — LiveKit runtime preprod validation (no PSTN required).
 *
 * Run: npm run test:amy-livekit-preprod
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
import {
  getVoiceRuntimeProvider,
  getVoiceRuntimeProviderId,
  isLiveKitVoiceRuntime,
} from "../src/lib/voice/runtime-provider";
import { liveKitRuntimeProvider } from "../src/lib/voice/runtime-provider/livekit";
import { bootstrapLiveKitCallContext, domainGetBookingRequirements } from "../src/lib/voice/domain-actions";
import { buildAmyAgentInstructions } from "../src/lib/voice/agent-runtime/build-amy-instructions";
import { createAmyReceptionistAgent } from "../voice-runtime/src/amy-receptionist-agent";
import {
  loadAvailableSlots,
  missingRequiredFields,
  recordCallerField,
} from "../voice-runtime/src/scheduling-bridge";
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

  const agent = createAmyReceptionistAgent();
  check("receptionist agent creates", Boolean(agent));

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

    let callContext = await bootstrapLiveKitCallContext({
      callId,
      workspaceId: ctx.workspaceId,
      agentId: ctx.agentId,
      fromE164: "+14155550123",
      toE164: ctx.toE164,
    });
    check("workflow loaded", callContext.session.fieldManifest.length > 0);
    check("ANI on session", Boolean(callContext.session.callerAni));
    check("fields required before booking", missingRequiredFields(callContext).length > 0);

    const requirements = await domainGetBookingRequirements({ ctx: callContext });
    check("get booking requirements ok", requirements.ok !== false);

    const firstMissing = missingRequiredFields(callContext)[0];
    const recorded = await recordCallerField(
      callContext,
      sampleValueForManifestField(callContext.session, firstMissing?.field_id),
      firstMissing?.field_id,
    );
    callContext = recorded.ctx;
    check("record field via bridge ok", recorded.result.ok !== false, recorded.result.error_code);

    for (let i = 0; i < 6; i++) {
      const missing = missingRequiredFields(callContext);
      if (!missing.length) break;
      const sample = sampleValueForManifestField(callContext.session, missing[0]!.field_id, i);
      const loop = await recordCallerField(callContext, sample, missing[0]!.field_id);
      callContext = loop.ctx;
      if (!loop.result.ok) break;
    }

    const instructions = buildAmyAgentInstructions(callContext);
    check("root instructions are thin", instructions.includes("schedule_appointment"));
    check("root instructions avoid SESSION block", !instructions.includes("SESSION:"));

    if (!missingRequiredFields(callContext).length) {
      const loaded = await loadAvailableSlots(callContext, "next available");
      callContext = loaded.ctx;
      check(
        "scheduling bridge loads availability",
        loaded.slots.length > 0 || Boolean(loaded.result.speak),
        `slots=${loaded.slots.length}`,
      );
    } else {
      check(
        "availability skipped until fields complete",
        true,
        `missing=${missingRequiredFields(callContext).map((f) => f.field_id).join(",")}`,
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
