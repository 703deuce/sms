/**
 * Port simulation harness tests — payload mapping (always) + DB scenarios when DATABASE_URL set.
 * Run: npm run test:port-simulation-harness
 */
import assert from "node:assert/strict";
import {
  PORT_SIMULATION_SCENARIOS,
  buildTelnyxPortOutWebhookPayload,
  buildTwilioPortOutWebhookPayload,
} from "../src/lib/numbers/port-simulation";

function testPayloadAdapters() {
  const telnyxScenario = PORT_SIMULATION_SCENARIOS.find((s) => s.id === "TEST-PORT-OUT-TELNYX-HAPPY");
  assert.ok(telnyxScenario);
  const first = telnyxScenario!.steps[0]!.event;
  const payload = buildTelnyxPortOutWebhookPayload(first);
  assert.equal(payload.status, "pending");
  assert.deepEqual(payload.phone_numbers, [first.phone]);

  const twilioScenario = PORT_SIMULATION_SCENARIOS.find((s) => s.id === "TEST-PORT-OUT-TWILIO-COMPLETE");
  assert.ok(twilioScenario);
  const twilioPayload = buildTwilioPortOutWebhookPayload(twilioScenario!.steps[0]!.event);
  assert.equal(twilioPayload.EventType, "PortOutPhoneNumberCompleted");
  assert.equal(twilioPayload.phone_number, "+15715550103");
}

async function testDbScenarios() {
  if (!process.env.DATABASE_URL) {
    console.log("  db scenarios: skipped (DATABASE_URL not set)");
    return;
  }

  process.env.PORT_SIMULATION_ENABLED = "1";

  const { getPrisma } = await import("../src/lib/db");
  const { createPortRequest } = await import("../src/lib/numbers/port-service");
  const { setPersonalPortOutPin } = await import("../src/lib/numbers/personal-port-out-service");
  const { initiatePortOutTransfer } = await import("../src/lib/numbers/port-out-service");
  const { applyNormalizedPortEvent } = await import("../src/lib/numbers/port-simulation/apply-event");

  const prisma = getPrisma();
  const workspace = await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } });
  const user = workspace
    ? await prisma.user.findFirst({ where: { id: workspace.ownerUserId } })
    : null;
  if (!workspace || !user) {
    console.log("  db scenarios: skipped (no workspace/user seed data)");
    return;
  }

  const phone = await prisma.phoneNumber.findFirst({
    where: { workspaceId: workspace.id, provider: "telnyx", releasedAt: null },
  });
  if (!phone) {
    console.log("  db scenarios: skipped (no active Telnyx phone number in workspace)");
    return;
  }

  await setPersonalPortOutPin(workspace.id, phone.id, "1234", false);

  const portOut = await initiatePortOutTransfer({
    workspaceId: workspace.id,
    userId: user.id,
    phoneNumberId: phone.id,
    destinationType: "verizon",
    destinationCarrier: "Verizon",
  });

  const rejectScenario = PORT_SIMULATION_SCENARIOS.find(
    (s) => s.id === "TEST-PORT-OUT-TELNYX-REJECT-RETRY",
  )!;
  const rejectEvent = {
    ...rejectScenario.steps[0]!.event,
    phone: phone.e164,
    telnyx: { ...rejectScenario.steps[0]!.event.telnyx, portOutId: `sim-${portOut.portOut.id}` },
  };

  const first = await applyNormalizedPortEvent({
    event: rejectEvent,
    skipIdempotency: true,
  });
  assert.equal(first.handled, true);

  const duplicate = await applyNormalizedPortEvent({
    event: { ...rejectEvent, duplicate: true },
    skipIdempotency: false,
  });
  assert.equal(duplicate.duplicate, true);

  const portIn = await createPortRequest({
    workspaceId: workspace.id,
    userId: user.id,
    phone: "+15715550999",
    currentCarrier: "Verizon",
  });

  const portInScenario = PORT_SIMULATION_SCENARIOS.find((s) => s.id === "TEST-PORT-IN-LIFECYCLE")!;
  for (const step of portInScenario.steps) {
    const result = await applyNormalizedPortEvent({
      event: { ...step.event, phone: portIn.phone },
      workspaceId: workspace.id,
      portInRequestId: portIn.id,
      byUserId: user.id,
      skipIdempotency: true,
    });
    assert.equal(result.handled, true, step.label);
    assert.equal(result.status, step.event.portInStatus, step.label);
  }

  console.log("  db scenarios: ok (port-in lifecycle + port-out rejection)");
}

async function main() {
  testPayloadAdapters();
  console.log("  payload adapters: ok");
  await testDbScenarios();
  console.log("test-port-simulation-harness: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
