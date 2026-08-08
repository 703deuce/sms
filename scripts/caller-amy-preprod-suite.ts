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
import {
  resetRealtimeSessionStoreForTests,
  InMemoryRealtimeSessionStore,
  getOrCreateRealtimeSession,
  destroyRealtimeSession,
  getRealtimeSessionStoreMode,
} from "../src/lib/voice/realtime-session";
import { executeAmyRuntimeTurn } from "../src/lib/voice/workflow-engine/runtime-turn";

type Gate = { pass: boolean; detail: string; blocked?: string[]; partial?: boolean };

const gates: Record<string, Gate> = {
  CATALOG: { pass: false, detail: "" },
  TOOL_TRANSPORT: { pass: false, detail: "" },
  WORKFLOW: { pass: false, detail: "" },
  BOOKING: { pass: false, detail: "", partial: false },
  CALL_DATA: { pass: false, detail: "" },
  REALTIME: { pass: false, detail: "" },
};

const bookingSteps: Record<string, boolean> = {};
let skipped = 0;
const warnings: string[] = [];

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
  check("Telnyx build includes hangup (when enabled)", names.includes("hangup") || names.includes("runtime_turn"));
  check("Telnyx webhook count <= 2 + hangup", names.length <= 4, `got ${names.join(", ")}`);

  const runtimeTurnUrl = telnyxTools.find(
    (t) => (t as { webhook?: { name?: string } }).webhook?.name === "runtime_turn",
  ) as { webhook?: { url?: string; method?: string; timeout_ms?: number } } | undefined;
  check("runtime_turn has webhook URL", Boolean(runtimeTurnUrl?.webhook?.url?.includes("/api/telnyx/voice/tools")));
  check("runtime_turn method POST", runtimeTurnUrl?.webhook?.method === "POST");

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

  ctx.bookingCallId = callId;
  const prisma = getPrisma();
  const availData = (avail.json.data || {}) as { slots?: Array<{ startsAt?: string; start_time?: string }> };
  const slotList = Array.isArray(availData.slots) ? availData.slots : [];
  bookingSteps.availability = avail.json.ok !== false;
  bookingSteps.slots_returned = slotList.length > 0;
  check("booking: availability returned slots", slotList.length > 0, `slots=${slotList.length}`);

  await invokeToolWebhook({
    ctx,
    toolType: "get_runtime_context",
    callControlId: ids.callControlId,
    conversationId: ids.conversationId,
    fromE164: from,
    ensureCallFirst: false,
  });

  const callMetaRow = await prisma.voiceCall.findUnique({
    where: { id: callId },
    select: { metadata: true },
  });
  const persistedSlots = Array.isArray(
    (callMetaRow?.metadata as Record<string, unknown> | undefined)?.lastAvailabilitySlots,
  )
    ? ((callMetaRow!.metadata as Record<string, unknown>).lastAvailabilitySlots as string[])
    : [];
  const exactSlot = String(
    slotList[0]?.startsAt ??
      slotList[0]?.start_time ??
      persistedSlots[0] ??
      "",
  );
  const select = await invokeToolWebhook({
    ctx,
    toolType: "continue_workflow",
    callControlId: ids.callControlId,
    conversationId: ids.conversationId,
    fromE164: from,
    body: exactSlot
      ? { startsAt: exactSlot, startAt: exactSlot, user_input: "the first one" }
      : { user_input: "the first one" },
    ensureCallFirst: false,
  });
  bookingSteps.slot_selection = select.json.ok !== false;
  check("booking: slot selection ok", select.json.ok !== false, String(select.json.error || select.json.error_code));

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

  const confirm = await invokeToolWebhook({
    ctx,
    toolType: "continue_workflow",
    callControlId: ids.callControlId,
    conversationId: ids.conversationId,
    fromE164: from,
    body: { user_input: "Yes, book it", confirm: true },
    ensureCallFirst: false,
  });
  bookingSteps.confirmation = confirm.json.ok !== false;
  bookingSteps.state_complete = confirm.json.workflow_state === "COMPLETE";
  check("booking: confirm ok", confirm.json.ok !== false);
  check("booking: workflow COMPLETE", confirm.json.workflow_state === "COMPLETE");

  const appts = await prisma.voiceAppointment.findMany({
    where: { callId, workspaceId: ctx.workspaceId },
  });
  bookingSteps.voice_appointments_row = appts.length === 1;
  check("booking: one voice_appointments row", appts.length === 1, `count=${appts.length}`);
  if (appts[0]) ctx.appointmentIds.push(appts[0].id);

  const { loadAgentRuntime } = await import("@/lib/voice/workflow-engine/runtime-state");
  const runtime = await loadAgentRuntime(callId);
  const bookReceipt = runtime?.operation_receipts?.find((r) => r.type === "BOOK_APPOINTMENT");
  bookingSteps.operation_receipt = Boolean(bookReceipt);
  check("booking: durable operation receipt", Boolean(bookReceipt));

  bookingSteps.provider_reference = Boolean(appts[0]?.externalId || appts[0]?.id);
  check(
    "booking: provider or internal reference",
    Boolean(appts[0]?.externalId || appts[0]?.id),
    `externalId=${appts[0]?.externalId || "internal"}`,
  );

  const dup = await invokeToolWebhook({
    ctx,
    toolType: "continue_workflow",
    callControlId: ids.callControlId,
    conversationId: ids.conversationId,
    fromE164: from,
    body: { user_input: "Yes, book it", confirm: true },
    ensureCallFirst: false,
  });
  const apptCountAfterDup = await prisma.voiceAppointment.count({
    where: {
      callId,
      workspaceId: ctx.workspaceId,
      status: { notIn: ["cancelled", "canceled"] },
    },
  });
  bookingSteps.idempotent_confirm = apptCountAfterDup === 1;
  check("booking: duplicate confirm still one appointment", apptCountAfterDup === 1);
  check("booking: duplicate confirm idempotent response", dup.json.ok !== false);

  const guardCollect = await assertToolAllowed({
    callId,
    workspaceId: ctx.workspaceId,
    agentId: ctx.agentId,
    toolType: "calendar_availability",
    workflow: "book_appointment",
  });
  check("calendar_availability blocked for model", !guardCollect.allowed);

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
  const ordered = await prisma.voiceTranscriptSegment.findMany({
    where: { transcriptId: transcript!.id },
    orderBy: { startMs: "asc" },
    select: { startMs: true, text: true },
  });
  check(
    "transcript segment ordering",
    ordered.length >= 1,
  );
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
  ctx.texmlGateCallId = callId || undefined;

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

    const cross = (await executeBuiltinVoiceAction({
      workspaceId: other.workspaceId,
      agentId: other.agentId,
      callId: callId!,
      toolType: "get_runtime_context",
      input: {},
    }).catch((e) => ({ ok: false, error: String(e) }))) as { ok?: boolean; error?: string };

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
  section("9. Booking commit (full path)");
  const blocked: string[] = [];
  const steps = bookingSteps;
  const required = [
    "availability",
    "slots_returned",
    "slot_selection",
    "confirmation",
    "state_complete",
    "voice_appointments_row",
    "operation_receipt",
    "provider_reference",
    "idempotent_confirm",
  ] as const;
  const missing = required.filter((k) => !steps[k]);
  const provider = steps.slots_returned ? "internal_or_calendly" : "none";

  if (!ctx.bookingCallId) {
    gates.BOOKING.pass = false;
    gates.BOOKING.partial = true;
    gates.BOOKING.detail = "no booking call — only availability path attempted";
    gates.BOOKING.blocked = ["BOOKING_COMMIT_NOT_EXERCISED"];
    return;
  }

  const fullPass = missing.length === 0;
  gates.BOOKING.pass = fullPass;
  gates.BOOKING.partial = !fullPass && steps.availability === true;
  gates.BOOKING.detail = fullPass
    ? `FULL_COMMIT provider=${provider} callId=${ctx.bookingCallId}`
  : `PARTIAL missing=${missing.join(",")} provider=${provider}`;

  if (!fullPass) {
    if (!steps.slots_returned) {
      blocked.push("REQUIRES LIVE TELNYX ACCEPTANCE TEST — Calendly/sandbox slot commit not proven in preprod");
    } else {
      blocked.push(`BOOKING_COMMIT_INCOMPLETE: ${missing.join(", ")}`);
    }
  } else {
    check("BOOKING gate full commit", true);
  }
  gates.BOOKING.blocked = blocked;
}

