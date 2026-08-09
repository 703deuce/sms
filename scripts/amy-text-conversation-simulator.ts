#!/usr/bin/env npx tsx
/**
 * Text conversation simulator for Amy's LiveKit workflow backend.
 *
 * Drives the real domain-action + workflow-runtime path without PSTN or LiveKit audio.
 * Uses the same LLM tool loop as production (OpenAI function calling).
 *
 * Usage:
 *   npm run simulate:amy-conversation -- --scenario toilet-leak
 *   npm run simulate:amy-conversation -- --interactive
 *   npm run simulate:amy-conversation -- --e2e
 *
 * Requires: DATABASE_URL, and OPENAI_API_KEY or DEEPSEEK_API_KEY for LLM modes
 * Optional: VOICE_LLM_PRESET=gpt-5-nano (defaults to gpt-4o-mini)
 */
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { getPrisma } from "../src/lib/db";
import {
  createPreprodTenant,
  cleanupPreprodTenant,
  type PreprodContext,
} from "../src/lib/voice/testing/preprod-harness";
import {
  resetRealtimeSessionStoreForTests,
  InMemoryRealtimeSessionStore,
} from "../src/lib/voice/realtime-session";
import { liveKitRuntimeProvider } from "../src/lib/voice/runtime-provider/livekit";
import {
  bootstrapLiveKitCallContext,
  domainDetectCallerIntent,
  domainLookupCustomer,
  type LiveKitCallContext,
} from "../src/lib/voice/domain-actions";
import { HOME_SERVICE_DISPATCHER_WORKFLOW_V1 } from "../src/lib/voice/workflow-runtime/definitions/home-service-dispatcher";
import { persistVoiceWorkflowDefinition } from "../src/lib/voice/workflow-runtime/persistence";
import { setActiveWorkflowForAgent } from "../src/lib/voice/workflow-runtime/loader";
import { applyWorkflowNodeTransition } from "../src/lib/voice/workflow-runtime/node-transitions";
import { hasBookingReceipt } from "../src/lib/voice/workflow-runtime/completion-guards";
import { compileToolsForCallContext } from "../src/lib/voice/workflow-runtime/compile-for-call";
import {
  buildConversationMessages,
  formatTurnReport,
  processCallerTurn,
  snapshotState,
  type ConversationTurnResult,
} from "../src/lib/voice/testing/text-conversation-driver";
import {
  appendDeterministicMessages,
  deterministicAssistantReply,
  planDeterministicToolCalls,
} from "../src/lib/voice/testing/deterministic-caller-brain";
import {
  getScenario,
  listScenarioIds,
  type ConversationScenario,
} from "../src/lib/voice/testing/conversation-scenarios";
import { generateCallerUtterance } from "../src/lib/voice/testing/llm-caller-brain";
import { executeWorkflowTool } from "../src/lib/voice/testing/workflow-tool-executor";
import { hasLlmConfigured, providers } from "../src/lib/ai/llm-providers";

type CliOptions = {
  scenario?: string;
  interactive: boolean;
  deterministic: boolean;
  e2e: boolean;
  llmCaller: boolean;
  requireBooking: boolean;
  maxTurns: number;
  json: boolean;
  help: boolean;
  callerPhone?: string;
};

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    interactive: false,
    deterministic: false,
    e2e: false,
    llmCaller: false,
    requireBooking: false,
    maxTurns: 20,
    json: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--interactive" || arg === "-i") opts.interactive = true;
    else if (arg === "--deterministic" || arg === "-d") opts.deterministic = true;
    else if (arg === "--e2e") {
      opts.e2e = true;
      opts.requireBooking = true;
      opts.llmCaller = true;
    } else if (arg === "--llm-caller") opts.llmCaller = true;
    else if (arg === "--require-booking") opts.requireBooking = true;
    else if (arg === "--json") opts.json = true;
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else if (arg === "--scenario" || arg === "-s") opts.scenario = argv[++i];
    else if (arg === "--phone") opts.callerPhone = argv[++i];
    else if (arg === "--max-turns") opts.maxTurns = Number(argv[++i]) || 20;
  }
  if (!opts.scenario && !opts.interactive) {
    opts.scenario = "toilet-leak";
  }
  return opts;
}

