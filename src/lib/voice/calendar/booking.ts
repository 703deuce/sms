import { getPrisma } from "@/lib/db";

type Slot = { startsAt: string; endsAt: string; staffName?: string };

export async function getAvailability(
  workspaceId: string,
  input: Record<string, unknown>,
): Promise<{ slots: Slot[] }> {
  const prisma = getPrisma();
  const serviceName = String(input.serviceName || input.service || "default");
  const calendarId = input.calendarId as string | undefined;
  const duration = Number(input.durationMinutes || 30);
  const days = Number(input.daysAhead || 7);

  const service = await prisma.voiceService.findFirst({
    where: { workspaceId, name: serviceName },
  });
  const durationMinutes = service?.durationMinutes || duration;

  if (calendarId) {
    const cal = await prisma.voiceCalendarConnection.findFirst({
      where: { id: calendarId, workspaceId },
    });
    if (cal?.provider === "google" || cal?.provider === "microsoft") {
      // OAuth-connected calendars use stored tokens + external API when configured
      const config = (cal.config || {}) as Record<string, unknown>;
      if (config.webhookUrl) {
        const { assertSafeWebhookUrl } = await import("../url-safety");
        const url = await assertSafeWebhookUrl(String(config.webhookUrl));
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "availability", serviceName, days }),
        });
        const json = await res.json();
        return { slots: (json.slots as Slot[]) || [] };
      }
    }
  }

  // Internal availability: business hours 9-17, skip existing appointments
  const slots: Slot[] = [];
  const now = new Date();
  for (let d = 0; d < days; d += 1) {
    const day = new Date(now);
    day.setDate(day.getDate() + d);
    for (let hour = 9; hour < 17; hour += 1) {
      const start = new Date(day);
      start.setHours(hour, 0, 0, 0);
      const end = new Date(start.getTime() + durationMinutes * 60_000);
      const conflict = await prisma.voiceAppointment.findFirst({
        where: {
          workspaceId,
          startsAt: { lte: end },
          endsAt: { gte: start },
          status: { not: "cancelled" },
        },
      });
      if (!conflict && start > now) {
        slots.push({
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
        });
      }
    }
  }
  return { slots: slots.slice(0, 20) };
}

export async function bookAppointment(
  workspaceId: string,
  input: Record<string, unknown>,
) {
  const prisma = getPrisma();
  const startsAt = new Date(String(input.startsAt || ""));
  if (Number.isNaN(startsAt.getTime())) throw new Error("startsAt required");

  const durationMinutes = Number(input.durationMinutes || 30);
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  const phone = String(input.phone || "");
  const contactId = input.contactId as string | undefined;
  const callId = input.callId as string | undefined;

  const conflict = await prisma.voiceAppointment.findFirst({
    where: {
      workspaceId,
      startsAt: { lte: endsAt },
      endsAt: { gte: startsAt },
      status: { not: "cancelled" },
    },
  });
  if (conflict) throw new Error("Slot no longer available");

  const appointment = await prisma.voiceAppointment.create({
    data: {
      workspaceId,
      callId,
      contactId,
      serviceName: String(input.serviceName || "Appointment"),
      staffName: String(input.staffName || "") || null,
      startsAt,
      endsAt,
      timezone: String(input.timezone || "America/New_York"),
      status: "confirmed",
      metadata: input as object,
    },
  });

  if (callId) {
    await prisma.voiceCall.update({
      where: { id: callId },
      data: { appointmentBooked: true },
    });
  }

  return { ok: true, appointmentId: appointment.id, startsAt: appointment.startsAt };
}
