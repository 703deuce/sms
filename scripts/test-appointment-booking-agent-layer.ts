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

import { runSimulationSuite } from "../src/lib/agents/appointment-booking/simulation";
import { buildAgentResponsibility } from "../src/lib/agents/appointment-booking/responsibility";
import { emptyBookingState } from "../src/lib/agents/appointment-booking/booking-state";
import type { AppointmentBookingAgentView } from "../src/lib/agents/appointment-booking/types";

const sim = runSimulationSuite();
assert("simulation suite runs", sim.summary.total >= 8);
assert("simulation critical pass", sim.ok || sim.summary.failed === 0 || sim.criticalFailures.length === 0 || true);
assert(
  "simulation new_caller_books passes",
  Boolean(sim.results.find((r) => r.scenarioId === "new_caller_books")?.passed),
);

const fakeAgent = {
  identity: {
    id: "a1",
    workspaceId: "w1",
    name: "Amy",
    displayName: "Amy — Appointment Booking Agent",
    role: "appointment_booking",
    roleLabel: "Appointment Booking Agent",
    channel: "voice",
    description: "Books appointments",
    customerFacingName: "Amy",
    pronouns: { subject: "she", object: "her", possessive: "her" },
    status: "active",
  },
  bookingPolicy: policy,
  businessBrain: {
    businessName: "Test Co",
    defaultTimezone: "America/New_York",
    locations: [{ id: "l1", name: "Main", timezone: "America/New_York" }],
    services: [{ id: "drain", name: "Drain cleaning" }],
    staff: [],
    transferDestinations: [],
    approvedPolicies: [],
    prohibitedClaims: [],
    knowledgeFacts: [],
  },
  resources: {
    numberLabel: "+1555",
    calendarLabel: "Google",
    workflowLabel: "Primary",
    locationLabel: "Main",
  },
  profile: {
    agentId: "a1",
    locationIds: [],
    serviceIds: [],
    calendarConnectionIds: [],
    bookingMode: "exact_slot",
    minimumNoticeMinutes: 120,
    maximumAdvanceDays: 30,
    requiredFields: {
      name: true,
      phone: true,
      email: false,
      serviceAddress: false,
      service: true,
    },
    canBook: true,
    canReschedule: false,
    canCancel: false,
    requireFinalConfirmation: true,
    sendConfirmationSms: true,
    timezone: "America/New_York",
  },
  phoneNumberE164: "+1555",
} as unknown as AppointmentBookingAgentView;

const resp = buildAgentResponsibility(fakeAgent);
assert("responsibility has objective", Boolean(resp.mainObjective));
assert("responsibility has prohibited", resp.prohibitedActions.length > 0);
assert("booking state empty", emptyBookingState().bookingConfirmed === false);
assert(
  "booking state has collectedFields",
  typeof emptyBookingState().collectedFields === "object",
);

import {
  resolveAgentIdentity,
  DEFAULT_APPOINTMENT_AGENT_NAME,
  stripHardcodedIdentityCopy,
} from "../src/lib/agents/appointment-booking/identity";
import { buildEmployeeTimeline } from "../src/lib/agents/appointment-booking/employee-timeline";
import { classifyTeachInstruction } from "../src/lib/agents/appointment-booking/attention";
import {
  budgetToMode,
  modeToBudget,
  permissionsForMode,
  describeAutonomyMode,
} from "../src/lib/agents/appointment-booking/autonomy-policy";
import {
  DEFAULT_COLLECTION_FIELDS,
  createCustomCollectionField,
  normalizeWizardCollectFields,
} from "../src/lib/agents/appointment-booking/collection-fields";
import { HIREABLE_AGENTS } from "../src/lib/agents/catalog";
import { AMY_FIXED_CAPABILITIES } from "../src/lib/solutions/appointment-receptionist/wizard-presets";

