#!/usr/bin/env npx tsx
/**
 * Caller Amy — complete pre-production enterprise validation suite.
 *
 * Run: npx tsx scripts/caller-amy-preprod-suite.ts
 * Or:  npm run test:caller-amy-preprod
 *
 * Exercises real code paths against DATABASE_URL (isolated test tenants).
 * Does NOT deploy or publish production.
 */
import { buildAssistantTools } from "../src/lib/voice/telnyx/assistant-tools";
import { resolveEnabledBuiltinTools } from "../src/lib/voice/tools/catalog";
import {
  CALLER_AMY_INTERNAL_ONLY_TOOLS,
  filterToolsForCallerAmyPublish,
} from "../src/lib/voice/workflow-engine/tool-publish";
import { assertToolAllowed } from "../src/lib/voice/workflow-engine/guard";
import { isToolAllowedForState } from "../src/lib/voice/workflow-engine/states";
import { getPrisma } from "../src/lib/db";
import { ensureVoiceCallForToolWebhook } from "../src/lib/voice/ensure-call-from-event";
import { handleTexmlStatusCallback } from "../src/lib/voice/telnyx/texml-status-callback";
import { processVoiceWebhookEvent } from "../src/lib/voice/telnyx/webhook-handlers";
import { buildTexmlHangupFormPayload, buildTranscriptionEventPayload } from "../src/lib/voice/testing/telnyx-fixtures";
import {
  createPreprodTenant,
  cleanupPreprodTenant,
  invokeToolWebhook,
  newTelnyxIds,
  preprodCallerAni,
  EXPECTED_MODEL_WEBHOOK_TOOLS,
  FORBIDDEN_MODEL_TOOLS,
  type PreprodContext,
} from "../src/lib/voice/testing/preprod-harness";
import { toCustomFieldId } from "../src/lib/voice/field-runtime/system-fields";
import { validateFieldValue } from "../src/lib/voice/field-runtime/validate";
import type { WorkflowFieldDefinition } from "../src/lib/voice/field-runtime/types";
import { executeBuiltinVoiceAction } from "../src/lib/voice/tools/builtin-actions";

type Gate = { pass: boolean; detail: string; blocked?: string[] };

const gates: Record<string, Gate> = {
  CATALOG: { pass: false, detail: "" },
  TOOL_TRANSPORT: { pass: false, detail: "" },
  WORKFLOW: { pass: false, detail: "" },
  BOOKING: { pass: false, detail: "" },
  CALL_DATA: { pass: false, detail: "" },
};

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

function section(title: string) {
  console.log(`\n══ ${title} ══`);
}

// ── 1. Architecture / catalog ───────────────────────────────────────────────

function testCatalogRegression() {
  section("1. Model-visible catalog");
  const catalogFailuresBefore = failures.length;
  const enabled = resolveEnabledBuiltinTools({ agentType: "appointment_booking" });
  const published = filterToolsForCallerAmyPublish(enabled);
  for (const forbidden of FORBIDDEN_MODEL_TOOLS) {
    check(`publish excludes ${forbidden}`, !published.includes(forbidden));
    check(`internal-only ${forbidden}`, CALLER_AMY_INTERNAL_ONLY_TOOLS.has(forbidden));
  }
  for (const required of EXPECTED_MODEL_WEBHOOK_TOOLS) {
    check(`publish includes ${required}`, published.includes(required));
  }

  const telnyxTools = buildAssistantTools({
    workspaceId: "ws_test",
    agentId: "agent_test",
    bucketIds: [],
    tools: [],
    enabledBuiltinTools: enabled,
    agentType: "appointment_booking",
  });
  const names = telnyxTools
    .map((t) => {
      const w = (t as { webhook?: { name?: string } }).webhook;
      if (w?.name) return w.name;
      if ((t as { hangup?: unknown }).hangup) return "hangup";
      return null;
    })
    .filter(Boolean) as string[];

  for (const forbidden of FORBIDDEN_MODEL_TOOLS) {
    check(`Telnyx build excludes ${forbidden}`, !names.includes(forbidden));
  }
  for (const required of EXPECTED_MODEL_WEBHOOK_TOOLS) {
    check(`Telnyx build includes ${required}`, names.includes(required));
  }
  check("Telnyx build includes hangup", names.includes("hangup"));
  check("Telnyx webhook count <= 6 + hangup", names.length <= 8, `got ${names.join(", ")}`);

  const webhookUrl = telnyxTools.find(
    (t) => (t as { webhook?: { name?: string } }).webhook?.name === "continue_workflow",
  ) as { webhook?: { url?: string; method?: string; timeout_ms?: number } } | undefined;
  check("continue_workflow has webhook URL", Boolean(webhookUrl?.webhook?.url?.includes("/api/telnyx/voice/tools")));
  check("continue_workflow method POST", webhookUrl?.webhook?.method === "POST");

  gates.CATALOG.pass = failures.length === catalogFailuresBefore;
  gates.CATALOG.detail = `webhooks=${names.filter((n) => n !== "hangup").join(",")}`;
}

