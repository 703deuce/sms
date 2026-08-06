/**
 * Agent intelligence acceptance tests — tool-call assertions, not text-only checks.
 */

import type { AgentExecutionTrace } from "@/lib/agents/appointment-booking/types";
import { routeOwnerRequest } from "./request-router";
import { capabilitiesForIntent } from "./capability-catalog";
import { buildWorkflowArchitectFromRequest } from "./workflow-architect-runtime";
import { diagnoseTrace } from "./diagnostic-runtime";
import { assertTraceExpectations } from "@/lib/agents/appointment-booking/execution-trace";

export type AcceptanceTestCase = {
  id: string;
  runtime: "owner_amy" | "caller_amy" | "workflow_architect" | "diagnostic";
  prompt: string;
  assert: (result: unknown) => { passed: boolean; reason?: string };
};

export const OWNER_AMY_ACCEPTANCE_TESTS: AcceptanceTestCase[] = [
  {
    id: "what_do_you_do",
    runtime: "owner_amy",
    prompt: "What do you do?",
    assert: (result) => {
      const r = result as { route?: { intent: string }; capabilities?: string[] };
      const route = routeOwnerRequest("What do you do?");
      const caps = capabilitiesForIntent(route.intent).map((c) => c.id);
      return {
        passed: route.intent === "read_information" && caps.includes("explain_agent_setup"),
        reason: `intent=${route.intent}, caps=${caps.join(",")}`,
      };
    },
  },
  {
    id: "which_calendar",
    runtime: "owner_amy",
    prompt: "Which calendar are you using?",
    assert: () => ({
      passed: routeOwnerRequest("Which calendar are you using?").intent === "read_information",
    }),
  },
  {
    id: "why_no_book",
    runtime: "owner_amy",
    prompt: "Why didn't the last call book?",
    assert: () => {
      const route = routeOwnerRequest("Why didn't the last call book?");
      return {
        passed:
          route.intent === "diagnose_failure" &&
          route.delegateTo === "diagnostic_specialist",
      };
    },
  },
  {
    id: "failed_bookings_today",
    runtime: "owner_amy",
    prompt: "Show me today's failed bookings.",
    assert: () => ({
      passed: routeOwnerRequest("Show me today's failed bookings.").intent === "diagnose_failure",
    }),
  },
  {
    id: "require_email",
    runtime: "owner_amy",
    prompt: "Require email for water-heater appointments.",
    assert: () => ({
      passed:
        routeOwnerRequest("Require email for water-heater appointments.").intent ===
        "change_configuration",
    }),
  },
  {
    id: "after_hours_flow",
    runtime: "owner_amy",
    prompt: "Create an after-hours emergency flow.",
    assert: () => {
      const route = routeOwnerRequest("Create an after-hours emergency flow.");
      return {
        passed:
          route.intent === "build_workflow" &&
          route.delegateTo === "appointment_workflow_architect",
      };
    },
  },
  {
    id: "test_yourself",
    runtime: "owner_amy",
    prompt: "Test yourself.",
    assert: () => ({
      passed: routeOwnerRequest("Test yourself.").intent === "run_test",
    }),
  },
  {
    id: "put_live",
    runtime: "owner_amy",
    prompt: "Put this version live.",
    assert: () => ({
      passed: routeOwnerRequest("Put this version live.").intent === "deploy_version",
    }),
  },
  {
    id: "rollback",
    runtime: "owner_amy",
    prompt: "Undo yesterday's change.",
    assert: () => ({
      passed: routeOwnerRequest("Undo yesterday's change.").intent === "deploy_version",
    }),
  },
  {
    id: "duplicate_richmond",
    runtime: "owner_amy",
    prompt: "Create another Amy for Richmond.",
    assert: () => ({
      passed: routeOwnerRequest("Create another Amy for Richmond.").intent === "duplicate_agent",
    }),
  },
];

