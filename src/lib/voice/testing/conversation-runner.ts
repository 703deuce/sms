import {
  bootstrapLiveKitCallContext,
  domainLookupCustomer,
  type LiveKitCallContext,
} from "@/lib/voice/domain-actions";
import { liveKitRuntimeProvider } from "@/lib/voice/runtime-provider/livekit";
import { compileToolsForCallContext } from "@/lib/voice/workflow-runtime/compile-for-call";
import { hasBookingReceipt } from "@/lib/voice/workflow-runtime/completion-guards";
import type { PreprodContext } from "./preprod-harness";
import type { ConversationScenario } from "./conversation-scenarios";
import type { MasterReceptionistScenario, ScenarioSuccessType } from "./master-receptionist-scenarios";
import { loadAppointmentStatus } from "./appointment-fixtures";
import {
  buildConversationMessages,
  formatTurnReport,
  processCallerTurn,
  snapshotState,
  type ConversationTurnResult,
} from "./text-conversation-driver";
import {
  appendDeterministicMessages,
  deterministicAssistantReply,
  planDeterministicToolCalls,
} from "./deterministic-caller-brain";
import { generateCallerUtterance } from "./llm-caller-brain";
import { resolveWizardProfileForScenario } from "./conversation-wizard-profiles";
import { providers } from "@/lib/ai/llm-providers";

export type SimulationReport = {
  scenario: string;
  successType?: ScenarioSuccessType;
  turns: number;
  bookingComplete: boolean;
  bookingId: string | null;
  appointmentId: string | null;
  finalState: Record<string, unknown>;
  confirmBookingEverExposed: boolean;
  confirmBookingAttempted: boolean;
  toolLog: Array<{ toolName: string; ok: boolean }>;
  passed: boolean;
  failures: string[];
};

function applySimulatorServiceContext(callContext: LiveKitCallContext, serviceName: string) {
  callContext.session.serviceName = serviceName;
}

function spokenUsPhone(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  const words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
  return national
    .split("")
    .map((digit) => words[Number(digit)] || digit)
    .join(" ");
}

function hydrateScenarioForCaller<T extends ConversationScenario | MasterReceptionistScenario>(
  scenario: T,
  callerPhone: string,
): T {
  const spoken = spokenUsPhone(callerPhone);
  const callerLines = scenario.callerLines.map((line) =>
    line
      .replace(/five seven one five five five zero one four two/gi, spoken)
      .replace(/571-555-\d{4}/g, callerPhone),
  );
  const callerPersona = scenario.callerPersona
    ?.replace(/571-555-\d{4}/g, callerPhone)
    .replace(/five seven one five five five zero one four two/gi, spoken);

  return {
    ...scenario,
    callerLines,
    ...(callerPersona ? { callerPersona } : {}),
  };
}

function fallbackCallerLine(ctx: LiveKitCallContext): string | null {
  const action = ctx.canonicalWorkflow?.expectedNextAction;
  switch (action) {
    case "select_slot":
      return "The first one works.";
    case "confirm_booking":
      return "Yes, that's correct, please book it.";
    case "reschedule_appointment":
      return "Yes, please reschedule it.";
    case "cancel_appointment":
      return "Yes, please cancel it.";
    case "find_appointments":
      return "John Smith.";
    case "check_availability":
      return "Tomorrow afternoon if you have anything.";
    default:
      return null;
  }
}

export async function bootstrapSimulatorCall(
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

  callContext.session.currentNodeId = "detect_intent";
  callContext.session.voiceWorkflowId = "home_service_dispatcher";

  await domainLookupCustomer({ ctx: callContext, phone: callerPhone }).catch(() => undefined);

  compileToolsForCallContext(callContext);
  applySimulatorServiceContext(callContext, serviceName);
  return callContext;
}

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
    const { executeWorkflowTool } = await import("./workflow-tool-executor");
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

