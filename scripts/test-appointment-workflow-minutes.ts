#!/usr/bin/env tsx
/**
 * Create/activate rapid-flow-test workflow and book a test appointment.
 * Workflow steps fire at 0/1/3/5 minutes after booking (not hours).
 *
 * Run:
 *   TEST_PHONE=<e164> npx tsx scripts/test-appointment-workflow-minutes.ts
 */
import Module from "node:module";

const originalLoad = (Module as unknown as { _load: Function })._load;
(Module as unknown as { _load: Function })._load = function (
  request: string,
  parent: unknown,
  isMain: boolean,
) {
  if (request === "server-only") return {};
  return originalLoad(request, parent, isMain);
};

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const PHONE = process.env.TEST_PHONE?.trim();
const WORKFLOW_NAME = process.env.WORKFLOW_NAME || "Rapid Flow Test (minutes)";

async function main() {
  if (!PHONE) throw new Error("Set TEST_PHONE (E.164) for live workflow SMS test");

  const { getPrisma } = await import("../src/lib/db");
  const { getPrebuiltTemplate } = await import("../src/lib/appointment-workflows/templates");
  const { createPlatformAppointment, getAvailability } = await import(
    "../src/lib/appointments/booking-platform"
  );
  const { dispatchAppointmentWorkflowTrigger } = await import(
    "../src/lib/appointment-workflows/engine"
  );
  const prisma = getPrisma();

  const template = getPrebuiltTemplate("rapid_flow_test");
  if (!template) throw new Error("rapid_flow_test template missing");

  let workflow = await prisma.appointmentWorkflow.findFirst({
    where: { workspaceId: WORKSPACE_ID, name: WORKFLOW_NAME },
  });

  if (!workflow) {
    workflow = await prisma.appointmentWorkflow.create({
      data: {
        workspaceId: WORKSPACE_ID,
        name: WORKFLOW_NAME,
        sourceType: "template",
        templateId: "rapid_flow_test",
        active: true,
        status: "active",
        trigger: template.trigger,
        appointmentTypeScope: { mode: "all" } as object,
        channels: template.channels,
        conditions: template.defaultConditions as object,
        stepsJson: template.defaultSteps as object,
        version: 1,
      },
    });
    console.log("Created workflow:", workflow.id);
  } else {
    workflow = await prisma.appointmentWorkflow.update({
      where: { id: workflow.id },
      data: {
        active: true,
        status: "active",
        stepsJson: template.defaultSteps as object,
      },
    });
    console.log("Updated workflow:", workflow.id);
  }

  const serviceName = process.env.SERVICE_NAME || "Initial Consultation";
  const { slots } = await getAvailability(WORKSPACE_ID, { serviceName, daysAhead: 14 });
  const futureSlots = slots.filter((s) => new Date(s.startsAt) > new Date());
  if (!futureSlots.length) throw new Error("No availability slots");

  let result: Awaited<ReturnType<typeof createPlatformAppointment>> | null = null;
  let lastError: unknown = null;
  for (const slot of futureSlots.slice(0, 20)) {
    try {
      result = await createPlatformAppointment(WORKSPACE_ID, {
        serviceName,
        startsAt: slot.startsAt,
        firstName: "Workflow",
        lastName: "MinuteTest",
        phone: PHONE,
        email: "workflow-test@transovo.ai",
        smsConsent: true,
        source: "admin",
        status: "scheduled",
        notes: "Rapid workflow minute test",
      });
      break;
    } catch (err) {
      lastError = err;
      console.warn("Slot failed:", slot.startsAt, err instanceof Error ? err.message : err);
    }
  }
  if (!result) throw lastError || new Error("Could not book any slot");

  console.log("Booked appointment:", result.appointmentId, "at", result.startsAt);

  await dispatchAppointmentWorkflowTrigger({
    workspaceId: WORKSPACE_ID,
    appointmentId: result.appointmentId,
    trigger: "appointment_booked",
    contactId: result.contactId,
  });

  const steps = await prisma.appointmentWorkflowStepExecution.findMany({
    where: { workspaceId: WORKSPACE_ID, execution: { appointmentId: result.appointmentId } },
    orderBy: { scheduledFor: "asc" },
    select: {
      id: true,
      stepId: true,
      state: true,
      scheduledFor: true,
      providerMessageId: true,
    },
  });

  console.log("\nScheduled workflow steps:");
  for (const step of steps) {
    console.log(
      `  ${step.stepId} @ ${step.scheduledFor.toISOString()} state=${step.state} providerMessageId=${step.providerMessageId || "—"}`,
    );
  }

  console.log(
    "\nJobs will fire via appointment_workflow_step queue at the scheduled times (1/3/5 min after booking).",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
