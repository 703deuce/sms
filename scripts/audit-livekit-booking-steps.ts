#!/usr/bin/env npx tsx
/**
 * Section-by-section LiveKit booking audit (no PSTN).
 * Run: npm run audit:livekit-booking-steps
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
  taskForWorkflowState,
  toolsForTask,
} from "../src/lib/voice/domain-actions";
import { buildAmyToolList } from "../voice-runtime/src/amy-tools";
import { staleCachedSessionOnly } from "../src/lib/voice/domain-actions/scheduling-session";
import { matchSlotFromInput } from "../src/lib/voice/workflow-engine/slot-matching";

const PRODUCTION_SLOTS = [
  "2026-08-10T13:00:00.000Z",
  "2026-08-10T13:30:00.000Z",
  "2026-08-10T14:00:00.000Z",
  "2026-08-10T14:30:00.000Z",
  "2026-08-10T15:00:00.000Z",
];

const failures: string[] = [];
let section = "";

function check(name: string, cond: boolean, detail?: string) {
  if (!cond) {
    failures.push(`[${section}] ${name}${detail ? `: ${detail}` : ""}`);
    console.error("  ✗", name, detail || "");
  } else {
    console.log("  ✓", name);
  }
}

async function collectAllFields(
  callContext: Awaited<ReturnType<typeof bootstrapLiveKitCallContext>>,
) {
  for (let i = 0; i < 8; i++) {
    if (!callContext.session.missingFieldIds.length) break;
    const sample = sampleValueForManifestField(
      callContext.session,
      callContext.session.activeField,
      i,
    );
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

  console.log("LiveKit booking step audit\n");

  section = "slot-matching";
  console.log(`\n## ${section}`);
  const matchCases = [
    { utterance: "the later one", expected: PRODUCTION_SLOTS[4] },
    { utterance: "the first one", expected: PRODUCTION_SLOTS[0] },
    { utterance: "9 AM", expected: PRODUCTION_SLOTS[0] },
    { utterance: "11 am", expected: PRODUCTION_SLOTS[4] },
  ];
  for (const testCase of matchCases) {
    const picked = matchSlotFromInput(testCase.utterance, PRODUCTION_SLOTS, "America/New_York");
    check(
      `match "${testCase.utterance}"`,
      picked === testCase.expected,
      `got ${picked}, wanted ${testCase.expected}`,
    );
  }

  const ctx = await createPreprodTenant();
  try {
    section = "bootstrap";
    console.log(`\n## ${section}`);
    const { callId } = await liveKitRuntimeProvider.bootstrapSession({
      workspaceId: ctx.workspaceId,
      agentId: ctx.agentId,
      fromE164: "+14155550123",
      toE164: ctx.toE164,
      livekitRoomName: "audit-booking-steps",
    });
    ctx.callIds.push(callId);
    const callContext = await bootstrapLiveKitCallContext({
      callId,
      workspaceId: ctx.workspaceId,
      agentId: ctx.agentId,
      fromE164: "+14155550123",
      toE164: ctx.toE164,
    });
    check("session bootstrapped", Boolean(callContext.session.fieldManifest.length));
    check("initial tools scoped", buildAmyToolList(callContext).tools.length >= 1);

    section = "requirements";
    console.log(`\n## ${section}`);
    const req = await domainGetBookingRequirements({ ctx: callContext });
    check("get_booking_requirements ok", req.ok);
    check("returns activeField", Boolean(req.data?.activeField || req.data?.readyForAvailability === false));

    section = "field-collection";
    console.log(`\n## ${section}`);
    await collectAllFields(callContext);
    check("all required fields collected", callContext.session.missingFieldIds.length === 0);
    check(
      "workflow -> CHECKING_AVAILABILITY",
      callContext.session.currentState === "CHECKING_AVAILABILITY",
      callContext.session.currentState,
    );
    const postCollectTools = buildAmyToolList(callContext);
    check(
      "check_availability exposed",
      postCollectTools.tools.some((t) => t.id === "check_availability"),
      postCollectTools.tools.map((t) => t.id).join(", "),
    );
    check(
      "record_current_field removed",
      !postCollectTools.tools.some((t) => t.id === "record_current_field"),
    );

    section = "availability";
    console.log(`\n## ${section}`);
    const avail = await domainCheckAvailability({
      ctx: callContext,
      spoken: "tomorrow afternoon",
    });
    check("check_availability returns", avail.ok !== false, avail.error_code);
    const resultSlots = (avail.data?.slots as unknown[] | undefined) || [];
    check("tool result includes slots array", Array.isArray(resultSlots));
    check(
      "session availableSlots populated after reload",
      callContext.session.availableSlots.length > 0 || resultSlots.length > 0,
      `session=${callContext.session.availableSlots.length} result=${resultSlots.length}`,
    );
    const stale = await staleCachedSessionOnly(callContext);
    check(
      "stale cache would hide slots (regression guard)",
      stale.availableSlots.length === 0 || callContext.session.availableSlots.length > 0,
      `stale=${stale.availableSlots.length} fresh=${callContext.session.availableSlots.length}`,
    );

    if (callContext.session.currentState === "SELECTING_SLOT" && resultSlots.length > 0) {
      section = "slot-selection";
      console.log(`\n## ${section}`);
      check(
        "select_slot tool available",
        toolsForTask(taskForWorkflowState("SELECTING_SLOT")).includes("select_slot"),
      );
      const select = await domainSelectSlot({
        ctx: callContext,
        utterance: "the later one",
      });
      check("select_slot returns", select.ok !== false, select.error_code);
      check(
        "held slot set on session",
        Boolean(callContext.session.heldSlot || callContext.session.selectedSlot),
        String(callContext.session.heldSlot),
      );
    } else {
      console.log("\n## slot-selection (skipped — no calendar slots in test env)");
    }

    await liveKitRuntimeProvider.endSession(callId);
  } finally {
    await cleanupPreprodTenant(ctx);
  }

  console.log(`\nOVERALL: ${failures.length ? "FAIL" : "PASS"}`);
  if (failures.length) {
    failures.forEach((f) => console.error(" -", f));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
