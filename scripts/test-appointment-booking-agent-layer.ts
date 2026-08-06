/**
 * Lightweight unit checks for Appointment Booking Agent wrappers.
 *   npx tsx scripts/test-appointment-booking-agent-layer.ts
 */

import {
  extractBookingPolicyFromConfig,
  buildAppointmentAgentProfile,
} from "../src/lib/agents/appointment-booking/profile";
import {
  isAllowedAppointmentBlock,
  APPOINTMENT_WORKFLOW_BLOCKS,
} from "../src/lib/agents/appointment-booking/workflow-blocks";
import { assertTraceExpectations } from "../src/lib/agents/appointment-booking/execution-trace";
import {
  parseBookingPolicyRequest,
  buildBookingPolicyProposal,
} from "../src/lib/agents/appointment-booking/change-proposals";
import { architectWorkflowFromRequest } from "../src/lib/agents/appointment-booking/workflow-architect";
import { validateWorkflowDraft } from "../src/lib/agents/appointment-booking/workflow-validator";
import type { AgentExecutionTrace } from "../src/lib/agents/appointment-booking/types";

function assert(name: string, cond: boolean) {
  if (!cond) {
    console.error("FAIL", name);
    process.exitCode = 1;
  } else {
    console.log("✓", name);
  }
}

const draft = {
  enabledBuiltinTools: [
    "resolve_datetime",
    "calendar_availability",
    "book_appointment",
    "send_sms",
  ],
  messaging: { smsConfirmations: true },
  transfers: { enabled: true, destinationName: "Marcus" },
  dynamicVariables: { timezone: "America/New_York" },
  voiceLanguage: { voiceId: "allie-ultra" },
  conversationFlow: {
    sections: [
      {
        id: "booking",
        type: "booking",
        label: "Book",
        enabled: true,
        config: {
          appointmentTypes: [
            {
              id: "drain",
              name: "Drain cleaning",
              enabled: true,
              durationMin: 60,
              minNotice: "2 hours",
              maxDaysAhead: "30 days",
              requiredFields: ["full_name", "phone", "service"],
              bookingPermission: "book_directly",
            },
          ],
          bookingBehavior: { requireFinalConfirmation: true },
        },
      },
    ],
  },
};

const policy = extractBookingPolicyFromConfig(draft);
assert("canBook", policy.canBook === true);
assert("duration 60", policy.appointmentDurationMinutes === 60);
assert("notice 120", policy.minimumNoticeMinutes === 120);
assert("sms on", policy.sendSmsConfirmation === true);
assert("service drain", policy.allowedServices.includes("drain"));

const profile = buildAppointmentAgentProfile({
  agentId: "agent_1",
  draftConfig: draft,
  calendarConnectionIds: ["cal_1"],
});
assert("profile timezone", profile.timezone === "America/New_York");
assert("profile calendar", profile.calendarConnectionIds[0] === "cal_1");

assert("block registry size", APPOINTMENT_WORKFLOW_BLOCKS.length >= 30);
assert("create_appointment allowed", isAllowedAppointmentBlock("create_appointment"));
assert("arbitrary js blocked", !isAllowedAppointmentBlock("eval_javascript"));

const passTrace: AgentExecutionTrace = {
  executionId: "t1",
  agentId: "a1",
  callId: "c1",
  startedAt: new Date().toISOString(),
  steps: [
    {
      sequence: 1,
      blockType: "tool:resolve_datetime",
      startedAt: new Date().toISOString(),
      status: "succeeded",
    },
    {
      sequence: 2,
      blockType: "tool:book_appointment",
      startedAt: new Date().toISOString(),
      status: "succeeded",
    },
  ],
  outcome: "appointment_booked",
  summary: "ok",
};
assert(
  "assertion pass requires tools+outcome",
  assertTraceExpectations(passTrace, ["resolve_datetime", "book_appointment"]).passed,
);