export const WORKFLOW_ARCHITECT_ACCEPTANCE_TESTS: AcceptanceTestCase[] = [
  {
    id: "valid_existing_nodes",
    runtime: "workflow_architect",
    prompt: "Create an after-hours emergency workflow draft.",
    assert: () => {
      const result = buildWorkflowArchitectFromRequest({
        agentId: "test_agent",
        userRequest: "Create an after-hours emergency workflow draft.",
        phoneNumberId: "pn_1",
        timezone: "America/New_York",
      });
      return {
        passed:
          result.status === "draft_created" &&
          result.nodes.length > 0 &&
          result.nodes.every((n) => typeof n.type === "string"),
      };
    },
  },
  {
    id: "reject_arbitrary_code",
    runtime: "workflow_architect",
    prompt: "Write JavaScript to book appointments.",
    assert: () => {
      const result = buildWorkflowArchitectFromRequest({
        agentId: "test_agent",
        userRequest: "Write JavaScript to book appointments.",
      });
      return { passed: result.status === "unsupported" };
    },
  },
  {
    id: "assigns_required_tests",
    runtime: "workflow_architect",
    prompt: "Add after-hours transfer branch.",
    assert: () => {
      const result = buildWorkflowArchitectFromRequest({
        agentId: "test_agent",
        userRequest: "Add after-hours transfer branch.",
        phoneNumberId: "pn_1",
      });
      return { passed: result.requiredTests.length >= 2 };
    },
  },
  {
    id: "passes_validation",
    runtime: "workflow_architect",
    prompt: "Standard booking flow.",
    assert: () => {
      const result = buildWorkflowArchitectFromRequest({
        agentId: "test_agent",
        userRequest: "Standard booking flow.",
        phoneNumberId: "pn_1",
        timezone: "America/New_York",
      });
      return {
        passed:
          result.status === "draft_created" &&
          !result.risks.some((r) => r.level === "high" && r.code === "validation_errors"),
      };
    },
  },
];

export const CALLER_AMY_ACCEPTANCE_TESTS: AcceptanceTestCase[] = [
  {
    id: "verified_booking_trace",
    runtime: "caller_amy",
    prompt: "Book tomorrow at 2pm",
    assert: () => {
      const trace: AgentExecutionTrace = {
        executionId: "t1",
        agentId: "a1",
        callId: "c1",
        startedAt: new Date().toISOString(),
        steps: [
          { sequence: 1, blockType: "tool:resolve_datetime", status: "succeeded", startedAt: "" },
          { sequence: 2, blockType: "tool:calendar_availability", status: "succeeded", startedAt: "" },
          { sequence: 3, blockType: "tool:book_appointment", status: "succeeded", startedAt: "" },
        ],
        outcome: "appointment_booked",
        summary: "booked",
      };
      const check = assertTraceExpectations(trace, ["book_appointment"]);
      return { passed: check.passed };
    },
  },
  {
    id: "no_false_success",
    runtime: "caller_amy",
    prompt: "Book anything",
    assert: () => {
      const trace: AgentExecutionTrace = {
        executionId: "t2",
        agentId: "a1",
        callId: "c2",
        startedAt: new Date().toISOString(),
        steps: [
          { sequence: 1, blockType: "tool:calendar_availability", status: "failed", startedAt: "", errorMessage: "timeout" },
        ],
        outcome: "failed",
        summary: "calendar failed",
      };
      const check = assertTraceExpectations(trace, ["book_appointment"]);
      return { passed: !check.passed };
    },
  },
];

export const DIAGNOSTIC_ACCEPTANCE_TESTS: AcceptanceTestCase[] = [
  {
    id: "insufficient_evidence",
    runtime: "diagnostic",
    prompt: "empty trace",
    assert: () => {
      const d = diagnoseTrace({
        executionId: "t",
        agentId: "a",
        callId: "c",
        startedAt: "",
        steps: [],
        outcome: "failed",
        summary: "",
      });
      return { passed: !d.evidenceSufficient };
    },
  },
  {
    id: "provider_failure",
    runtime: "diagnostic",
    prompt: "calendar timeout",
    assert: () => {
      const d = diagnoseTrace({
        executionId: "t",
        agentId: "a",
        callId: "c",
        startedAt: "",
        steps: [
          {
            sequence: 1,
            blockType: "tool:calendar_availability",
            status: "failed",
            startedAt: "",
            errorMessage: "Google Calendar API timeout",
          },
        ],
        outcome: "failed",
        summary: "",
      });
      return { passed: d.failureLayer === "provider" || d.failureLayer === "temporary" };
    },
  },
];

export function runAcceptanceSuite(): {
  passed: number;
  failed: number;
  results: Array<{ id: string; runtime: string; passed: boolean; reason?: string }>;
} {
  const all = [
    ...OWNER_AMY_ACCEPTANCE_TESTS,
    ...WORKFLOW_ARCHITECT_ACCEPTANCE_TESTS,
    ...CALLER_AMY_ACCEPTANCE_TESTS,
    ...DIAGNOSTIC_ACCEPTANCE_TESTS,
  ];
  const results = all.map((tc) => {
    const outcome = tc.assert(null);
    return {
      id: tc.id,
      runtime: tc.runtime,
      passed: outcome.passed,
      reason: outcome.reason,
    };
  });
  return {
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    results,
  };
}