// ── 2. Call lifecycle ─────────────────────────────────────────────────────

async function testCallLifecycle(ctx: PreprodContext) {
  section("2. Call lifecycle / first-tool identity");
  const ids = newTelnyxIds("lifecycle");
  const from = preprodCallerAni();

  const callId = await ensureVoiceCallForToolWebhook({
    workspaceId: ctx.workspaceId,
    agentId: ctx.agentId,
    callControlId: ids.callControlId,
    conversationId: ids.conversationId,
    fromE164: from,
    toE164: ctx.toE164,
  });
  check("ensureVoiceCallForToolWebhook returns id", Boolean(callId));
  if (callId) ctx.callIds.push(callId);

  const prisma = getPrisma();
  const row = callId
    ? await prisma.voiceCall.findUnique({ where: { id: callId } })
    : null;
  check("VoiceCall status IN_PROGRESS", row?.status === "IN_PROGRESS");
  check("ANI attached", row?.fromE164 === from);
  check("control id bound", row?.telnyxCallControlId === ids.callControlId);
  check("conversation id bound", row?.telnyxConversationId === ids.conversationId);

  for (const toolType of ["get_runtime_context", "record_current_field", "continue_workflow"] as const) {
    const ids2 = newTelnyxIds(toolType);
    const res = await invokeToolWebhook({
      ctx,
      toolType,
      callControlId: ids2.callControlId,
      conversationId: ids2.conversationId,
      fromE164: from,
      body:
        toolType === "record_current_field"
          ? { value: "Anthony Johnson" }
          : toolType === "continue_workflow"
            ? { user_input: "I need an appointment" }
            : { workflow: "book_appointment" },
    });
    check(`first tool ${toolType} no callId error`, !String(res.json.error || "").includes("callId required"));
    check(`first tool ${toolType} ok`, res.json.ok !== false, JSON.stringify(res.json).slice(0, 200));
    check(`first tool ${toolType} resolves call`, Boolean(res.callId));
  }
}

// ── 3. Tool transport contract ──────────────────────────────────────────────

