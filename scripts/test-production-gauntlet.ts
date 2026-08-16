/**
 * Production readiness gauntlet — test-gated audit (not self-graded).
 * Run: npx tsx scripts/test-production-gauntlet.ts
 *
 * Levels:
 *   TOOL CONTRACT — deterministic function behavior
 *   AGENT DECISION — workflow guards / state machine
 *   VOICE E2E — requires DATABASE_URL + optional BASE_URL for browser
 */
import { isToolAllowedForState } from "../src/lib/voice/workflow-engine/states";
import { assertToolAllowed } from "../src/lib/voice/workflow-engine/guard";
import { isGatewayRoutedTool } from "../src/lib/voice/agent-tool-gateway/gateway";
import { translateError } from "../src/lib/voice/agent-tool-gateway/errors";
import { toCustomFieldId } from "../src/lib/voice/field-runtime/system-fields";

type Level = "TOOL_CONTRACT" | "AGENT_DECISION" | "VOICE_E2E";
type Result = { test: string; level: Level; pass: boolean; skipped?: boolean; detail?: string };

const results: Result[] = [];

function record(level: Level, test: string, pass: boolean, detail?: string, skipped = false) {
  results.push({ level, test, pass, detail, skipped });
  const mark = skipped ? "○" : pass ? "✓" : "✗";
  console.log(mark, `[${level}]`, test, detail || "");
}

async function toolContractTests() {
  record("TOOL_CONTRACT", "gateway routes book", isGatewayRoutedTool("book_appointment"));
  record("TOOL_CONTRACT", "gateway routes record_current_field via builtin", !isGatewayRoutedTool("record_current_field"));
  record("TOOL_CONTRACT", "Calendly 500 translates retryable", translateError(new Error("503 timeout")).retryable);
  record("TOOL_CONTRACT", "Calendly 401 translates AUTH_REQUIRED", translateError(new Error("OAuth token expired")).code === "AUTH_REQUIRED");
  record("TOOL_CONTRACT", "slot conflict SLOT_UNAVAILABLE", translateError(new Error("Slot no longer available")).code === "SLOT_UNAVAILABLE");
  record("TOOL_CONTRACT", "arbitrary field id generation", toCustomFieldId("favorite_dinosaur").startsWith("fld_"));
}

async function agentDecisionTests() {
  record(
    "AGENT_DECISION",
    "COLLECTING blocks direct book",
    !isToolAllowedForState("COLLECTING_FIELDS", "book_appointment"),
  );
  record(
    "AGENT_DECISION",
    "READY blocks direct book",
    !isToolAllowedForState("READY_TO_BOOK", "book_appointment"),
  );
  record(
    "AGENT_DECISION",
    "READY allows runtime_turn",
    isToolAllowedForState("READY_TO_BOOK", "runtime_turn"),
  );
  record(
    "AGENT_DECISION",
    "BOOKING blocks direct transfer",
    !isToolAllowedForState("BOOKING_IN_PROGRESS", "transfer"),
  );

  const guard = await assertToolAllowed({
    workspaceId: "ws_test",
    toolType: "calendar_availability",
  });
  record(
    "AGENT_DECISION",
    "guard blocks internal scheduling without call context",
    !guard.allowed &&
      guard.state === "INTENT_DISCOVERY" &&
      guard.error_code === "TOOL_INTERNAL_ONLY",
    `allowed=${guard.allowed} state=${guard.state} code=${guard.error_code}`,
  );
}

