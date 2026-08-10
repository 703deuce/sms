import { createHash } from "node:crypto";
import { buildAdapterContext } from "@/lib/integrations/framework/context";
import { listEventTypeAvailableTimes } from "@/lib/integrations/adapters/calendly-actions";
import {
  buildCalendlyBookParams,
  buildCalendlyListAvailableTimesParams,
} from "@/lib/voice/calendar/booking-args";
import { requireCalendlyIntegrationOk } from "@/lib/voice/calendar/calendly-voice";
import { executeLiveAgentCalendlyAction } from "@/lib/voice/tools/builtin-actions-calendly";

/**
 * Calendly scheduling constraints (see calendly-actions.ts):
 * - GET /event_type_available_times: start_time must be future ISO; window ≤7 days per request
 *   (API allows up to 31 — we chunk at 7 to match the Amy/Telnyx path and tool timeouts).
 * - POST /invitees: start_time must match a slot from the latest availability call; requires
 *   paid plan + write OAuth scopes (scheduling_links:write, scheduled_events:write).
 * - event_type: full Calendly URI (https://api.calendly.com/event_types/…); defaults to the
 *   first active event type on the connected account when omitted.
 */
const CALENDLY_MAX_WINDOW_DAYS = 7;

export class SlotUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SlotUnavailableError";
  }
}

export type AvailableSlot = {
  startTime: Date;
  durationMin: number;
  slotId: string;
};

export type BookedAppointment = {
  slot: AvailableSlot;
  attendeeEmail: string;
  inviteeUri: string;
  eventUri: string;
};

function slotIdFor(startTime: Date, durationMin: number): string {
  const raw = `${startTime.toISOString()}|${durationMin}`;
  const digest = createHash("blake2s256").update(raw).digest();
  return `ST_${digest.subarray(0, 5).toString("hex")}`;
}

function formatRelativeTime(start: Date, now: Date): string {
  const ms = start.getTime() - now.getTime();
  const days = Math.floor(ms / 86_400_000);
  const sameDay = start.toDateString() === now.toDateString();
  const tomorrow = start.toDateString() === new Date(now.getTime() + 86_400_000).toDateString();

  if (sameDay) {
    return ms < 3_600_000 ? "in less than an hour" : "later today";
  }
  if (tomorrow) return "tomorrow";
  if (days < 7) return `in ${days} days`;
  if (days < 14) return "in 1 week";
  return `in ${Math.floor(days / 7)} weeks`;
}

export class CalendlyCalendar {
  readonly scheduledAppointments: BookedAppointment[] = [];
  private eventTypeUri: string | null = null;

  private constructor(
    private readonly workspaceId: string,
    private readonly agentId: string,
    private readonly callId: string,
    readonly timezone: string,
  ) {}

  static async create(input: {
    workspaceId: string;
    agentId: string;
    callId: string;
    timezone: string;
    eventTypeUri?: string | null;
  }): Promise<CalendlyCalendar> {
    const cal = new CalendlyCalendar(
      input.workspaceId,
      input.agentId,
      input.callId,
      input.timezone,
    );
    await cal.initialize(input.eventTypeUri || null);
    return cal;
  }

  now(): Date {
    return new Date();
  }

  private async adapter() {
    return buildAdapterContext(this.workspaceId, "calendly");
  }

  async initialize(eventTypeUri: string | null): Promise<void> {
    const ctx = await this.adapter();
    if (eventTypeUri) {
      this.eventTypeUri = eventTypeUri;
      return;
    }
    const listed = await listEventTypeAvailableTimes(ctx, {
      startTime: new Date(Date.now() + 60 * 60_000).toISOString(),
      endTime: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    });
    this.eventTypeUri = listed.eventTypeUri;
  }

  async listAvailableSlots(input: {
    daysAhead?: number;
    durationMin?: number;
  } = {}): Promise<AvailableSlot[]> {
    const ctx = await this.adapter();
    const durationMin = input.durationMin ?? 30;
    const requestedDays = Math.max(1, Math.min(14, input.daysAhead ?? 7));
    const now = this.now();
    const slotsByStart = new Map<string, AvailableSlot>();
    let scanFrom: string | undefined;
    let remainingDays = requestedDays;

    while (remainingDays > 0) {
      const chunkDays = Math.min(CALENDLY_MAX_WINDOW_DAYS, remainingDays);
      const calParams = buildCalendlyListAvailableTimesParams(
        {
          daysAhead: chunkDays,
          eventTypeUri: this.eventTypeUri || undefined,
          ...(scanFrom ? { startTime: scanFrom } : {}),
        },
        { maxDays: chunkDays, now },
      );
      const listed = await listEventTypeAvailableTimes(ctx, {
        eventTypeUri: calParams.eventTypeUri,
        startTime: calParams.startTime,
        endTime: calParams.endTime,
      });
      this.eventTypeUri = listed.eventTypeUri;
      for (const slot of listed.slots) {
        if (slot.status !== "available" || !slot.startTime) continue;
        const startTime = new Date(slot.startTime);
        const key = startTime.toISOString();
        if (!slotsByStart.has(key)) {
          slotsByStart.set(key, {
            startTime,
            durationMin,
            slotId: slotIdFor(startTime, durationMin),
          });
        }
      }
      scanFrom = calParams.endTime;
      remainingDays -= chunkDays;
    }

    return [...slotsByStart.values()].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime(),
    );
  }

  formatSlotsForModel(slots: AvailableSlot[]): string {
    const now = this.now();
    return slots
      .map((slot) => {
        const local = slot.startTime;
        const rel = formatRelativeTime(local, now);
        const weekday = local.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
          timeZone: this.timezone,
        });
        const time = local.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: this.timezone,
        });
        return `${slot.slotId} – ${weekday} at ${time} (${rel})`;
      })
      .join("\n");
  }

  async scheduleAppointment(input: {
    slot: AvailableSlot;
    attendeeEmail: string;
    attendeeName?: string;
  }): Promise<BookedAppointment> {
    const bookParams = buildCalendlyBookParams({
      startsAt: input.slot.startTime.toISOString(),
      name:
        input.attendeeName?.trim() ||
        input.attendeeEmail.split("@")[0] ||
        "Caller",
      email: input.attendeeEmail,
      timezone: this.timezone,
      eventTypeUri: this.eventTypeUri || undefined,
    });
    if (!bookParams.startTime) {
      throw new Error("Missing start time for booking");
    }

    try {
      const result = await executeLiveAgentCalendlyAction({
        workspaceId: this.workspaceId,
        agentId: this.agentId,
        callId: this.callId,
        actionId: "appointment.book",
        params: bookParams,
      });
      const booked = requireCalendlyIntegrationOk(result, "book invitee");
      const data = (booked.data || {}) as {
        inviteeUri?: string;
        eventUri?: string;
      };
      const inviteeUri = String(data.inviteeUri || "");
      const eventUri = String(data.eventUri || "");
      if (!inviteeUri || !eventUri) {
        throw new Error("Calendly booking succeeded but returned no invitee/event URI");
      }
      const appointment: BookedAppointment = {
        slot: input.slot,
        attendeeEmail: input.attendeeEmail,
        inviteeUri,
        eventUri,
      };
      this.scheduledAppointments.push(appointment);
      return appointment;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/not available|already has booking|slot/i.test(message)) {
        throw new SlotUnavailableError(message);
      }
      throw err;
    }
  }
}