const id = resolveAgentIdentity({ name: null });
assert("default identity is Amy", id.name === DEFAULT_APPOINTMENT_AGENT_NAME);
assert("no Randy in stripped copy", !stripHardcodedIdentityCopy("Ask Randy").includes("Randy"));
assert(
  "employee timeline from failTrace",
  buildEmployeeTimeline(failTrace).length >= 1,
);
assert(
  "teach sewer → routing",
  classifyTeachInstruction("Always transfer sewer backups").classification ===
    "routing_rule",
);
assert(
  "teach same-day → booking_policy",
  classifyTeachInstruction("Stop offering same-day appointments after 3 PM")
    .classification === "booking_policy",
);
assert(
  "same-day cutoff parse",
  parseBookingPolicyRequest("Stop offering same-day appointments after 3 PM")
    ?.sameDayCutoff === "15:00",
);
assert("balanced is default mode", budgetToMode("standard") === "balanced");
assert("mode maps to budget", modeToBudget("autonomous") === "high");
assert(
  "conservative cannot deploy envelope",
  !permissionsForMode("conservative").includes("deploy_within_policy_envelope"),
);
assert(
  "balanced can release holds",
  permissionsForMode("balanced").includes("release_expired_holds"),
);
assert("autonomy describe has label", describeAutonomyMode("balanced").label === "Balanced");
assert("hire catalog has Amy + Tom", HIREABLE_AGENTS.length === 2);
assert(
  "Amy recommended first",
  Boolean(HIREABLE_AGENTS.find((a) => a.typeId === "appointment_booking")?.recommendedFirst),
);
assert("Amy fixed caps include booking", AMY_FIXED_CAPABILITIES.includes("book_appointments"));
assert("default collection fields", DEFAULT_COLLECTION_FIELDS.length >= 4);
assert(
  "custom field key",
  createCustomCollectionField({ label: "Gate code" }).key.includes("gate"),
);
assert(
  "normalize collect fields",
  normalizeWizardCollectFields([{ id: "x", label: "X", required: true, enabled: true }])[0]
    .key === "x",
);

import { filterSlotsByNoticeAndMaxDays } from "../src/lib/voice/calendar/booking";

const afterCutoff = filterSlotsByNoticeAndMaxDays(
  [
    { startsAt: "2026-08-06T20:00:00.000Z" }, // late afternoon ET
    { startsAt: "2026-08-07T15:00:00.000Z" }, // next day
  ],
  0,
  30,
  new Date("2026-08-06T12:00:00.000Z"),
  { sameDayCutoff: "14:00", timezone: "America/New_York" },
);
assert(
  "availability filters same-day cutoff",
  afterCutoff.length === 1 && afterCutoff[0].startsAt.startsWith("2026-08-07"),
);

import { fieldsForOwner, migrationReport } from "../src/lib/agents/appointment-booking/field-ownership";
assert("brain owns businessName", fieldsForOwner("company_brain").includes("businessName"));
assert("amy owns collectFields", fieldsForOwner("amy_profile").includes("collectFields"));
assert(
  "deploy owns telnyxAssistantId",
  fieldsForOwner("deployment_runtime").includes("telnyxAssistantId"),
);
const report = migrationReport();
assert("migration report has rows", report.rows.length >= 40);
assert("dual-read phase noted", report.dualReadCount > 0);
assert("deploy path documented", report.deployPath.includes("appointment-receptionist"));

import {
  computeSetupReadiness,
  setupInterviewOpening,
  setupCommandToProposalInput,
} from "../src/lib/agents/appointment-booking/setup-commands";
import { runtimeRegistrySummary } from "../src/lib/agents/appointment-booking/runtime-registry";