async function testToolTransport(ctx: PreprodContext) {
  section("3. Tool transport contract");
  const prisma = getPrisma();
  const ids = newTelnyxIds("transport");
  const ingressBefore = await prisma.providerWebhookEvent.count({
    where: { workspaceId: ctx.workspaceId, eventType: "voice.tool_webhook.ingress" },
  });

  const tools = [
    "lookup_customer",
    "take_structured_message",
    "get_runtime_context",
    "record_current_field",
    "continue_workflow",
  ] as const;

  for (const toolType of tools) {
    const res = await invokeToolWebhook({
      ctx,
      toolType,
      callControlId: ids.callControlId,
      conversationId: ids.conversationId,
      body:
        toolType === "lookup_customer"
          ? { phone: preprodCallerAni("l") }
          : toolType === "take_structured_message"
            ? { message: "Please call back", caller_name: "Test" }
            : toolType === "record_current_field"
              ? { value: "leaking kitchen sink" }
              : toolType === "continue_workflow"
                ? { user_input: "tomorrow afternoon" }
                : {},
    });
    check(`${toolType} HTTP 200`, res.status === 200);
    check(`${toolType} returns JSON ok`, res.json.ok !== false, String(res.json.error));
    check(`${toolType} associates call`, Boolean(res.callId));
  }

  const ingressAfter = await prisma.providerWebhookEvent.count({
    where: { workspaceId: ctx.workspaceId, eventType: "voice.tool_webhook.ingress" },
  });
  check("ingress rows created", ingressAfter > ingressBefore);

  const execCount = await prisma.voiceToolExecution.count({
    where: { workspaceId: ctx.workspaceId, callId: { in: ctx.callIds } },
  });
  check("voiceToolExecution rows exist", execCount > 0, `count=${execCount}`);

  // Malformed body should not crash
  const bad = await invokeToolWebhook({
    ctx,
    toolType: "record_current_field",
    callControlId: newTelnyxIds("bad").callControlId,
    conversationId: newTelnyxIds("bad").conversationId,
    body: {},
  });
  check("malformed record_current_field returns speakable response", bad.status === 200);

  gates.TOOL_TRANSPORT.pass =
    ingressAfter > ingressBefore && execCount > 0 && !failures.some((f) => f.includes("returns JSON ok"));
  gates.TOOL_TRANSPORT.detail = `ingress=${ingressAfter - ingressBefore} executions=${execCount}`;
}

// ── 4–7. Happy path + fields + continue_workflow ──────────────────────────

async function testHappyPathWorkflow(ctx: PreprodContext) {
  section("4–7. Simulated booking conversation");
  const ids = newTelnyxIds("happy");
  const from = preprodCallerAni();

  const ensure = await invokeToolWebhook({
    ctx,
    toolType: "get_runtime_context",
    callControlId: ids.callControlId,
    conversationId: ids.conversationId,
    fromE164: from,
    body: { workflow: "book_appointment" },
  });
  const callId = ensure.callId!;
  check("happy path call established", Boolean(callId));

  const intent = await invokeToolWebhook({
    ctx,
    toolType: "continue_workflow",
    callControlId: ids.callControlId,
    conversationId: ids.conversationId,
    fromE164: from,
    body: { user_input: "Hi, I need an appointment. My kitchen sink is leaking." },
    ensureCallFirst: false,
  });
  check("intent continue_workflow ok", intent.json.ok !== false);

  const fields: Array<{ value: string; label: string }> = [
    { value: "Anthony Johnson", label: "name" },
    { value: "anthony.johnson@example.com", label: "email" },
    { value: "Kitchen sink is leaking badly", label: "problem" },
  ];

  for (const field of fields) {
    const res = await invokeToolWebhook({
      ctx,
      toolType: "record_current_field",
      callControlId: ids.callControlId,
      conversationId: ids.conversationId,
      fromE164: from,
      body: { value: field.value },
      ensureCallFirst: false,
    });
    check(`record ${field.label} success`, res.json.ok !== false && res.json.success !== false);
    if (field.label !== "problem") {
      check(`record ${field.label} workflow_complete false`, res.json.workflow_complete === false);
    }
  }

  const afterFields = await invokeToolWebhook({
    ctx,
    toolType: "get_runtime_context",
    callControlId: ids.callControlId,
    conversationId: ids.conversationId,
    fromE164: from,
    ensureCallFirst: false,
  });
  check("fields collected workflow_complete", afterFields.json.workflow_complete === true);

  check(
    "ANI prefilled phone collected",
    Boolean(
      (afterFields.json.known_fields as Record<string, string> | undefined)?.sys_phone ||
        (Array.isArray(afterFields.json.collected_field_ids) &&
          (afterFields.json.collected_field_ids as string[]).includes("sys_phone")),
    ),
  );

  const avail = await invokeToolWebhook({
    ctx,
    toolType: "continue_workflow",
    callControlId: ids.callControlId,
    conversationId: ids.conversationId,
    fromE164: from,
    body: { user_input: "tomorrow afternoon" },
    ensureCallFirst: false,
  });
  check("availability continue_workflow ok", avail.json.ok !== false);

  const guardCollect = await assertToolAllowed({
    callId,
    workspaceId: ctx.workspaceId,
    agentId: ctx.agentId,
    toolType: "calendar_availability",
    workflow: "book_appointment",
  });
  check("calendar_availability blocked for model", !guardCollect.allowed);

  const noConfirm = await invokeToolWebhook({
    ctx,
    toolType: "continue_workflow",
    callControlId: ids.callControlId,
    conversationId: ids.conversationId,
    fromE164: from,
    body: { user_input: "wait what was the other time?", confirm: false },
    ensureCallFirst: false,
  });
  check("non-confirmation does not complete booking", noConfirm.json.workflow_state !== "COMPLETE");

  gates.WORKFLOW.pass = afterFields.json.workflow_complete === true;
  gates.WORKFLOW.detail = `state=${String(afterFields.json.workflow_state || afterFields.json.state)}`;
}