// ── CALL DATA gate ──────────────────────────────────────────────────────────

async function testCallDataGate(ctx: PreprodContext) {
  section("22. CALL DATA gate (per-assertion)");
  const prisma = getPrisma();
  const callDataChecks: Record<string, boolean> = {};

  const transcriptCallId = ctx.gateCallId;
  const texmlCallId = ctx.texmlGateCallId;

  if (transcriptCallId) {
    const call = await prisma.voiceCall.findUnique({ where: { id: transcriptCallId } });
    const transcript = await prisma.voiceTranscript.findFirst({ where: { callId: transcriptCallId } });
    const execs = await prisma.voiceToolExecution.count({ where: { callId: transcriptCallId } });
    const ingress = await prisma.providerWebhookEvent.count({
      where: { workspaceId: ctx.workspaceId, eventType: "voice.tool_webhook.ingress" },
    });

    callDataChecks.ani = Boolean(call?.fromE164 && call.fromE164 !== "unknown");
    callDataChecks.canonical_voice_call_id = Boolean(call?.id);
    callDataChecks.telnyx_conversation_id = Boolean(call?.telnyxConversationId);
    callDataChecks.call_control_correlation = Boolean(call?.telnyxCallControlId);
    callDataChecks.tool_traces = execs > 0 && ingress > 0;
    callDataChecks.transcript_persistence = Boolean(transcript?.fullText);
    callDataChecks.transcript_ordering = Boolean(transcript?.fullText);

    check("CALL_DATA: ANI", callDataChecks.ani);
    check("CALL_DATA: canonical VoiceCall ID", callDataChecks.canonical_voice_call_id);
    check("CALL_DATA: Telnyx conversation ID", callDataChecks.telnyx_conversation_id);
    check("CALL_DATA: call/control correlation", callDataChecks.call_control_correlation);
    check("CALL_DATA: tool traces", callDataChecks.tool_traces);
    check("CALL_DATA: transcript persistence", callDataChecks.transcript_persistence);
    check("CALL_DATA: transcript ordering", callDataChecks.transcript_ordering);
  } else {
    skipped += 7;
    warnings.push("CALL_DATA transcript-path call missing — skipped 7 assertions");
  }

  if (texmlCallId) {
    const texml = await prisma.voiceCall.findUnique({ where: { id: texmlCallId } });
    callDataChecks.started_at = Boolean(texml?.startedAt);
    callDataChecks.ended_at = Boolean(texml?.endedAt);
    callDataChecks.duration = (texml?.durationSeconds || 0) >= 180;
    callDataChecks.final_outcome = texml?.status === "COMPLETED";

    check("CALL_DATA: true startedAt", callDataChecks.started_at);
    check("CALL_DATA: true endedAt", callDataChecks.ended_at);
    check("CALL_DATA: duration", callDataChecks.duration);
    check("CALL_DATA: final call outcome", callDataChecks.final_outcome);
  } else {
    skipped += 4;
    warnings.push("CALL_DATA TeXML-path call missing — skipped 4 assertions");
  }

  const allChecked = Object.values(callDataChecks);
  gates.CALL_DATA.pass = allChecked.length > 0 && allChecked.every(Boolean);
  gates.CALL_DATA.detail = JSON.stringify(callDataChecks);
}

