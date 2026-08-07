import type {
  SchedulingAvailabilityRequest,
  SchedulingBookRequest,
  SchedulingBookResult,
  SchedulingProvider,
  SchedulingSlot,
} from "./scheduling-types";

export class CalendlySchedulingProvider implements SchedulingProvider {
  readonly name = "calendly";

  constructor(private workspaceId: string) {}

  async checkAvailability(req: SchedulingAvailabilityRequest): Promise<SchedulingSlot[]> {
    const { executeLiveAgentCalendlyAction } = await import("@/lib/voice/tools/builtin-actions-calendly");
    const { buildCalendlyListAvailableTimesParams } = await import("@/lib/voice/calendar/booking-args");
    const params = buildCalendlyListAvailableTimesParams(
      {
        serviceName: req.service_name,
        from: req.start_time || undefined,
        to: req.end_time || undefined,
        timezone: req.timezone || undefined,
      },
      { maxDays: 3 },
    );
    const result = await executeLiveAgentCalendlyAction({
      workspaceId: this.workspaceId,
      actionId: "appointment.list_available_times",
      params,
    });
    const raw = result as { slots?: Array<{ startsAt?: string }> };
    const slots = Array.isArray(raw.slots) ? raw.slots : [];
    return slots
      .map((s) => ({ start_time: String(s.startsAt || "") }))
      .filter((s) => s.start_time);
  }

  async bookAppointment(_req: SchedulingBookRequest): Promise<SchedulingBookResult> {
    return {
      provider: "calendly",
      provider_reference: null,
      sync_status: "pending",
    };
  }

  async cancelAppointment(providerReference: string, reason?: string): Promise<void> {
    const { cancelAppointment } = await import("@/lib/integrations/adapters/calendly-actions");
    const { buildAdapterContext } = await import("@/lib/integrations/framework/context");
    const ctx = await buildAdapterContext(this.workspaceId, "calendly");
    const eventUri = providerReference.replace(/^calendly:/, "");
    await cancelAppointment(ctx, { eventUri, reason });
  }

  async rescheduleAppointment(
    providerReference: string,
    _newStartTime: string,
    _timezone: string,
  ): Promise<void> {
    await this.cancelAppointment(providerReference, "rescheduled");
  }
}