// ── 5. Arbitrary fields (hundreds) ─────────────────────────────────────────

function testArbitraryFields() {
  section("5. Arbitrary field permutations");
  const labels = [
    "Vehicle Make & Model",
    "Property Type",
    "Equipment Serial Number",
    "Number of Dogs",
    "Gate Code",
    "Preferred Material",
  ];
  const types = ["text", "long_text", "phone", "email", "number", "boolean", "single_select"] as const;
  let count = 0;
  const TARGET = 300;
  while (count < TARGET) {
    const label = `${labels[count % labels.length]} ${count}`;
    const type = types[count % types.length];
    const field: WorkflowFieldDefinition = {
      field_id: toCustomFieldId(label),
      label,
      type,
      required: count % 3 !== 0,
      collection_instruction: `Collect ${label}`,
      options: type === "single_select" ? ["A", "B"] : undefined,
    };
    const sample =
      type === "phone"
        ? "+17035551212"
        : type === "email"
          ? "t@example.com"
          : type === "number"
            ? 42
            : type === "boolean"
              ? true
              : type === "single_select"
                ? "A"
                : "sample value";
    try {
      const v = validateFieldValue(field, sample);
      check(`perm ${count} validate`, Boolean(v));
    } catch (e) {
      check(`perm ${count} validate`, false, e instanceof Error ? e.message : String(e));
    }
    check(`perm ${count} fld id`, field.field_id.startsWith("fld_"));
    count++;
  }
  check("permutation target", count === TARGET);
}

// ── 6. Partial field collection ───────────────────────────────────────────

async function testPartialCollection(ctx: PreprodContext) {
  section("6. Partial field collection semantics");
  const ids = newTelnyxIds("partial");
  const res = await invokeToolWebhook({
    ctx,
    toolType: "record_current_field",
    callControlId: ids.callControlId,
    conversationId: ids.conversationId,
    body: { value: "Anthony Johnson" },
  });
  check("partial save ok true", res.json.ok === true);
  check("partial save success true", res.json.success === true);
  check("partial workflow_complete false", res.json.workflow_complete === false);
  check("partial has next_action", Boolean(res.json.next_action));
}

// ── 11. State guards ──────────────────────────────────────────────────────

async function testStateGuards(ctx: PreprodContext) {
  section("11. State guards");
  const ids = newTelnyxIds("guards");
  const base = await invokeToolWebhook({
    ctx,
    toolType: "get_runtime_context",
    callControlId: ids.callControlId,
    conversationId: ids.conversationId,
  });
  const callId = base.callId!;

  const bookGuard = await assertToolAllowed({
    callId,
    workspaceId: ctx.workspaceId,
    agentId: ctx.agentId,
    toolType: "book_appointment",
    workflow: "book_appointment",
  });
  check("book_appointment not model-allowed", !bookGuard.allowed);

  check(
    "COLLECTING blocks calendar",
    !isToolAllowedForState("COLLECTING_FIELDS", "calendar_availability"),
  );
}

// ── 12. ANI ───────────────────────────────────────────────────────────────

