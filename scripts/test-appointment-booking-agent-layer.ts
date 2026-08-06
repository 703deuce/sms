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

console.log("\nDone.");