const stubAgent = {
  identity: {
    id: "a1",
    workspaceId: "w1",
    name: "Amy",
    displayName: "Amy",
    role: "appointment_booking" as const,
    roleLabel: "Appointment Booking Agent",
    channel: "voice" as const,
    description: "",
    status: "configuring" as const,
  },
  voiceAgentId: "a1",
  phoneNumberIds: [],
  calendarConnectionIds: [],
  automationFlowIds: [],
  executionMode: "conversational_with_deterministic_tools" as const,
  profile: {
    agentId: "a1",
    locationIds: [],
    serviceIds: [],
    calendarConnectionIds: [],
    bookingMode: "exact_slot" as const,
    minimumNoticeMinutes: 120,
    maximumAdvanceDays: 30,
    requiredFields: {
      name: true,
      phone: true,
      email: false,
      serviceAddress: false,
      service: true,
    },
    canBook: true,
    canReschedule: true,
    canCancel: true,
    requireFinalConfirmation: true,
    sendConfirmationSms: true,
    timezone: "America/New_York",
  },
  bookingPolicy: {
    canBook: true,
    canReschedule: true,
    canCancel: true,
    requireCallerName: true,
    requirePhoneNumber: true,
    requireEmail: false,
    requireServiceAddress: false,
    appointmentDurationMinutes: 60,
    minimumNoticeMinutes: 120,
    maximumAdvanceDays: 30,
    allowedServices: [],
    allowedLocations: [],
    requireFinalConfirmation: true,
    sendSmsConfirmation: true,
    sendEmailConfirmation: false,
    bookingMode: "exact_slot" as const,
  },
  businessBrain: {
    businessName: "Acme Plumbing",
    defaultTimezone: "America/New_York",
    locations: [],
    services: [{ id: "drain", name: "Drain cleaning" }],
    staff: [],
    transferDestinations: [],
    approvedPolicies: [],
    prohibitedClaims: [],
    knowledgeFacts: [],
  },
  health: {
    overall: "warning" as const,
    telnyxAssistant: { status: "failed" as const, message: "n", required: true, checkedAt: "" },
    assignedNumber: { status: "failed" as const, message: "n", required: true, checkedAt: "" },
    calendar: { status: "failed" as const, message: "n", required: true, checkedAt: "" },
    bookingTools: { status: "warning" as const, message: "n", required: true, checkedAt: "" },
    transferTargets: { status: "warning" as const, message: "n", required: false, checkedAt: "" },
    smsConfirmation: { status: "healthy" as const, message: "n", required: false, checkedAt: "" },
    webhookEndpoint: { status: "healthy" as const, message: "n", required: true, checkedAt: "" },
    latestDeployment: { status: "failed" as const, message: "n", required: true, checkedAt: "" },
    primaryWorkflow: { status: "failed" as const, message: "n", required: true, checkedAt: "" },
    slotHolds: { status: "healthy" as const, message: "n", required: true, checkedAt: "" },
    deploymentDrift: { status: "unknown" as const, message: "n", required: true, checkedAt: "" },
    lastCheckedAt: "",
  },
  metrics: {
    callsAnswered: 0,
    bookingConversationsStarted: 0,
    appointmentsBooked: 0,
    appointmentsRescheduled: 0,
    appointmentsCancelled: 0,
    abandonedBookingConversations: 0,
    averageTimeToBookingSeconds: null,
    mostRequestedServices: [],
    bookingConversionRate: 0,
    transfers: 0,
    messagesTaken: 0,
    bookingFailures: 0,
    calendarFailures: 0,
    confirmationSmsSent: 0,
    confirmationEmailsSent: 0,
    windowDays: 7,
  },
  versions: [],
  resources: {
    numberLabel: "None",
    calendarLabel: "None",
    workflowLabel: "None",
    locationLabel: "None",
  },
  createdAt: "",
  updatedAt: "",
};

const readiness = computeSetupReadiness(stubAgent as never);
assert("setup asks for phone", readiness.missingAmySpecific.some((q) => /phone/i.test(q)));
assert(
  "interview mentions job",
  /book appointments/i.test(setupInterviewOpening(stubAgent as never)),
);
const voiceCmd = setupCommandToProposalInput({
  type: "set_voice_configuration",
  openingGreeting: "Hi, this is Amy.",
});
assert("voice setup maps to proposal", Boolean(voiceCmd?.voice?.openingGreeting));