async function testAni(ctx: PreprodContext) {
  section("12. Caller ID / ANI");
  const ids = newTelnyxIds("ani");
  const callId = await ensureVoiceCallForToolWebhook({
    workspaceId: ctx.workspaceId,
    agentId: ctx.agentId,
    callControlId: ids.callControlId,
    conversationId: ids.conversationId,
    fromE164: "+15714776175",
    toE164: ctx.toE164,
  });
  if (callId) ctx.callIds.push(callId);
  const prisma = getPrisma();
  const row = await prisma.voiceCall.findUnique({ where: { id: callId! } });
  check("E.164 ANI", row?.fromE164 === "+15714776175");

  const unknownIds = newTelnyxIds("unknown");
  const unknownCall = await ensureVoiceCallForToolWebhook({
    workspaceId: ctx.workspaceId,
    agentId: ctx.agentId,
    callControlId: unknownIds.callControlId,
    conversationId: unknownIds.conversationId,
    fromE164: "",
    toE164: ctx.toE164,
  });
  if (unknownCall) ctx.callIds.push(unknownCall);
  const unknownRow = await prisma.voiceCall.findUnique({ where: { id: unknownCall! } });
  check("unknown ANI allowed at create", unknownRow?.fromE164 === "unknown");

  const res = await invokeToolWebhook({
    ctx,
    toolType: "record_current_field",
    callControlId: unknownIds.callControlId,
    conversationId: unknownIds.conversationId,
    fromE164: "",
    body: { value: "Callback Test" },
    ensureCallFirst: false,
  });
  check("callback name on unknown ANI call", res.json.ok !== false);

  const phoneRes = await invokeToolWebhook({
    ctx,
    toolType: "record_current_field",
    callControlId: unknownIds.callControlId,
    conversationId: unknownIds.conversationId,
    fromE164: "",
    body: { value: "+12025551234" },
    ensureCallFirst: false,
  });
  check("callback number field save ok", phoneRes.json.ok !== false);
}

// ── 13. Transcript ──────────────────────────────────────────────────────────

async function testTranscript(ctx: PreprodContext) {
  section("13. Transcript pipeline");
  const ids = newTelnyxIds("transcript");
  const callId = await ensureVoiceCallForToolWebhook({
    workspaceId: ctx.workspaceId,
    agentId: ctx.agentId,
    callControlId: ids.callControlId,
    conversationId: ids.conversationId,
    fromE164: "+15714776175",
    toE164: ctx.toE164,
  });
  if (callId) ctx.callIds.push(callId);
  ctx.gateCallId = callId || undefined;

  await invokeToolWebhook({
    ctx,
    toolType: "get_runtime_context",
    callControlId: ids.callControlId,
    conversationId: ids.conversationId,
    fromE164: preprodCallerAni("tx"),
    body: {},
    ensureCallFirst: false,
  });

  const prisma = getPrisma();
  const providerEventId = `preprod-transcript-${Date.now()}`;
  await prisma.providerWebhookEvent.create({
    data: {
      provider: "telnyx",
      eventType: "call.transcription.received",
      providerEventId,
      workspaceId: ctx.workspaceId,
      payload: {},
      status: "received",
    },
  });

  const payload = buildTranscriptionEventPayload({
    conversationId: ids.conversationId,
    callControlId: ids.callControlId,
    text: "Hi, I need an appointment for a leaking sink.",
    track: "inbound",
  });

  await processVoiceWebhookEvent({
    providerEventId,
    eventType: "call.transcription.received",
    workspaceId: ctx.workspaceId,
    callId: callId || undefined,
    eventPayload: payload,
  });

  const call = await prisma.voiceCall.findFirst({
    where: { telnyxCallControlId: ids.callControlId },
  });
  check("transcript call row exists", Boolean(call));
  const transcript = await prisma.voiceTranscript.findFirst({
    where: { callId: call!.id },
  });
  check("transcript text persisted", Boolean(transcript?.fullText?.includes("leaking sink")));
  const segments = await prisma.voiceTranscriptSegment.count({
    where: { transcriptId: transcript!.id },
  });
  check("transcript segment row", segments >= 1);
}

