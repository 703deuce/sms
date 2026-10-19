import "server-only";

import type { SchedulingBackend } from "./connections";

export type ProviderSchedulingCaps = {
  findAppointment: boolean;
  rescheduleAppointment: boolean;
  cancelAppointment: boolean;
};

export function schedulingCapsForBackend(
  backend: Extract<SchedulingBackend, { ok: true }>,
): ProviderSchedulingCaps {
  if (backend.provider === "calendly") {
    return {
      findAppointment: true,
      rescheduleAppointment: false,
      cancelAppointment: true,
    };
  }
  return {
    findAppointment: true,
    rescheduleAppointment: true,
    cancelAppointment: true,
  };
}