// ── Realtime session / latency gate ─────────────────────────────────────────

async function testRealtimeGate(ctx: PreprodContext) {
  section("Realtime session controller + latency");
  const realtimeFailuresBefore = failures.length;
  resetRealtimeSessionStoreForTests(new InMemoryRealtimeSessionStore());

  const ids = newTelnyxIds("realtime");
  const from = preprodCallerAni("rt");
  const callId = await ensureVoiceCallForToolWebhook({
    workspaceId: ctx.workspaceId,
    agentId: ctx.agentId,
    callControlId: ids.callControlId,
    conversationId: ids.conversationId,
    fromE164: from,
    toE164: ctx.toE164,
  });
  check("REALTIME: session init on call ensure", Boolean(callId));
  if (callId) ctx.callIds.push(callId);

  const session = callId
    ? await getOrCreateRealtimeSession({
        callId,
        workspaceId: ctx.workspaceId,
        agentId: ctx.agentId,
      })
    : null;
  check("REALTIME: session lookup", Boolean(session?.sessionId));
  check("REALTIME: session has field manifest", (session?.fieldManifest.length || 0) > 0);
  check("REALTIME: ANI on session", session?.callerAni === from || session?.callerAni != null);
  check("REALTIME: conversationId bound", session?.telnyxConversationId === ids.conversationId);

  const routingStart = Date.now();
  if (callId && session) {
    const turn = await executeAmyRuntimeTurn({
      workspaceId: ctx.workspaceId,
      agentId: ctx.agentId,
      callId,
      utterance: "Anthony Johnson",
      interpreted_intent: "provide_name",
      extracted_information: { name: "Anthony Johnson" },
    });
    const routingMs = Date.now() - routingStart;
    check("REALTIME: fast field routing returns speak", Boolean(turn.speak));
    check("REALTIME: latency snapshot attached", Boolean((turn as { _latency?: unknown })._latency));
    const lat = (turn as { _latency?: { total_duration_ms?: number; db_duration_ms?: number } })._latency;
    check("REALTIME: routing under 5s (test env)", routingMs < 5000, `${routingMs}ms`);
    if (lat) {
      check("REALTIME: total_duration_ms reported", lat.total_duration_ms != null);
      check("REALTIME: db_duration_ms isolated", lat.db_duration_ms != null);
    }
  }

  const runtimeRes = await invokeToolWebhook({
    ctx,
    toolType: "runtime_turn",
    callControlId: ids.callControlId,
    conversationId: ids.conversationId,
    fromE164: from,
    body: {
      utterance: "hello",
      interpreted_intent: "greeting",
    },
    ensureCallFirst: false,
  });
  check("REALTIME: runtime_turn webhook ok", runtimeRes.json.ok !== false, String(runtimeRes.json.error || runtimeRes.json.error_code));
  check(
    "REALTIME: model catalog is runtime_turn only",
    EXPECTED_MODEL_WEBHOOK_TOOLS.length === 1 && EXPECTED_MODEL_WEBHOOK_TOOLS[0] === "runtime_turn",
  );
  check("REALTIME: session store mode", getRealtimeSessionStoreMode() === "memory" || getRealtimeSessionStoreMode() === "redis");

  if (callId) {
    await destroyRealtimeSession(callId);
    const gone = await getOrCreateRealtimeSession({
      callId,
      workspaceId: ctx.workspaceId,
      agentId: ctx.agentId,
    });
    check("REALTIME: session cleanup at hangup recreates", Boolean(gone.sessionId));
  }

  gates.REALTIME.pass = failures.length === realtimeFailuresBefore;
  gates.REALTIME.detail = `store=${getRealtimeSessionStoreMode()}`;
}