export async function evaluateScenarioOutcome(input: {
  scenario: MasterReceptionistScenario;
  callContext: LiveKitCallContext;
  toolLog: Array<{ toolName: string; ok: boolean }>;
  priorAppointmentId?: string;
  priorStartsAt?: Date;
}): Promise<string[]> {
  const failures: string[] = [];
  const { scenario, callContext, toolLog } = input;

  switch (scenario.successType) {
    case "booking": {
      if (!hasBookingReceipt(callContext.session)) {
        failures.push("conversation ended without booking receipt (no bookingId)");
      }
      if (!toolLog.some((t) => t.toolName === "confirm_booking" && t.ok)) {
        failures.push("confirm_booking never succeeded");
      }
      break;
    }
    case "reschedule": {
      const foundAppointments = toolLog.some(
        (t) => t.toolName === "find_appointments" && t.ok,
      );
      if (!foundAppointments) {
        failures.push("find_appointments never succeeded");
      }
      if (!toolLog.some((t) => t.toolName === "reschedule_appointment")) {
        failures.push("reschedule_appointment was never attempted");
      }
      if (input.priorAppointmentId) {
        const appt = await loadAppointmentStatus(input.priorAppointmentId);
        if (!appt) {
          failures.push("prior appointment not found in database");
        } else if (
          input.priorStartsAt &&
          appt.startsAt.getTime() === input.priorStartsAt.getTime()
        ) {
          failures.push("appointment time was not updated after reschedule");
        }
      }
      break;
    }
    case "cancel": {
      if (!toolLog.some((t) => t.toolName === "find_appointments" && t.ok)) {
        failures.push("find_appointments never succeeded");
      }
      if (!toolLog.some((t) => t.toolName === "cancel_appointment" && t.ok)) {
        failures.push("cancel_appointment never succeeded");
      }
      if (input.priorAppointmentId) {
        const appt = await loadAppointmentStatus(input.priorAppointmentId);
        if (!appt) {
          failures.push("prior appointment not found in database");
        } else if (appt.status !== "cancelled" && appt.status !== "canceled") {
          failures.push(`appointment status is still ${appt.status}, expected cancelled`);
        }
      }
      break;
    }
    case "out_of_area": {
      const eligibility = callContext.session.runtime?.session_runtime?.eligibility;
      const outOfArea =
        eligibility?.status === "out_of_area" ||
        toolLog.some((t) => t.toolName === "validate_eligibility" && !t.ok);
      if (!outOfArea) {
        failures.push("expected out-of-area eligibility rejection");
      }
      if (hasBookingReceipt(callContext.session)) {
        failures.push("should not have booked an out-of-area appointment");
      }
      break;
    }
    case "emergency_transfer": {
      const nodeId =
        callContext.canonicalWorkflow?.currentNodeId || callContext.session.currentNodeId || "";
      const emergencyHandled =
        ["emergency_handoff", "transfer_fallback"].includes(nodeId) ||
        toolLog.some((t) => t.toolName === "detect_caller_intent" && t.ok) ||
        toolLog.some((t) => t.toolName === "request_human") ||
        toolLog.some((t) => t.toolName === "classify_intent" && t.ok);
      if (!emergencyHandled) {
        failures.push("expected emergency handoff (detect_intent, request_human, or classify_intent)");
      }
      break;
    }
    default:
      break;
  }

  return failures;
}

