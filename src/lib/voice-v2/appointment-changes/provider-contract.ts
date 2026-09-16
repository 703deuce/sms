import "server-only";

import type { ExistingAppointmentRef } from "./types";

/** Provider-agnostic appointment change contract (Microsoft NATIVE_UPDATE; Calendly later). */
export type RescheduleStrategy = "NATIVE_UPDATE" | "REPLACEMENT_RESCHEDULE" | "PROVIDER_RESCHEDULE_LINK";

export interface AppointmentChangeProvider {
  findExistingAppointments(input: {
    workspaceId: string;
    connectionId: string;
    rangeStart: Date;
    rangeEnd: Date;
  }): Promise<ExistingAppointmentRef[]>;

  rescheduleAppointment(input: {
    ref: ExistingAppointmentRef;
    newStartUtc: Date;
    newEndUtc: Date;
    timezone: string;
    idempotencyKey: string;
  }): Promise<{ eventId: string; strategy: RescheduleStrategy }>;

  cancelAppointment(input: {
    ref: ExistingAppointmentRef;
    comment?: string;
    idempotencyKey: string;
  }): Promise<void>;
}