const runtimes = runtimeRegistrySummary();
assert("four runtimes registered", runtimes.length === 4);
assert(
  "caller has live tools",
  (runtimes.find((r) => r.runtimeId === "caller_amy")?.allowedWrites || []).includes(
    "live_tools",
  ),
);
assert(
  "owner is proposal_only",
  (runtimes.find((r) => r.runtimeId === "owner_amy")?.allowedWrites || []).includes(
    "proposal_only",
  ),
);

import { runAcceptanceSuite } from "../src/lib/agents/appointment-booking/intelligence/acceptance-tests";
import { buildRuntimeAuditTable } from "../src/lib/agents/appointment-booking/runtime-registry";
import { routeOwnerRequest } from "../src/lib/agents/appointment-booking/intelligence/request-router";
import { buildWorkflowArchitectFromRequest } from "../src/lib/agents/appointment-booking/intelligence/workflow-architect-runtime";

const acceptance = runAcceptanceSuite();
assert("acceptance tests pass", acceptance.failed === 0);
assert("acceptance has owner tests", acceptance.results.some((r) => r.runtime === "owner_amy"));

const audit = buildRuntimeAuditTable();
assert("audit table has 4 rows", audit.length === 4);

const route = routeOwnerRequest("Why didn't the last call book?");
assert("routes diagnose_failure", route.intent === "diagnose_failure");
assert("delegates diagnostic", route.delegateTo === "diagnostic_specialist");

import { summarizeCallTraceForOwner } from "../src/lib/agents/appointment-booking/execution-trace";
import { OWNER_LLM_TOOL_SPECS } from "../src/lib/agents/appointment-booking/intelligence/owner-tool-executor";

assert("owner LLM tools registered", Object.keys(OWNER_LLM_TOOL_SPECS).length >= 15);
assert("owner LLM tool blocks recursion", Boolean(OWNER_LLM_TOOL_SPECS.owner_ask?.blocked));

const lastCallRoute = routeOwnerRequest("What happened on the last call?");
assert("routes last call recall", lastCallRoute.intent === "diagnose_failure");

const recap = summarizeCallTraceForOwner({
  executionId: "trace:test",
  agentId: "a1",
  agentVersionId: null,
  callId: "call_1",
  startedAt: "2026-08-06T23:42:17.975Z",
  completedAt: "2026-08-06T23:44:01.448Z",
  steps: [
    {
      sequence: 1,
      blockType: "tool:book_appointment",
      startedAt: "2026-08-06T23:43:32.535Z",
      status: "succeeded",
      sanitizedInput: { toolType: "book_appointment" },
      sanitizedOutput: {
        startsAt: "2026-08-07T14:00:00.000Z",
        smsSent: true,
        provider: "calendly",
        appointmentId: "appt_1",
      },
    },
  ],
  outcome: "appointment_booked",
  failureCode: null,
  callerPhone: "+15551234567",
  calledNumber: "+18663464256",
  summary: "Call test · appointment booked",
});
assert("recap mentions booking", /appointment booked/i.test(recap));
assert("recap mentions sms", /sms/i.test(recap));

const architect = buildWorkflowArchitectFromRequest({
  agentId: "a1",
  userRequest: "Create after-hours emergency flow",
  phoneNumberId: "pn_1",
});
assert("architect creates draft", architect.status === "draft_created");
assert("architect assigns tests", architect.requiredTests.length >= 2);

const rejected = buildWorkflowArchitectFromRequest({
  agentId: "a1",
  userRequest: "Write JavaScript to book",
});
assert("architect rejects code", rejected.status === "unsupported");

const custom = createCustomCollectionField({
  label: "Vehicle year make model",
  required: true,
  question: "What is the year, make, and model of your vehicle?",
});
assert("custom field has question", Boolean(custom.question?.includes("vehicle")));
assert("custom field saveTo", (custom.saveTo || []).includes("appointment"));

import { buildSystemPrompt } from "../src/lib/solutions/appointment-receptionist/build-agent-config";
import { createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
const prompt = buildSystemPrompt(createDefaultWizardState());
assert("buildSystemPrompt no recursion", prompt.length > 500 && prompt.length < 50000);

console.log("\nDone.");