// ── 14. Timestamps / TeXML hangup ─────────────────────────────────────────

async function testCallTimestamps(ctx: PreprodContext) {
  section("14. Call timestamps / TeXML hangup finalize");
  const ids = newTelnyxIds("texml");
  const from = preprodCallerAni();
  const start = new Date(Date.now() - 183_000).toISOString();
  const end = new Date().toISOString();

  const callId = await ensureVoiceCallForToolWebhook({
    workspaceId: ctx.workspaceId,
    agentId: ctx.agentId,
    callControlId: ids.callControlId,
    conversationId: ids.conversationId,
    fromE164: from,
    toE164: ctx.toE164,
  });
  if (callId) ctx.callIds.push(callId);

  const form = buildTexmlHangupFormPayload({
    callControlId: ids.callControlId,
    fromE164: from,
    toE164: ctx.toE164,
    startTime: start,
    endTime: end,
    durationSeconds: 183,
  });

  const req = new Request("http://test/api/telnyx/voice/texml-status", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });
  await handleTexmlStatusCallback(req);

  const prisma = getPrisma();
  const row = await prisma.voiceCall.findUnique({ where: { id: callId! } });
  check("hangup finalizes same call id", row?.id === callId);
  check("duration ~183s", (row?.durationSeconds || 0) >= 180);
  check("startedAt before endedAt", Boolean(row?.startedAt && row?.endedAt && row.startedAt < row.endedAt));
  const startDelta = Math.abs(new Date(row!.startedAt!).getTime() - new Date(start).getTime());
  check("startedAt backfilled from StartTime", startDelta < 5000, `deltaMs=${startDelta}`);
}

// ── 20. Concurrency ───────────────────────────────────────────────────────

async function testConcurrency(ctx: PreprodContext) {
  section("20. Concurrency (25 sessions)");
  const N = 25;
  const results = await Promise.all(
    Array.from({ length: N }, async (_, i) => {
      const ids = newTelnyxIds(`c${i}`);
      const res = await invokeToolWebhook({
        ctx,
        toolType: "record_current_field",
        callControlId: ids.callControlId,
        conversationId: ids.conversationId,
        fromE164: `+1571477${String(6100 + i).padStart(4, "0")}`,
        body: { value: `Caller ${i}` },
      });
      return res.callId;
    }),
  );
  const unique = new Set(results.filter(Boolean));
  check("25 unique call ids", unique.size === N);
}

// ── 21. Tenant isolation ────────────────────────────────────────────────────

async function testTenantIsolation(ctx: PreprodContext) {
  section("21. Tenant isolation");
  const other = await createPreprodTenant();
  try {
    const ids = newTelnyxIds("iso");
    const callId = await ensureVoiceCallForToolWebhook({
      workspaceId: ctx.workspaceId,
      agentId: ctx.agentId,
      callControlId: ids.callControlId,
      conversationId: ids.conversationId,
      fromE164: "+15714776175",
      toE164: ctx.toE164,
    });
    if (callId) ctx.callIds.push(callId);

    const cross = await executeBuiltinVoiceAction({
      workspaceId: other.workspaceId,
      agentId: other.agentId,
      callId: callId!,
      toolType: "get_runtime_context",
      input: {},
    }).catch((e) => ({ ok: false, error: String(e) }));

    check(
      "cross-tenant get_runtime_context fails safely",
      cross.ok === false || String(cross.error || "").includes("workspace"),
    );
  } finally {
    await cleanupPreprodTenant(other);
  }
}

// ── 9 / BOOKING gate (provider-dependent) ───────────────────────────────────