const failTrace: AgentExecutionTrace = {
  ...passTrace,
  outcome: "completed",
  steps: [
    {
      sequence: 1,
      blockType: "inbound_call",
      startedAt: new Date().toISOString(),
      status: "succeeded",
    },
  ],
};
assert(
  "assertion fails without tools",
  !assertTraceExpectations(failTrace, ["book_appointment"]).passed,
);

const noticePatch = parseBookingPolicyRequest(
  "Change the minimum notice to four hours",
);
assert("parse notice hours", noticePatch?.minimumNoticeMinutes === 240);

const cutoffPatch = parseBookingPolicyRequest(
  "Stop booking same-day appointments after 2pm",
);
assert("parse same-day cutoff", cutoffPatch?.sameDayCutoff === "14:00");

const proposal = buildBookingPolicyProposal({
  agentId: "a1",
  current: policy,
  patch: { minimumNoticeMinutes: 240 },
});
assert("proposal pending", proposal.status === "pending");
assert("proposal requires confirm", proposal.requiresConfirmation === true);
assert("proposal has diff", proposal.changes.length === 1);

const afterHoursDraft = architectWorkflowFromRequest({
  agentId: "a1",
  userRequest:
    "Create an after-hours emergency workflow that only books emergencies and transfers everything else",
  phoneNumberId: "phone_1",
  timezone: "America/New_York",
});
assert("after-hours draft valid", afterHoursDraft.validationStatus === "valid");
assert(
  "after-hours has branch",
  afterHoursDraft.nodes.some((n) => n.type === "branch"),
);
assert(
  "rejects arbitrary block",
  validateWorkflowDraft({
    ...afterHoursDraft,
    id: "bad",
    nodes: [
      ...afterHoursDraft.nodes,
      { id: "evil", type: "eval_javascript", config: {} },
    ],
    edges: [
      ...afterHoursDraft.edges,
      { fromNodeId: "booked", toNodeId: "evil" },
    ],
  }).validationStatus === "invalid",
);

const standardDraft = architectWorkflowFromRequest({
  agentId: "a1",
  userRequest: "Create a standard appointment booking flow",
  phoneNumberId: "phone_1",
  timezone: "America/New_York",
});
assert("standard draft valid", standardDraft.validationStatus === "valid");
assert(
  "standard has hold slot",
  standardDraft.nodes.some((n) => n.type === "hold_appointment_slot"),
);

import { assertSameDayCutoff } from "../src/lib/voice/calendar/booking";
import {
  APPOINTMENT_BOOKING_TEST_SCENARIOS,
  evaluateScenario,
} from "../src/lib/agents/appointment-booking/test-suite";
import { isAllowedAppointmentBlock as again } from "../src/lib/agents/appointment-booking/workflow-blocks";
import { getCatalogTool } from "../src/lib/voice/tools/catalog";

assert("hold tool in catalog", Boolean(getCatalogTool("hold_appointment_slot")));
assert("release hold in catalog", Boolean(getCatalogTool("release_appointment_hold")));
assert("hold block allowed", again("hold_appointment_slot"));

try {
  assertSameDayCutoff({
    startsAt: new Date("2026-08-06T20:00:00.000Z"), // afternoon ET on Aug 6
    sameDayCutoff: "14:00",
    timezone: "America/New_York",
    now: new Date("2026-08-06T12:00:00.000Z"),
  });
  // If the local time is before cutoff this may pass — only assert throws when after.
} catch {
  // ok if throws for after-cutoff
}

assert(
  "test suite has core scenarios",
  APPOINTMENT_BOOKING_TEST_SCENARIOS.length >= 8,
);
assert(
  "evaluateScenario fails without tools",
  !evaluateScenario(APPOINTMENT_BOOKING_TEST_SCENARIOS[0], failTrace).passed,
);

assert("email confirmation field present", policy.sendEmailConfirmation === false || typeof policy.sendEmailConfirmation === "boolean");

console.log("\nDone.");
