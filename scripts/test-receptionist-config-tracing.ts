import assert from "node:assert/strict";
import { diffWizardStates } from "../src/lib/solutions/appointment-receptionist/config-tracing/diff";
import { flattenWizardState, stableJsonEqual } from "../src/lib/solutions/appointment-receptionist/config-tracing/flatten";
import { listTopLevelRegistryEntries } from "../src/lib/solutions/appointment-receptionist/config-tracing/field-registry";
import { analyzeMergeTrace } from "../src/lib/solutions/appointment-receptionist/config-tracing/merge-trace";
import { redactFieldValue, fingerprintValue } from "../src/lib/solutions/appointment-receptionist/config-tracing/redact";
import {
  expectedBookingTools,
  resolveBookingMode,
  transferEnabled,
} from "../src/lib/solutions/appointment-receptionist/config-tracing/runtime-summary";
import { createReceptionistTraceId } from "../src/lib/solutions/appointment-receptionist/config-tracing/trace-id";
import { createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";

function testTraceId() {
  const id = createReceptionistTraceId();
  assert.ok(id.startsWith("rec_"));
  assert.ok(id.length > 8);
}

function testRedact() {
  const redacted = redactFieldValue("openingGreeting", "Hello caller secret");
  assert.equal(typeof redacted, "string");
  assert.match(String(redacted), /redacted/);
  assert.ok(fingerprintValue("x").startsWith("fp_"));
}

function testFlattenAndDiff() {
  const base = createDefaultWizardState();
  const next = { ...base, agentName: "Sam", ringTeamSeconds: 42 };
  const diff = diffWizardStates(base, next);
  assert.ok(diff.changed.includes("agentName"));
  assert.ok(diff.changed.includes("ringTeamSeconds"));
  const flat = flattenWizardState(next);
  assert.ok("bookingBehavior.askPreferredDayFirst" in flat || "bookingBehavior" in flat);
}

function testMergeOwnership() {
  const server = createDefaultWizardState();
  server.bookingStrategy = "MICROSOFT_365";
  const incoming = { ...server, bookingStrategy: "SEND_LINK" as const, voiceId: "nova" };
  const merged = { ...server, voiceId: "nova" };
  const trace = analyzeMergeTrace({
    traceId: "rec_test",
    server,
    incoming,
    merged,
    stepId: "voice",
  });
  assert.ok(trace.rejectedPaths.some((p) => p.includes("bookingStrategy")));
  assert.ok(trace.changedPaths.some((p) => p.includes("voiceId")));
}

function testBookingModes() {
  const disabled = {
    ...createDefaultWizardState(),
    capabilities: createDefaultWizardState().capabilities.filter((c) => c !== "book_appointments"),
  };
  assert.equal(resolveBookingMode(disabled), "BOOKING_DISABLED");
  assert.deepEqual(expectedBookingTools(disabled), []);

  const link = createDefaultWizardState();
  link.bookingStrategy = "SEND_LINK";
  assert.equal(resolveBookingMode(link), "SEND_LINK");
  assert.deepEqual(expectedBookingTools(link), ["send_booking_link"]);

  const noTransfer = createDefaultWizardState();
  noTransfer.transferDestinationPhone = "";
  noTransfer.voiceV2HumanTransferEnabled = false;
  assert.equal(transferEnabled(noTransfer), false);
}

function testRegistry() {
  const entries = listTopLevelRegistryEntries();
  assert.ok(entries.length > 40);
  assert.ok(entries.some((e) => e.path === "bookingStrategy" && e.owner === "appointments"));
}

function main() {
  testTraceId();
  testRedact();
  testFlattenAndDiff();
  testMergeOwnership();
  testBookingModes();
  testRegistry();
  console.log("test-receptionist-config-tracing: PASS");
  console.log(`registry_top_level_fields=${listTopLevelRegistryEntries().length}`);
}

main();
