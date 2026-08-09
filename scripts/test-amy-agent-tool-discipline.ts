#!/usr/bin/env npx tsx
/**
 * Local Amy agent tool-discipline probe — no PSTN, no production deploy required.
 *
 * 1. Prints analysis of the latest production call (if DATABASE_URL points at prod)
 * 2. Deterministic checks: tool surface + instructions after field collection
 * 3. Optional LLM probe: asks the configured model to choose a tool (Deepseek/Gemini/OpenAI)
 *
 * Run:
 *   npm run test:amy-agent-tool-discipline
 *   RUN_LLM_PROBE=1 npm run test:amy-agent-tool-discipline
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
import { liveKitRuntimeProvider } from "../src/lib/voice/runtime-provider/livekit";
import {
  bootstrapLiveKitCallContext,
  domainRecordField,
  taskForWorkflowState,
} from "../src/lib/voice/domain-actions";
import {
  buildAmyAgentInstructions,
  buildAmyToolList,
  syncAmyAgentFromContext,
} from "../voice-runtime/src/amy-tools";

const AMY_AGENT_ID = process.env.AMY_AGENT_ID || "cmshz2lc25c622c4i58303501";
const RUN_LLM_PROBE = process.env.RUN_LLM_PROBE === "1" || process.env.RUN_LLM_PROBE === "true";

type OpenAiTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

const failures: string[] = [];

function fail(msg: string) {
  failures.push(msg);
  console.error("✗", msg);
}

function pass(msg: string) {
  console.log("✓", msg);
}

function openAiToolsFromAmy(
  tools: ReturnType<typeof buildAmyToolList>["tools"],
): OpenAiTool[] {
  const schemas: Record<string, Record<string, unknown>> = {
    check_availability: {
      type: "object",
      properties: {
        spoken: { type: "string", description: "Caller time preference" },
      },
      required: ["spoken"],
    },
    record_current_field: {
      type: "object",
      properties: {
        value: { type: "string", description: "Caller answer for active field" },
      },
      required: ["value"],
    },
    select_slot: {
      type: "object",
      properties: {
        selection: { type: "string", description: "Caller slot choice" },
      },
      required: ["selection"],
    },
    confirm_booking: {
      type: "object",
      properties: {
        confirmed: { type: "boolean" },
      },
      required: ["confirmed"],
    },
    get_booking_requirements: { type: "object", properties: {} },
    request_human: {
      type: "object",
      properties: { reason: { type: "string" } },
    },
    take_message: {
      type: "object",
      properties: {
        message: { type: "string" },
        caller_name: { type: "string" },
      },
      required: ["message"],
    },
    end_call: {
      type: "object",
      properties: { reason: { type: "string" } },
    },
  };

  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.id,
      description: tool.description || tool.id,
      parameters: schemas[tool.id] || { type: "object", properties: {} },
    },
  }));
}

function detectAvailabilitySpeechWithoutTool(text: string): boolean {
  const lower = text.toLowerCase();
  const mentionsAvailability =
    /\b(check(ing)?|look(ing)?)\b.*\bavailab/.test(lower) ||
    /\bavailab/.test(lower) && /\b(let me|i'll|i will|one moment|hold on)\b/.test(lower);
  const offersTime =
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(lower) &&
    /\b(\d{1,2}\s*(am|pm)|morning|afternoon|evening)\b/.test(lower);
  return mentionsAvailability || offersTime;
}

async function inspectLatestProductionCall(): Promise<void> {
  console.log("\n## Latest production call\n");
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { agentId: AMY_AGENT_ID },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      startedAt: true,
      endedAt: true,
      appointmentBooked: true,
      metadata: true,
    },
  });
  if (!call) {
    console.log("No calls found for agent", AMY_AGENT_ID);
    return;
  }

  const meta = (call.metadata || {}) as Record<string, unknown>;
  const runtime = (meta.agentRuntime || {}) as Record<string, unknown>;
  const trace = Array.isArray(meta.executionTrace) ? meta.executionTrace : [];
  const toolsCalled = trace
    .filter((e) => (e as { kind?: string }).kind === "livekit_tool")
    .map((e) => (e as { tool?: string }).tool);

  console.log(
    JSON.stringify(
      {
        callId: call.id,
        startedAt: call.startedAt,
        endedAt: call.endedAt,
        appointmentBooked: call.appointmentBooked,
        runtimeState: runtime.state,
        proposedSlots: (runtime.proposed_slots as string[] | undefined)?.length || 0,
        heldSlot: runtime.held_slot || null,
        toolsCalled,
        traceEvents: trace.length,
      },
      null,
      2,
    ),
  );

  if (toolsCalled.includes("record_current_field") && !toolsCalled.includes("check_availability")) {
    const lastRecord = trace.find(
      (e) => (e as { tool?: string }).tool === "record_current_field",
    ) as { detail?: { workflow_state?: string; next_action?: string } } | undefined;
    if (lastRecord?.detail?.workflow_state === "CHECKING_AVAILABILITY") {
      console.log(
        "\n⚠ DIAGNOSIS: Last field save advanced workflow to CHECKING_AVAILABILITY but check_availability did not complete.",
      );
      console.log(
        "   Likely cause: LiveKit same-turn tool chain — model called check_availability but runtime",
      );
      console.log(
        '   rejected it as "unknown AI function" because tools were scoped mid-turn. See toolsForTaskWithChain fix.',
      );
    }
  }
}

async function buildCheckingAvailabilityContext() {
  process.env.VOICE_RUNTIME_PROVIDER = "livekit";
  resetRealtimeSessionStoreForTests(new InMemoryRealtimeSessionStore());

  const ctx = await createPreprodTenant();
  const { callId } = await liveKitRuntimeProvider.bootstrapSession({
    workspaceId: ctx.workspaceId,
    agentId: ctx.agentId,
    fromE164: "+14155550123",
    toE164: ctx.toE164,
    livekitRoomName: "tool-discipline-probe",
  });
  ctx.callIds.push(callId);

  const callContext = await bootstrapLiveKitCallContext({
    callId,
    workspaceId: ctx.workspaceId,
    agentId: ctx.agentId,
    fromE164: "+14155550123",
    toE164: ctx.toE164,
  });

  for (let i = 0; i < 8; i++) {
    if (!callContext.session.missingFieldIds.length) break;
    const sample = sampleValueForManifestField(
      callContext.session,
      callContext.session.activeField,
      i,
    );
    await domainRecordField({ ctx: callContext, value: sample });
  }

  return { ctx, callContext, callId };
}

async function runDeterministicProbe(
  callContext: Awaited<ReturnType<typeof bootstrapLiveKitCallContext>>,
): Promise<void> {
  console.log("\n## Deterministic agent surface (post field-collection)\n");

  const state = callContext.session.currentState;
  const taskId = taskForWorkflowState(state);
  const { tools } = buildAmyToolList(callContext);
  const toolIds = tools.map((t) => t.id);
  const instructions = buildAmyAgentInstructions(callContext);

  if (state !== "CHECKING_AVAILABILITY") {
    fail(`expected CHECKING_AVAILABILITY, got ${state}`);
  } else {
    pass(`workflow state is CHECKING_AVAILABILITY`);
  }

  if (!toolIds.includes("check_availability")) {
    fail(`check_availability missing from tools: ${toolIds.join(", ")}`);
  } else {
    pass(`check_availability exposed to model (${toolIds.join(", ")})`);
  }

  if (toolIds.includes("record_current_field")) {
    fail(`record_current_field should not be available in CHECKING_AVAILABILITY`);
  } else {
    pass("record_current_field correctly removed");
  }

  if (!instructions.includes("check_availability")) {
    fail("instructions do not mention check_availability");
  } else {
    pass("instructions mention check_availability");
  }

  if (!instructions.includes("CURRENT TASK: Check calendar availability")) {
    fail("phase task context missing CHECKING_AVAILABILITY block");
  } else {
    pass("phase task context present");
  }

  const mockSession = {
    currentAgent: {
      updateInstructions: async () => undefined,
      updateTools: async () => undefined,
    },
    userData: { callContext },
  } as unknown as Parameters<typeof syncAmyAgentFromContext>[0];

  await syncAmyAgentFromContext(mockSession, callContext);
  const syncedTools = callContext.lastAgentSync?.toolNames || [];
  if (!syncedTools.includes("check_availability")) {
    fail(`amy_agent_sync did not expose check_availability: ${syncedTools.join(", ")}`);
  } else {
    pass(`amy_agent_sync exposes check_availability (${syncedTools.join(", ")})`);
  }
}

type LlmProbeResult = {
  provider: string;
  content: string;
  toolCalls: Array<{ name: string; arguments: string }>;
};

async function callDeepseekProbe(
  instructions: string,
  userMessage: string,
  tools: OpenAiTool[],
): Promise<LlmProbeResult> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DEEPSEEK_API_KEY not set");

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: instructions },
        { role: "user", content: userMessage },
      ],
      tools,
      tool_choice: "auto",
      temperature: 0.2,
    }),
  });
  const json = (await res.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
        tool_calls?: Array<{ function?: { name?: string; arguments?: string } }>;
      };
    }>;
  };
  const message = json.choices?.[0]?.message;
  return {
    provider: "deepseek",
    content: message?.content || "",
    toolCalls: (message?.tool_calls || []).map((tc) => ({
      name: tc.function?.name || "",
      arguments: tc.function?.arguments || "{}",
    })),
  };
}

async function callGeminiProbe(
  instructions: string,
  userMessage: string,
  tools: OpenAiTool[],
): Promise<LlmProbeResult> {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: instructions }] },
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        tools: [
          {
            function_declarations: tools.map((t) => ({
              name: t.function.name,
              description: t.function.description,
              parameters: t.function.parameters,
            })),
          },
        ],
        tool_config: { function_calling_config: { mode: "AUTO" } },
      }),
    },
  );
  const json = (await res.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
          functionCall?: { name?: string; args?: Record<string, unknown> };
        }>;
      };
    }>;
  };
  const parts = json.candidates?.[0]?.content?.parts || [];
  const text = parts.map((p) => p.text || "").join("");
  const toolCalls = parts
    .filter((p) => p.functionCall?.name)
    .map((p) => ({
      name: p.functionCall!.name!,
      arguments: JSON.stringify(p.functionCall!.args || {}),
    }));
  return { provider: "gemini", content: text, toolCalls };
}

async function runLlmProbe(
  callContext: Awaited<ReturnType<typeof bootstrapLiveKitCallContext>>,
): Promise<void> {
  console.log("\n## LLM tool-discipline probe\n");

  const { tools } = buildAmyToolList(callContext);
  const instructions = buildAmyAgentInstructions(callContext);
  const openAiTools = openAiToolsFromAmy(tools);

  const scenarios = [
    {
      name: "caller gives time preference (should call check_availability)",
      user: "Tomorrow afternoon would work great for me.",
      expectTool: "check_availability",
    },
    {
      name: "caller asks to book without time (should call check_availability or ask then call)",
      user: "Yeah, I'd like to schedule someone to clean my garage.",
      expectTool: "check_availability",
      allowSpeechOnly: true,
    },
  ];

  let probe: ((i: string, u: string, t: OpenAiTool[]) => Promise<LlmProbeResult>) | null = null;
  if (process.env.DEEPSEEK_API_KEY) probe = callDeepseekProbe;
  else if (process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY) probe = callGeminiProbe;

  if (!probe) {
    console.log("Skipping LLM probe — set DEEPSEEK_API_KEY or GEMINI_API_KEY, or RUN_LLM_PROBE=1");
    return;
  }

  for (const scenario of scenarios) {
    console.log(`\nScenario: ${scenario.name}`);
    console.log(`User: "${scenario.user}"`);
    const result = await probe(instructions, scenario.user, openAiTools);
    console.log(`Provider: ${result.provider}`);
    console.log(`Assistant text: ${result.content.slice(0, 200) || "(none)"}`);
    console.log(`Tool calls: ${result.toolCalls.map((t) => t.name).join(", ") || "(none)"}`);

    const calledExpected = result.toolCalls.some((t) => t.name === scenario.expectTool);
    const speechOnlyFailure =
      !calledExpected &&
      result.content &&
      detectAvailabilitySpeechWithoutTool(result.content);

    if (calledExpected) {
      pass(`${scenario.name}: model called ${scenario.expectTool}`);
    } else if (speechOnlyFailure) {
      fail(
        `${scenario.name}: model talked about availability/times WITHOUT calling ${scenario.expectTool}`,
      );
    } else if (scenario.allowSpeechOnly && result.content && !result.toolCalls.length) {
      console.log("  ~ model responded with speech only (may need follow-up turn)");
    } else {
      fail(
        `${scenario.name}: expected ${scenario.expectTool}, got tools=[${result.toolCalls.map((t) => t.name).join(", ")}]`,
      );
    }
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }

  await inspectLatestProductionCall();

  const { ctx, callContext } = await buildCheckingAvailabilityContext();
  try {
    await runDeterministicProbe(callContext);
    if (RUN_LLM_PROBE) {
      await runLlmProbe(callContext);
    } else {
      console.log(
        "\n(Tip: RUN_LLM_PROBE=1 npm run test:amy-agent-tool-discipline to test if the LLM actually calls check_availability)",
      );
    }
  } finally {
    await cleanupPreprodTenant(ctx);
  }

  console.log(`\nOVERALL: ${failures.length ? "FAIL" : "PASS"}`);
  if (failures.length) {
    failures.forEach((f) => console.error(" -", f));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