function printHelp() {
  console.log(`Amy text conversation simulator

Runs full multi-turn conversations against the real workflow backend without phone calls.

Options:
  --scenario, -s <id>   Run a scripted caller scenario (default: toilet-leak)
  --interactive, -i     Type caller lines manually (type 'quit' to exit)
  --deterministic, -d   Rule-based tool planner (no LLM API key; good for CI)
  --e2e                 Full E2E: real Amy LLM + LLM caller until booking receipt
  --llm-caller            Use LLM to generate caller lines (pairs with real Amy LLM)
  --require-booking     Fail unless confirm_booking returns a real bookingId
  --max-turns <n>       Max conversation turns (default 20)
  --json                Emit machine-readable summary at end
  --phone <e164>        Caller phone for lookup/bootstrap
  --help, -h            Show this help

Scenarios:
${listScenarioIds()
  .map((id) => `  - ${id}: ${getScenario(id).description}`)
  .join("\n")}

Examples:
  npm run simulate:amy-conversation
  npm run simulate:amy-conversation -- --scenario simple-hvac
  npm run simulate:amy-conversation -- --interactive
`);
}

async function seedDispatcherTenant(ctx: PreprodContext, callerPhone: string) {
  const prisma = getPrisma();

  await persistVoiceWorkflowDefinition({
    workspaceId: ctx.workspaceId,
    agentId: ctx.agentId,
    definition: HOME_SERVICE_DISPATCHER_WORKFLOW_V1,
    setActive: true,
  });
  setActiveWorkflowForAgent(ctx.agentId, {
    workflowId: "home_service_dispatcher",
    version: 1,
  });

  await prisma.voiceAgent.update({
    where: { id: ctx.agentId },
    data: {
      draftConfig: {
        agentType: "appointment_booking",
        knowledgeBase: {
          pricing: { serviceCallFee: "$89", serviceCallScript: "Our diagnostic visit is $89." },
          businessHours: "Mon-Fri 8am-6pm",
        },
        conversationFlow: {
          sections: [
            {
              id: "booking",
              type: "booking",
              config: {
                collectFields: [
                  { id: "name", label: "Name", type: "text", required: true, question: "Your name?", enabled: true, askOrder: 1 },
                  { id: "phone", label: "Phone", type: "phone", required: true, question: "Phone?", enabled: true, askOrder: 2 },
                  { id: "email", label: "Email", type: "email", required: true, question: "Email?", enabled: true, askOrder: 3 },
                  { id: "fld_problem", label: "Problem", type: "long_text", required: true, question: "What's the issue?", enabled: true, askOrder: 4 },
                  { id: "fld_service_address", label: "Address", type: "text", required: true, question: "Service address?", enabled: true, askOrder: 5 },
                ],
              },
            },
          ],
        },
      } as object,
    },
  });

  const service = await prisma.voiceService.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: "Plumbing Repair",
      durationMinutes: 60,
      bufferMinutes: 15,
      config: {
        enabled: true,
        requiredSkills: ["plumbing"],
        staffIds: [],
        bookingHours: "8-18",
        timezone: "America/New_York",
        minimumBookingNoticeMinutes: 0,
        maxDaysAhead: 30,
      } as object,
    },
  });

  const tech = await prisma.voiceStaffMember.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: "Tech A",
      config: { skills: ["plumbing"], zones: ["zone_b"], calendarConnected: true } as object,
    },
  });

  await prisma.voiceService.update({
    where: { id: service.id },
    data: {
      config: {
        ...(service.config as object),
        staffIds: [tech.id],
      } as object,
    },
  });

  return { callerPhone, service, tech };
}

function applySimulatorServiceContext(
  callContext: LiveKitCallContext,
  serviceName: string,
) {
  callContext.session.serviceName = serviceName;
}

async function bootstrapSimulatorCall(
  ctx: PreprodContext,
  callerPhone: string,
  serviceName = "Plumbing Repair",
): Promise<LiveKitCallContext> {
  const { callId } = await liveKitRuntimeProvider.bootstrapSession({
    workspaceId: ctx.workspaceId,
    agentId: ctx.agentId,
    fromE164: callerPhone,
    toE164: ctx.toE164,
    livekitRoomName: `text-sim-${Date.now()}`,
    livekitParticipantId: "text-caller",
  });
  ctx.callIds.push(callId);

  const callContext = await bootstrapLiveKitCallContext({
    callId,
    workspaceId: ctx.workspaceId,
    agentId: ctx.agentId,
    fromE164: callerPhone,
    toE164: ctx.toE164,
  });

  callContext.session.currentNodeId = "lookup_customer";
  callContext.session.voiceWorkflowId = "home_service_dispatcher";

  await domainLookupCustomer({ ctx: callContext, phone: callerPhone }).catch(() => undefined);

  const intent = await domainDetectCallerIntent({
    ctx: callContext,
    utterance: "I need to book a service appointment",
  });
  if (intent.ok) {
    await applyWorkflowNodeTransition({
      workflow: callContext.workflowDefinition!,
      callId: callContext.callId,
      session: callContext.session,
      toolName: "detect_caller_intent",
      result: { ok: true, data: { intent: "book_service" } },
    });
  }

  compileToolsForCallContext(callContext);
  applySimulatorServiceContext(callContext, serviceName);
  return callContext;
}