export async function runConversationScenario(input: {
  scenario: ConversationScenario | MasterReceptionistScenario;
  ctx: PreprodContext;
  callerPhone: string;
  serviceName: string;
  json?: boolean;
  deterministic?: boolean;
  llmCaller?: boolean;
  requireBooking?: boolean;
  maxTurns?: number;
  priorAppointmentId?: string;
  priorStartsAt?: Date;
}): Promise<SimulationReport> {
  const masterScenario = input.scenario as MasterReceptionistScenario;
  const successType = masterScenario.successType;

  const hydratedScenario = hydrateScenarioForCaller(input.scenario, input.callerPhone);

  let callContext = await bootstrapSimulatorCall(input.ctx, input.callerPhone, input.serviceName);
  let messages = buildConversationMessages(callContext);
  const failures: string[] = [];
  let confirmBookingEverExposed = false;
  let confirmBookingAttempted = false;
  let turn = 0;
  const transcript: Array<{ role: "caller" | "amy"; text: string }> = [];
  const toolLog: Array<{ toolName: string; ok: boolean }> = [];

  const llm = providers()[0];
  const modelLabel = input.deterministic
    ? "deterministic-rules"
    : llm
      ? `${llm.id}:${llm.model}`
      : "unconfigured";

  console.log(`\nScenario: ${hydratedScenario.id}`);
  console.log(hydratedScenario.description);
  if (successType) console.log(`Success type: ${successType}`);
  const fieldProfile = resolveWizardProfileForScenario(
    hydratedScenario.id,
    hydratedScenario.wizardProfileId,
  );
  console.log(
    `Fields (wizard UI): ${fieldProfile.collectFields.filter((f) => f.enabled !== false).map((f) => f.label).join(" → ")}`,
  );
  console.log(`Amy model: ${modelLabel}`);
  console.log(`Caller: ${input.llmCaller ? `llm (${modelLabel})` : "scripted"}`);
  console.log(`Call: ${callContext.callId}\n`);

  const scriptedLines = [...hydratedScenario.callerLines];
  let scriptedIndex = 0;
  const maxTurns = input.maxTurns ?? 25;

  while (turn < maxTurns) {
    let userText: string;
    if (input.llmCaller) {
      userText = await generateCallerUtterance({
        transcript,
        openingLine: scriptedLines[0],
        goal: hydratedScenario.callerGoal || "Complete the phone call goal.",
        persona: hydratedScenario.callerPersona,
      });
    } else {
      if (scriptedIndex < scriptedLines.length) {
        userText = scriptedLines[scriptedIndex]!;
        scriptedIndex++;
      } else {
        const fallback = fallbackCallerLine(callContext);
        if (!fallback) break;
        userText = fallback;
      }
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
      toolLog.push({ toolName: tool.toolName, ok: tool.ok && !tool.blocked });
      if (tool.toolName === "confirm_booking") confirmBookingAttempted = true;
    }

    const { allowedToolNames } = compileToolsForCallContext(callContext);
    if (allowedToolNames.has("confirm_booking")) {
      confirmBookingEverExposed = true;
    }

    if (!input.json) {
      console.log(formatTurnReport({ turn, userText, result }));
    }

    if (
      input.scenario.expectConfirmBookingByTurn &&
      turn >= input.scenario.expectConfirmBookingByTurn &&
      successType === "booking"
    ) {
      if (!confirmBookingEverExposed) {
        failures.push(
          `confirm_booking not exposed by turn ${turn} (expected by turn ${input.scenario.expectConfirmBookingByTurn})`,
        );
      }
    }

    if (successType === "booking" && result.bookingComplete) break;
    if (successType === "cancel" && toolLog.some((t) => t.toolName === "cancel_appointment" && t.ok)) {
      break;
    }
    if (
      successType === "reschedule" &&
      toolLog.some((t) => t.toolName === "reschedule_appointment" && t.ok)
    ) {
      break;
    }
    if (successType === "emergency_transfer" && (
      toolLog.some((t) => t.toolName === "request_human") ||
      toolLog.some((t) => t.toolName === "detect_caller_intent" && t.ok)
    )) {
      break;
    }
    if (successType === "out_of_area" && toolLog.some((t) => t.toolName === "validate_eligibility" && !t.ok)) {
      break;
    }
  }

  const bookingComplete = hasBookingReceipt(callContext.session);

  if (successType) {
    const outcomeFailures = await evaluateScenarioOutcome({
      scenario: hydratedScenario as MasterReceptionistScenario,
      callContext,
      toolLog,
      priorAppointmentId: input.priorAppointmentId,
      priorStartsAt: input.priorStartsAt,
    });
    failures.push(...outcomeFailures);
  } else if (input.requireBooking && !bookingComplete) {
    failures.push("conversation ended without booking receipt (no bookingId)");
  } else if (!bookingComplete && !confirmBookingAttempted && !successType) {
    failures.push("never reached confirm_booking tool execution");
  }

  if (!successType && !confirmBookingEverExposed && input.requireBooking) {
    failures.push("confirm_booking was never exposed in tool surface");
  }

  return {
    scenario: hydratedScenario.id,
    successType,
    turns: turn,
    bookingComplete,
    bookingId: callContext.session.bookingId,
    appointmentId: input.priorAppointmentId || callContext.session.bookingId,
    finalState: snapshotState(callContext),
    confirmBookingEverExposed,
    confirmBookingAttempted,
    toolLog,
    passed: failures.length === 0,
    failures,
  };
}