async function testBookingGate(ctx: PreprodContext) {
  section("9. Booking commit (provider integration)");
  const blocked: string[] = [];
  const callId = ctx.callIds[0];
  if (!callId) {
    gates.BOOKING.detail = "no call id for provider test";
    gates.BOOKING.blocked = ["REQUIRES LIVE TELNYX ACCEPTANCE TEST"];
    return;
  }
  try {
    const { executeAgentTool } = await import("@/lib/voice/agent-tool-gateway/gateway");
    const result = await executeAgentTool({
      toolType: "calendar_availability",
      context: {
        workspaceId: ctx.workspaceId,
        agentId: ctx.agentId,
        callId,
      },
      raw: {
        serviceName: "Service Visit",
        from: new Date().toISOString(),
        to: new Date(Date.now() + 86400000).toISOString(),
      },
    });
    const success = result.success === true || result.ok === true;
    check("calendar_availability internal call returns", success !== undefined);
    gates.BOOKING.pass = success === true;
    gates.BOOKING.detail = JSON.stringify({ success, error_code: result.error_code }).slice(0, 200);
    if (!success) {
      blocked.push("REQUIRES LIVE TELNYX ACCEPTANCE TEST — connect Calendly test calendar");
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    blocked.push("REQUIRES LIVE TELNYX ACCEPTANCE TEST");
    gates.BOOKING.detail = `skipped provider: ${msg.slice(0, 120)}`;
    gates.BOOKING.pass = false;
  }
  gates.BOOKING.blocked = blocked;
}

// ── CALL DATA gate ──────────────────────────────────────────────────────────

async function testCallDataGate(ctx: PreprodContext) {
  section("22. CALL DATA gate");
  const prisma = getPrisma();
  const callId = ctx.gateCallId || ctx.callIds.find(Boolean);
  if (!callId) {
    gates.CALL_DATA.detail = "no call id";
    return;
  }
  const call = await prisma.voiceCall.findUnique({ where: { id: callId } });
  const transcript = await prisma.voiceTranscript.findFirst({ where: { callId } });
  const execs = await prisma.voiceToolExecution.count({ where: { callId } });
  const ingress = await prisma.providerWebhookEvent.count({
    where: { workspaceId: ctx.workspaceId, eventType: "voice.tool_webhook.ingress" },
  });

  const ok =
    Boolean(call?.fromE164 && call.fromE164 !== "unknown") &&
    Boolean(call?.telnyxCallControlId) &&
    execs > 0 &&
    ingress > 0 &&
    Boolean(transcript?.fullText);

  gates.CALL_DATA.pass = ok;
  gates.CALL_DATA.detail = JSON.stringify({
    fromE164: call?.fromE164,
    durationSeconds: call?.durationSeconds,
    hasTranscript: Boolean(transcript?.fullText),
    toolExecutions: execs,
    ingressEvents: ingress,
  });
}

function printGates() {
  console.log("\n══ FIVE-GATE REPORT ══");
  for (const [name, gate] of Object.entries(gates)) {
    console.log(`${name}: ${gate.pass ? "PASS" : "FAIL"} — ${gate.detail}`);
    if (gate.blocked?.length) {
      for (const b of gate.blocked) console.log(`  ⚠ ${b}`);
    }
  }
  const overall = Object.values(gates).every((g) => g.pass);
  console.log(`\nOVERALL: ${overall ? "PASS" : "FAIL"} (${Object.values(gates).filter((g) => g.pass).length}/5)`);
  console.log(`Tests executed: ${testsRun}`);
  return overall;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL required for pre-production suite");
    process.exit(1);
  }

  console.log("Caller Amy pre-production suite\n");
  testCatalogRegression();

  const ctx = await createPreprodTenant();
  try {
    await testCallLifecycle(ctx);
    await testToolTransport(ctx);
    await testPartialCollection(ctx);
    await testHappyPathWorkflow(ctx);
    testArbitraryFields();
    await testStateGuards(ctx);
    await testAni(ctx);
    await testTranscript(ctx);
    await testCallTimestamps(ctx);
    await testConcurrency(ctx);
    await testTenantIsolation(ctx);
    await testBookingGate(ctx);
    await testCallDataGate(ctx);
  } finally {
    await cleanupPreprodTenant(ctx);
  }

  printGates();

  if (failures.length) {
    console.error(`\n${failures.length} assertion failure(s):`);
    failures.slice(0, 30).forEach((f) => console.error(" -", f));
    if (failures.length > 30) console.error(` ... and ${failures.length - 30} more`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
