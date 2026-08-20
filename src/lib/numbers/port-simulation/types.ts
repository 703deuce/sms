import type { PortStatus } from "../port-constants";
import type { PortOutStatus } from "../port-out-constants";

export type PortSimulationProvider = "telnyx" | "twilio";

export type PortSimulationDirection = "port_in" | "port_out";

/** Provider-agnostic port lifecycle event fed into the same handlers as live webhooks. */
export type NormalizedPortEvent = {
  simulationId: string;
  direction: PortSimulationDirection;
  provider: PortSimulationProvider;
  phone: string;
  /** Stable idempotency key for duplicate webhook tests */
  providerEventId: string;
  occurredAt: string;
  portInStatus?: PortStatus;
  portOutStatus?: PortOutStatus;
  telnyx?: {
    portOutId?: string;
    rawStatus?: string;
    eventType?: string;
    rejectionReason?: string;
    focDate?: string;
    messagingStatus?: string;
  };
  twilio?: {
    eventType?: string;
    rawStatus?: string;
  };
  note?: string;
  /** When replaying the same providerEventId for idempotency tests */
  duplicate?: boolean;
};

export type PortSimulationScenarioStep = {
  label: string;
  event: NormalizedPortEvent;
  /** When true, replay the same providerEventId to assert idempotent handling */
  duplicate?: boolean;
};

export type PortSimulationScenario = {
  id: string;
  title: string;
  direction: PortSimulationDirection;
  provider: PortSimulationProvider;
  phone: string;
  steps: PortSimulationScenarioStep[];
};

export type ApplyNormalizedPortEventResult = {
  handled: boolean;
  direction: PortSimulationDirection;
  provider: PortSimulationProvider;
  duplicate?: boolean;
  portOutId?: string;
  portInId?: string;
  status?: string;
  reason?: string;
};