type SimulationReport = {
  scenario: string;
  turns: number;
  bookingComplete: boolean;
  bookingId: string | null;
  finalState: Record<string, unknown>;
  confirmBookingEverExposed: boolean;
  confirmBookingAttempted: boolean;
  failures: string[];
};

async function processDeterministicTurn(input: {
  ctx: LiveKitCallContext;
  userText: string;
  messages: ReturnType<typeof buildConversationMessages>;
}): Promise<ConversationTurnResult> {
  const planned = planDeterministicToolCalls({ ctx: input.ctx, userText: input.userText });
  let ctx = input.ctx;
  const toolExecutions: ConversationTurnResult["toolExecutions"] = [];
  const executed: Array<{ id: string; name: string; args: Record<string, unknown>; result: string }> = [];
  let lastSpeak = "";

  for (let i = 0; i < planned.length; i++) {
    const call = planned[i]!;
    const execution = await executeWorkflowTool({
      ctx,
      toolName: call.name,
      args: call.args,
    });
    ctx = execution.ctx;
    lastSpeak = execution.result.speak;
    toolExecutions.push({
      toolName: execution.toolName,
      ok: execution.result.ok,
      speak: execution.result.speak,
      blocked: execution.blocked,
    });
    executed.push({
      id: `det-${Date.now()}-${i}`,
      name: call.name,
      args: call.args,
      result: execution.serialized,
    });
  }

  const assistantText = deterministicAssistantReply({
    userText: input.userText,
    toolCalls: planned,
    lastSpeak,
  });

  return {
    ctx,
    assistantText,
    toolExecutions,
    bookingComplete: hasBookingReceipt(ctx.session),
    messages: appendDeterministicMessages({
      messages: input.messages,
      userText: input.userText,
      assistantText,
      toolCalls: executed,
    }),
  };
}

async function runScenario(input: {
  scenario: ConversationScenario;
  ctx: PreprodContext;
  callerPhone: string;
  serviceName: string;
  json: boolean;
  deterministic: boolean;
  llmCaller: boolean;
  requireBooking: boolean;
  maxTurns: number;
}): Promise<SimulationReport> {
  let callContext = await bootstrapSimulatorCall(input.ctx, input.callerPhone, input.serviceName);
  let messages = buildConversationMessages(callContext);
  const failures: string[] = [];
  let confirmBookingEverExposed = false;
  let confirmBookingAttempted = false;
  let turn = 0;
  const transcript: Array<{ role: "caller" | "amy"; text: string }> = [];

  const llm = providers()[0];
  const modelLabel = input.deterministic
    ? "deterministic-rules"
    : llm
      ? `${llm.id}:${llm.model}`
      : "unconfigured";

  console.log(`\nScenario: ${input.scenario.id}`);
  console.log(input.scenario.description);
  console.log(`Amy model: ${modelLabel}`);
  console.log(`Caller: ${input.llmCaller ? `llm (${modelLabel})` : "scripted"}`);
  console.log(`Call: ${callContext.callId}\n`);

  const scriptedLines = [...input.scenario.callerLines];
  let scriptedIndex = 0;

  while (turn < input.maxTurns) {
    let userText: string;
    if (input.llmCaller) {
      userText = await generateCallerUtterance({
        transcript,
        openingLine: scriptedLines[0],
        goal: "Book a plumbing appointment for a toilet leak.",
      });
    } else {
      if (scriptedIndex >= scriptedLines.length) break;
      userText = scriptedLines[scriptedIndex]!;
      scriptedIndex++;
    }

    turn++;
    const result = input.deterministic
      ? await processDeterministicTurn({ ctx: callContext, userText, messages })
      : await processCallerTurn({ ctx: callContext, userText, messages });
    callContext = result.ctx;
    messages = result.messages;

    transcript.push({ role: "caller", text: userText });
    if (result.assistantText) transcript.push({ role: "amy", text: result.assistantText });

    for (const tool of result.toolExecutions) {
      if (tool.toolName === "confirm_booking") confirmBookingAttempted = true;
    }

    const { allowedToolNames } = compileToolsForCallContext(callContext);
    if (allowedToolNames.has("confirm_booking")) {
      confirmBookingEverExposed = true;
    }

    if (!input.json) {
      console.log(formatTurnReport({ turn, userText, result }));
    }

    if (input.scenario.expectConfirmBookingByTurn && turn >= input.scenario.expectConfirmBookingByTurn) {
      if (!confirmBookingEverExposed) {
        failures.push(
          `confirm_booking not exposed by turn ${turn} (expected by turn ${input.scenario.expectConfirmBookingByTurn})`,
        );
      }
    }

    if (result.bookingComplete) break;
  }

  const bookingComplete = hasBookingReceipt(callContext.session);
  if (input.requireBooking && !bookingComplete) {
    failures.push("conversation ended without booking receipt (no bookingId)");
  } else if (!bookingComplete && !confirmBookingAttempted) {
    failures.push("never reached confirm_booking tool execution");
  }
  if (!confirmBookingEverExposed) {
    failures.push("confirm_booking was never exposed in tool surface");
  }

  return {
    scenario: input.scenario.id,
    turns: turn,
    bookingComplete,
    bookingId: callContext.session.bookingId,
    finalState: snapshotState(callContext),
    confirmBookingEverExposed,
    confirmBookingAttempted,
    failures,
  };
}

