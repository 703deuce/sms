import type { PortSimulationScenario } from "./types";

const now = () => new Date().toISOString();

function telnyxPortOutId(suffix: string) {
  return `sim-telnyx-${suffix}`;
}

/** Canonical happy-path + failure scenarios for automated regression. */
export const PORT_SIMULATION_SCENARIOS: PortSimulationScenario[] = [
  {
    id: "TEST-PORT-OUT-TELNYX-HAPPY",
    title: "Telnyx port-out: request → authorize → FOC → complete",
    direction: "port_out",
    provider: "telnyx",
    phone: "+15715550101",
    steps: [
      {
        label: "Carrier request received",
        event: {
          simulationId: "TEST-PORT-OUT-TELNYX-HAPPY-1",
          direction: "port_out",
          provider: "telnyx",
          phone: "+15715550101",
          providerEventId: "sim:telnyx:port-out:101:pending",
          occurredAt: now(),
          portOutStatus: "REQUEST_RECEIVED",
          telnyx: { portOutId: telnyxPortOutId("101"), rawStatus: "pending" },
        },
      },
      {
        label: "Authorized",
        event: {
          simulationId: "TEST-PORT-OUT-TELNYX-HAPPY-2",
          direction: "port_out",
          provider: "telnyx",
          phone: "+15715550101",
          providerEventId: "sim:telnyx:port-out:101:authorized",
          occurredAt: now(),
          portOutStatus: "AUTHORIZED",
          telnyx: { portOutId: telnyxPortOutId("101"), rawStatus: "authorized" },
        },
      },
      {
        label: "FOC scheduled",
        event: {
          simulationId: "TEST-PORT-OUT-TELNYX-HAPPY-3",
          direction: "port_out",
          provider: "telnyx",
          phone: "+15715550101",
          providerEventId: "sim:telnyx:port-out:101:foc",
          occurredAt: now(),
          portOutStatus: "SCHEDULED",
          telnyx: {
            portOutId: telnyxPortOutId("101"),
            rawStatus: "authorized",
            focDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
          },
        },
      },
      {
        label: "Port completed",
        event: {
          simulationId: "TEST-PORT-OUT-TELNYX-HAPPY-4",
          direction: "port_out",
          provider: "telnyx",
          phone: "+15715550101",
          providerEventId: "sim:telnyx:port-out:101:ported",
          occurredAt: now(),
          portOutStatus: "COMPLETED",
          telnyx: { portOutId: telnyxPortOutId("101"), rawStatus: "ported" },
        },
      },
    ],
  },
  {
    id: "TEST-PORT-OUT-TELNYX-REJECT-RETRY",
    title: "Telnyx port-out: rejection → correction → complete",
    direction: "port_out",
    provider: "telnyx",
    phone: "+15715550102",
    steps: [
      {
        label: "PIN mismatch rejection",
        event: {
          simulationId: "TEST-PORT-OUT-TELNYX-REJECT-1",
          direction: "port_out",
          provider: "telnyx",
          phone: "+15715550102",
          providerEventId: "sim:telnyx:port-out:102:rejected",
          occurredAt: now(),
          portOutStatus: "ACTION_REQUIRED",
          telnyx: {
            portOutId: telnyxPortOutId("102"),
            rawStatus: "rejected-pending",
            rejectionReason: "PIN mismatch",
          },
        },
      },
      {
        label: "Duplicate rejection webhook",
        duplicate: true,
        event: {
          simulationId: "TEST-PORT-OUT-TELNYX-REJECT-1-dup",
          direction: "port_out",
          provider: "telnyx",
          phone: "+15715550102",
          providerEventId: "sim:telnyx:port-out:102:rejected",
          occurredAt: now(),
          portOutStatus: "ACTION_REQUIRED",
          telnyx: {
            portOutId: telnyxPortOutId("102"),
            rawStatus: "rejected-pending",
            rejectionReason: "PIN mismatch",
          },
        },
      },
      {
        label: "Authorized after correction",
        event: {
          simulationId: "TEST-PORT-OUT-TELNYX-REJECT-2",
          direction: "port_out",
          provider: "telnyx",
          phone: "+15715550102",
          providerEventId: "sim:telnyx:port-out:102:authorized",
          occurredAt: now(),
          portOutStatus: "AUTHORIZED",
          telnyx: { portOutId: telnyxPortOutId("102"), rawStatus: "authorized" },
        },
      },
      {
        label: "Completed",
        event: {
          simulationId: "TEST-PORT-OUT-TELNYX-REJECT-3",
          direction: "port_out",
          provider: "telnyx",
          phone: "+15715550102",
          providerEventId: "sim:telnyx:port-out:102:ported",
          occurredAt: now(),
          portOutStatus: "COMPLETED",
          telnyx: { portOutId: telnyxPortOutId("102"), rawStatus: "ported" },
        },
      },
    ],
  },
  {
    id: "TEST-PORT-OUT-TWILIO-COMPLETE",
    title: "Twilio port-out completion",
    direction: "port_out",
    provider: "twilio",
    phone: "+15715550103",
    steps: [
      {
        label: "PortOutPhoneNumberCompleted",
        event: {
          simulationId: "TEST-PORT-OUT-TWILIO-1",
          direction: "port_out",
          provider: "twilio",
          phone: "+15715550103",
          providerEventId: "sim:twilio:port-out:103:completed",
          occurredAt: now(),
          portOutStatus: "COMPLETED",
          twilio: { eventType: "PortOutPhoneNumberCompleted", rawStatus: "completed" },
        },
      },
    ],
  },
  {
    id: "TEST-PORT-IN-LIFECYCLE",
    title: "Port-in: draft → submitted → in progress → FOC → completed",
    direction: "port_in",
    provider: "telnyx",
    phone: "+15715550104",
    steps: [
      {
        label: "Submitted to carrier",
        event: {
          simulationId: "TEST-PORT-IN-1",
          direction: "port_in",
          provider: "telnyx",
          phone: "+15715550104",
          providerEventId: "sim:port-in:104:submitted",
          occurredAt: now(),
          portInStatus: "submitted",
        },
      },
      {
        label: "Carrier review",
        event: {
          simulationId: "TEST-PORT-IN-2",
          direction: "port_in",
          provider: "telnyx",
          phone: "+15715550104",
          providerEventId: "sim:port-in:104:in_progress",
          occurredAt: now(),
          portInStatus: "in_progress",
        },
      },
      {
        label: "FOC confirmed",
        event: {
          simulationId: "TEST-PORT-IN-3",
          direction: "port_in",
          provider: "telnyx",
          phone: "+15715550104",
          providerEventId: "sim:port-in:104:foc",
          occurredAt: now(),
          portInStatus: "foc_confirmed",
        },
      },
      {
        label: "Completed",
        event: {
          simulationId: "TEST-PORT-IN-4",
          direction: "port_in",
          provider: "telnyx",
          phone: "+15715550104",
          providerEventId: "sim:port-in:104:completed",
          occurredAt: now(),
          portInStatus: "completed",
        },
      },
    ],
  },
];
