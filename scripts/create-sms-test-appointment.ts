#!/usr/bin/env tsx
/**
 * Create a test appointment with SMS consent for live confirmation testing.
 * Run: npx tsx scripts/create-sms-test-appointment.ts
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

async function main() {
  if (!PHONE) throw new Error("Set TEST_PHONE (E.164) to send a live confirmation SMS");
  const { createPlatformAppointment, getAvailability } = await import(
    "../src/lib/appointments/booking-platform"
  );
  const serviceName = process.env.SERVICE_NAME || "Initial Consultation";
  const { slots } = await getAvailability(WORKSPACE_ID, { serviceName, daysAhead: 14 });
  const futureSlots = slots.filter((s) => new Date(s.startsAt) > new Date());
  if (!futureSlots.length) throw new Error("No availability slots found");

  let result: Awaited<ReturnType<typeof createPlatformAppointment>> | null = null;
  let lastError: unknown = null;
  for (const slot of futureSlots.slice(0, 20)) {
    try {
      console.log("Trying", slot.startsAt);
      result = await createPlatformAppointment(WORKSPACE_ID, {
        serviceName,
        startsAt: slot.startsAt,
        firstName: "Anthony",
        lastName: "SMS Test",
        phone: PHONE,
        email: "anthony@transovo.ai",
        smsConsent: true,
        source: "admin",
        status: "scheduled",
        notes: "Live SMS confirmation test",
      });
      break;
    } catch (err) {
      lastError = err;
      console.warn("Slot failed:", err instanceof Error ? err.message : err);
    }
  }
  if (!result) throw lastError || new Error("Could not book any slot");

  console.log("Created appointment:", result.appointmentId);
  console.log("Starts at:", result.startsAt);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