async function runInteractive(input: {
  ctx: PreprodContext;
  callerPhone: string;
  serviceName: string;
}) {
  const rl = readline.createInterface({ input, output });
  let callContext = await bootstrapSimulatorCall(input.ctx, input.callerPhone, input.serviceName);
  let messages = buildConversationMessages(callContext);
  let turn = 0;

  console.log("\nInteractive Amy text simulator");
  console.log("Type caller lines. Enter 'quit' to exit, 'state' for current workflow state.\n");

  while (true) {
    const userText = (await rl.question("Caller> ")).trim();
    if (!userText) continue;
    if (userText.toLowerCase() === "quit") break;
    if (userText.toLowerCase() === "state") {
      console.log(JSON.stringify(snapshotState(callContext), null, 2));
      continue;
    }

    turn++;
    const result = await processCallerTurn({ ctx: callContext, userText, messages });
    callContext = result.ctx;
    messages = result.messages;
    console.log(formatTurnReport({ turn, userText, result }));

    if (result.bookingComplete) {
      console.log("\nBooking complete.");
      break;
    }
  }

  rl.close();
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return;
  }

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  if (!hasLlmConfigured() && !opts.deterministic) {
    if (opts.e2e) {
      console.error("--e2e requires OPENAI_API_KEY or DEEPSEEK_API_KEY");
      process.exit(1);
    }
    console.warn("No LLM API key — falling back to --deterministic mode");
    opts.deterministic = true;
  }
  if (opts.e2e) {
    opts.deterministic = false;
    opts.requireBooking = true;
    opts.llmCaller = true;
  }

  process.env.VOICE_RUNTIME_PROVIDER = "livekit";
  resetRealtimeSessionStoreForTests(new InMemoryRealtimeSessionStore());

  const ctx = await createPreprodTenant();
  const callerPhone = opts.callerPhone || `+1415559${String(Date.now()).slice(-4)}`;

  try {
    const seeded = await seedDispatcherTenant(ctx, callerPhone);

    if (opts.interactive) {
      await runInteractive({ ctx, callerPhone, serviceName: seeded.service.name });
      return;
    }

    const scenario = opts.e2e
      ? getScenario("toilet-leak")
      : getScenario(opts.scenario!);
    const report = await runScenario({
      scenario,
      ctx,
      callerPhone,
      serviceName: seeded.service.name,
      json: opts.json,
      deterministic: opts.deterministic,
      llmCaller: opts.llmCaller,
      requireBooking: opts.requireBooking,
      maxTurns: opts.maxTurns,
    });

    if (opts.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log("\n══ Summary ══");
      console.log(`Scenario: ${report.scenario}`);
      console.log(`Turns: ${report.turns}`);
      console.log(`Booking complete: ${report.bookingComplete}`);
      console.log(`Booking ID: ${report.bookingId || "none"}`);
      console.log(`confirm_booking exposed: ${report.confirmBookingEverExposed}`);
      console.log(`confirm_booking attempted: ${report.confirmBookingAttempted}`);
      console.log(`Final state: ${JSON.stringify(report.finalState)}`);
      if (report.failures.length) {
        console.error("\nFailures:");
        for (const failure of report.failures) console.error(`  - ${failure}`);
        process.exit(1);
      }
      console.log("\nSimulation passed.");
    }

    if (report.failures.length) process.exit(1);
  } finally {
    await cleanupPreprodTenant(ctx);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
