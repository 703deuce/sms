import type {
  SchedulingAvailabilityRequest,
  SchedulingBookRequest,
  SchedulingBookResult,
  SchedulingProvider,
  SchedulingSlot,
} from "./scheduling-types";

export class InternalSchedulingProvider implements SchedulingProvider {
  readonly name = "internal";

  constructor(private workspaceId: string) {}

  async checkAvailability(req: SchedulingAvailabilityRequest): Promise<SchedulingSlot[]> {
    const { getAvailability } = await import("@/lib/voice/calendar/booking");
    const result = await getAvailability(this.workspaceId, {
      serviceName: req.service_name,
      from: req.start_time || undefined,
      to: req.end_time || undefined,
      timezone: req.timezone || undefined,
    });
    return result.slots.map((s) => ({
      start_time: s.startsAt,
      end_time: s.endsAt,
      label: s.staffName || s.location,
    }));
  }

  async bookAppointment(_req: SchedulingBookRequest): Promise<SchedulingBookResult> {
    return {
      provider: "internal",
      provider_reference: null,
      sync_status: "not_required",
    };
  }

  async cancelAppointment(): Promise<void> {
    // Local DB cancel handled by gateway workflow.
  }

  async rescheduleAppointment(): Promise<void> {
    // Local DB reschedule handled by gateway workflow.
  }
}