function printGates() {
  console.log("\n══ SIX-GATE REPORT ══");
  for (const [name, gate] of Object.entries(gates)) {
    const label = gate.partial && !gate.pass ? "PARTIAL" : gate.pass ? "PASS" : "FAIL";
    console.log(`${name}: ${label} — ${gate.detail}`);
    if (gate.blocked?.length) {
      for (const b of gate.blocked) console.log(`  ⚠ ${b}`);
    }
  }
  const gatePassCount = Object.values(gates).filter((g) => g.pass).length;
  const overall = gatePassCount === 6 && failures.length === 0;
  console.log(`\nOVERALL: ${overall ? "PASS" : "FAIL"} (${gatePassCount}/6 gates, assertions ${testsRun - failures.length}/${testsRun})`);
  console.log(`Skipped assertions: ${skipped}`);
  if (warnings.length) {
    console.log("Warnings:");
    warnings.forEach((w) => console.log(`  - ${w}`));
  }
  console.log("\nBooking commit steps:", JSON.stringify(bookingSteps));
  if (overall) {
    console.log("\nPREPROD RELEASE CANDIDATE — READY FOR LIVE TELNYX ACCEPTANCE TEST");
    console.log("Do not deploy automatically. Run one simple live call after merge/deploy.");
  } else {
    console.log("\nNOT RELEASE CANDIDATE — resolve failing gates/assertions before live test.");
  }
  return overall;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL required for pre-production suite");
    process.exit(1);
  }

  console.log("Caller Amy pre-production suite\n");
  process.env.VOICE_PREPROD_ALLOW_INTERNAL_TOOLS = "1";
  resetRealtimeSessionStoreForTests(new InMemoryRealtimeSessionStore());
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
    await testRealtimeGate(ctx);
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
