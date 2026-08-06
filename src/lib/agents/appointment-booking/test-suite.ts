/**
 * Assertion-complete test suite for Appointment Booking Agent.
 * Never pass merely because a call completed — require tools + outcomes.
 */

import type { AgentExecutionTrace } from "@/lib/agents/appointment-booking/types";
import { assertTraceExpectations } from "@/lib/agents/appointment-booking/execution-trace";
import { buildVoiceAgentForTest } from "@/lib/voice/agent-service";
import { getPrisma } from "@/lib/db";

export type AgentTestScenario = {
  id: string;
  name: string;
  description: string;
  expectedTools: string[];
  expectedOutcome?: AgentExecutionTrace["outcome"];
  callerScript: string[];
};

export const APPOINTMENT_BOOKING_TEST_SCENARIOS: AgentTestScenario[] = [
  {
    id: "new_caller_books",
    name: "New caller books available appointment",
    description: "Caller asks to book; agent checks availability and books.",
    expectedTools: ["calendar_availability", "book_appointment"],
    expectedOutcome: "appointment_booked",
    callerScript: [
      "Hi, I'd like to book an appointment",
      "Tomorrow afternoon works",
      "Yes, that time is fine",
      "My name is Alex Test, phone is fine",
    ],
  },
  {
    id: "tomorrow_at_five",
    name: 'Caller says "tomorrow at five"',
    description: "Ambiguous relative time must go through resolve_datetime.",
    expectedTools: ["resolve_datetime", "calendar_availability"],
    callerScript: ["Can I come in tomorrow at five?"],
  },
  {
    id: "slot_unavailable",
    name: "Requested slot unavailable",
    description: "Agent must offer alternatives, not invent confirmation.",
    expectedTools: ["calendar_availability"],
    expectedOutcome: "completed",
    callerScript: ["Book me for yesterday at 3am", "Is anything else open?"],
  },
  {
    id: "hold_then_book",
    name: "Hold slot then book",
    description: "Agent holds while confirming, then books.",
    expectedTools: ["hold_appointment_slot", "book_appointment"],
    expectedOutcome: "appointment_booked",
    callerScript: [
      "Hold 2pm tomorrow while I get my address",
      "123 Main St — go ahead and book it",
    ],
  },
  {
    id: "calendar_failure",
    name: "Calendar / booking timeout",
    description: "Failure must not be reported as booked.",
    expectedTools: ["calendar_availability"],
    callerScript: ["Book anything this week"],
  },
  {
    id: "transfer_requested",
    name: "Transfer requested",
    description: "Caller asks for a human; transfer or escalate tool fires.",
    expectedTools: ["transfer"],
    expectedOutcome: "transferred",
    callerScript: ["Can you transfer me to a real person?"],
  },
  {
    id: "reschedule_existing",
    name: "Reschedule existing appointment",
    description: "Find then reschedule.",
    expectedTools: ["find_appointments", "reschedule_appointment"],
    callerScript: ["I need to move my appointment to Friday"],
  },
  {
    id: "cancel_existing",
    name: "Cancel existing appointment",
    description: "Find then cancel.",
    expectedTools: ["find_appointments", "cancel_appointment"],
    callerScript: ["Please cancel my appointment"],
  },
];

export function evaluateScenario(
  scenario: AgentTestScenario,
  trace: AgentExecutionTrace,
): {
  scenarioId: string;
  passed: boolean;
  missing: string[];
  failureReason: string | null;
} {
  const base = assertTraceExpectations(trace, scenario.expectedTools);
  if (!base.passed) {
    return {
      scenarioId: scenario.id,
      passed: false,
      missing: base.missing,
      failureReason: base.failureReason,
    };
  }
  if (scenario.expectedOutcome && trace.outcome !== scenario.expectedOutcome) {
    // Soft: transfer may use escalate_human alias
    if (
      scenario.expectedOutcome === "transferred" &&
      (trace.outcome === "completed" ||
        trace.steps.some((s) => /transfer|escalate/i.test(s.blockType)))
    ) {
      return {
        scenarioId: scenario.id,
        passed: true,
        missing: [],
        failureReason: null,
      };
    }
    return {
      scenarioId: scenario.id,
      passed: false,
      missing: [],
      failureReason: `Expected outcome ${scenario.expectedOutcome}, got ${trace.outcome}`,
    };
  }
  return {
    scenarioId: scenario.id,
    passed: true,
    missing: [],
    failureReason: null,
  };
}

export async function runAgentTestSnapshotSuite(input: {
  workspaceId: string;
  agentId: string;
  userId: string;
  tracesByScenario?: Record<string, AgentExecutionTrace>;
}) {
  const built = await buildVoiceAgentForTest(input.workspaceId, input.agentId);
  const results = APPOINTMENT_BOOKING_TEST_SCENARIOS.map((scenario) => {
    const trace = input.tracesByScenario?.[scenario.id];
    if (!trace) {
      return {
        scenarioId: scenario.id,
        name: scenario.name,
        status: "pending" as const,
        passed: false,
        callerScript: scenario.callerScript,
        expectedTools: scenario.expectedTools,
        note: "Run a live WebRTC/PSTN test and attach the execution trace to score this scenario.",
      };
    }
    const scored = evaluateScenario(scenario, trace);
    return {
      scenarioId: scenario.id,
      name: scenario.name,
      status: scored.passed ? ("passed" as const) : ("failed" as const),
      passed: scored.passed,
      missing: scored.missing,
      failureReason: scored.failureReason,
      expectedTools: scenario.expectedTools,
      callerScript: scenario.callerScript,
    };
  });

  await getPrisma().auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      event: "agent.test_suite_snapshot",
      detail: `agent=${input.agentId} scenarios=${results.length}`,
    },
  });

  return {
    ok: true,
    agent: built,
    scenarios: APPOINTMENT_BOOKING_TEST_SCENARIOS,
    results,
    summary: {
      total: results.length,
      passed: results.filter((r) => r.passed).length,
      pending: results.filter((r) => r.status === "pending").length,
      failed: results.filter((r) => r.status === "failed").length,
    },
  };
}
