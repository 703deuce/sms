import { createHash } from "node:crypto";
import { buildAdapterContext } from "@/lib/integrations/framework/context";
import {
  bookEventInvitee,
  listEventTypeAvailableTimes,
} from "@/lib/integrations/adapters/calendly-actions";

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
    readonly timezone: string,
  ) {}

  static async create(input: {
    workspaceId: string;
    timezone: string;
    eventTypeUri?: string | null;
  }): Promise<CalendlyCalendar> {
    const cal = new CalendlyCalendar(input.workspaceId, input.timezone);
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
    startTime: Date;
    endTime: Date;
    durationMin?: number;
  }): Promise<AvailableSlot[]> {
    const ctx = await this.adapter();
    const durationMin = input.durationMin ?? 30;
    const listed = await listEventTypeAvailableTimes(ctx, {
      eventTypeUri: this.eventTypeUri || undefined,
      startTime: input.startTime.toISOString(),
      endTime: input.endTime.toISOString(),
    });
    this.eventTypeUri = listed.eventTypeUri;
    return listed.slots
      .filter((slot) => slot.status === "available")
      .map((slot) => {
        const startTime = new Date(slot.startTime);
        return {
          startTime,
          durationMin,
          slotId: slotIdFor(startTime, durationMin),
        };
      });
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
    const ctx = await this.adapter();
    try {
      const booked = await bookEventInvitee(ctx, {
        eventTypeUri: this.eventTypeUri || undefined,
        startTime: input.slot.startTime.toISOString(),
        name: input.attendeeName?.trim() || input.attendeeEmail.split("@")[0] || "Caller",
        email: input.attendeeEmail,
        timezone: this.timezone,
      });
      const appointment: BookedAppointment = {
        slot: input.slot,
        attendeeEmail: input.attendeeEmail,
        inviteeUri: booked.inviteeUri,
        eventUri: booked.eventUri,
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
