/**
 * Simulation fixtures for Appointment Booking Agent regression tests.
 */

import type { AgentExecutionTrace } from "@/lib/agents/appointment-booking/types";
import {
  APPOINTMENT_BOOKING_TEST_SCENARIOS,
  evaluateScenario,
} from "@/lib/agents/appointment-booking/test-suite";

function baseTrace(
  partial: Partial<AgentExecutionTrace> & {
    steps: AgentExecutionTrace["steps"];
    outcome: AgentExecutionTrace["outcome"];
  },
): AgentExecutionTrace {
  return {
    executionId: `sim_${partial.outcome}`,
    agentId: "sim_agent",
    callId: `sim_call_${partial.outcome}`,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    summary: `Simulation: ${partial.outcome}`,
    ...partial,
  };
}

/** Deterministic mock traces keyed by scenario id. */
export function buildSimulationTraces(): Record<string, AgentExecutionTrace> {
  const now = new Date().toISOString();
  const ok = (blockType: string) => ({
    sequence: 0,
    blockType,
    startedAt: now,
    completedAt: now,
    status: "succeeded" as const,
  });

  return {
    new_caller_books: baseTrace({
      outcome: "appointment_booked",
      steps: [
        { ...ok("tool:calendar_availability"), sequence: 1 },
        { ...ok("tool:hold_appointment_slot"), sequence: 2 },
        { ...ok("tool:book_appointment"), sequence: 3 },
        { ...ok("tool:send_sms"), sequence: 4 },
      ],
    }),
    tomorrow_at_five: baseTrace({
      outcome: "completed",
      steps: [
        { ...ok("tool:resolve_datetime"), sequence: 1 },
        { ...ok("tool:calendar_availability"), sequence: 2 },
      ],
    }),
    slot_unavailable: baseTrace({
      outcome: "completed",
      steps: [{ ...ok("tool:calendar_availability"), sequence: 1 }],
    }),
    hold_then_book: baseTrace({
      outcome: "appointment_booked",
      steps: [
        { ...ok("tool:hold_appointment_slot"), sequence: 1 },
        { ...ok("tool:book_appointment"), sequence: 2 },
      ],
    }),
    calendar_failure: baseTrace({
      outcome: "failed",
      steps: [
        {
          sequence: 1,
          blockType: "tool:calendar_availability",
          startedAt: now,
          status: "failed",
          errorMessage: "Calendar authorization expired",
        },
      ],
    }),
    transfer_requested: baseTrace({
      outcome: "transferred",
      steps: [{ ...ok("tool:transfer"), sequence: 1 }],
    }),
    reschedule_existing: baseTrace({
      outcome: "completed",
      steps: [
        { ...ok("tool:find_appointments"), sequence: 1 },
        { ...ok("tool:reschedule_appointment"), sequence: 2 },
      ],
    }),
    cancel_existing: baseTrace({
      outcome: "completed",
      steps: [
        { ...ok("tool:find_appointments"), sequence: 1 },
        { ...ok("tool:cancel_appointment"), sequence: 2 },
      ],
    }),
  };
}

export function runSimulationSuite() {
  const traces = buildSimulationTraces();
  const results = APPOINTMENT_BOOKING_TEST_SCENARIOS.map((scenario) => {
    const trace = traces[scenario.id];
    if (!trace) {
      return {
        scenarioId: scenario.id,
        name: scenario.name,
        mode: "simulation" as const,
        status: "pending" as const,
        passed: false,
        note: "No simulation fixture for this scenario",
      };
    }
    const scored = evaluateScenario(scenario, trace);
    return {
      scenarioId: scenario.id,
      name: scenario.name,
      mode: "simulation" as const,
      status: scored.passed ? ("passed" as const) : ("failed" as const),
      passed: scored.passed,
      missing: scored.missing,
      failureReason: scored.failureReason,
      expectedTools: scenario.expectedTools,
    };
  });

  const failed = results.filter((r) => r.status === "failed");
  return {
    ok: failed.length === 0,
    mode: "simulation" as const,
    results,
    summary: {
      total: results.length,
      passed: results.filter((r) => r.passed).length,
      pending: results.filter((r) => r.status === "pending").length,
      failed: failed.length,
    },
    criticalFailures: failed.map((f) => f.scenarioId),
  };
}