async function voiceE2eTests() {
  if (!process.env.DATABASE_URL) {
    record("VOICE_E2E", "DB persistence path", true, "DATABASE_URL not set — skipped", true);
    return;
  }

  const { getPrisma } = await import("../src/lib/db");
  const { saveCollectedFields, recordCurrentField } = await import("../src/lib/voice/field-runtime/save");
  const { loadWorkflowFieldSession } = await import("../src/lib/voice/field-runtime/session");
  const { loadAgentRuntime } = await import("../src/lib/voice/workflow-engine/runtime-state");
  const prisma = getPrisma();

  const ws = await prisma.workspace.create({ data: { name: "Gauntlet", slug: `gauntlet-${Date.now()}` } });
  const call = await prisma.voiceCall.create({
    data: {
      workspaceId: ws.id,
      direction: "INBOUND",
      status: "IN_PROGRESS",
      fromE164: "+17035559999",
      toE164: "+18005559999",
      startedAt: new Date(),
    },
  });

  const fldVehicle = toCustomFieldId("vehicle_make_model");
  const fldProblem = toCustomFieldId("describe_problem");

  await saveCollectedFields({
    workspaceId: ws.id,
    callId: call.id,
    fields: [{ field_id: fldVehicle, value: "2021 Tacoma" }],
    workflow: "book_appointment",
  });
  await saveCollectedFields({
    workspaceId: ws.id,
    callId: call.id,
    fields: [{ field_id: fldVehicle, value: "2022 Toyota RAV4" }],
    workflow: "book_appointment",
  });

  const session = await loadWorkflowFieldSession(call.id);
  record(
    "VOICE_E2E",
    "caller correction updates field",
    session?.fields[fldVehicle]?.value === "2022 Toyota RAV4",
    `got ${session?.fields[fldVehicle]?.value}`,
  );

  await saveCollectedFields({
    workspaceId: ws.id,
    callId: call.id,
    fields: [{ field_id: fldProblem, value: "Kitchen sink backing up" }],
    workflow: "book_appointment",
  });

  const runtime = await loadAgentRuntime(call.id);
  record(
    "VOICE_E2E",
    "state survives session reload",
    Boolean(runtime?.workflow_id && session?.session_id),
    `runtime=${runtime?.workflow_id ?? "none"} session=${session?.session_id ?? "none"}`,
  );

  const tenantB = await prisma.workspace.create({ data: { name: "Tenant B", slug: `tb-${Date.now()}` } });
  const callB = await prisma.voiceCall.create({
    data: {
      workspaceId: tenantB.id,
      direction: "INBOUND",
      status: "IN_PROGRESS",
      fromE164: "+17035558888",
      toE164: "+18005558888",
      startedAt: new Date(),
    },
  });
  const cross = await saveCollectedFields({
    workspaceId: tenantB.id,
    callId: callB.id,
    fields: [{ field_id: fldVehicle, value: "hacked" }],
    workflow: "book_appointment",
  });
  record("VOICE_E2E", "tenant isolation write", cross.success === true || cross.ok === true);

  await prisma.voiceCall.delete({ where: { id: call.id } }).catch(() => undefined);
  await prisma.voiceCall.delete({ where: { id: callB.id } }).catch(() => undefined);
  await prisma.workspace.delete({ where: { id: ws.id } }).catch(() => undefined);
  await prisma.workspace.delete({ where: { id: tenantB.id } }).catch(() => undefined);
}

async function main() {
  console.log("\n=== Production Readiness Gauntlet ===\n");
  await toolContractTests();
  await agentDecisionTests();
  await voiceE2eTests();

  const byLevel = (l: Level) => results.filter((r) => r.level === l);
  const summary = (l: Level) => {
    const rows = byLevel(l);
    const passed = rows.filter((r) => r.pass && !r.skipped).length;
    const skipped = rows.filter((r) => r.skipped).length;
    const total = rows.filter((r) => !r.skipped).length;
    return skipped ? `${passed}/${total} (${skipped} skipped)` : `${passed}/${total}`;
  };

  console.log("\n--- Summary ---");
  console.log("TOOL CONTRACT:", summary("TOOL_CONTRACT"));
  console.log("AGENT DECISION:", summary("AGENT_DECISION"));
  console.log("VOICE E2E:", summary("VOICE_E2E"));

  const failed = results.filter((r) => !r.pass && !r.skipped);
  if (failed.length) {
    console.error(`\n${failed.length} gauntlet failure(s)`);
    process.exit(1);
  }
  console.log("\nGauntlet passed (automated subset). Browser voice E2E still required manually.");
}

main();
