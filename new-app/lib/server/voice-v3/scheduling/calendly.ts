import "server-only";

import { getPrisma } from "@/lib/server/db";

const API = "https://api.calendly.com";

async function getCalendlyToken(connectionId: string, workspaceId: string): Promise<string> {
  const row = await getPrisma().integrationConnection.findFirst({
    where: { id: connectionId, workspaceId, provider: "calendly" },
  });
  const token = row?.accessToken?.trim();
  if (!token) throw new Error("Calendly access token missing");
  return token;
}

export async function calendlyListAvailableSlots(input: {
  workspaceId: string;
  connectionId: string;
  timezone: string;
  eventTypeUri?: string | null;
  daysAhead?: number;
}): Promise<{ slotId: string; startTimeIso: string; durationMin: number; spokenLabel: string }[]> {
  const token = await getCalendlyToken(input.connectionId, input.workspaceId);
  const start = new Date();
  const end = new Date(start.getTime() + (input.daysAhead ?? 14) * 86400000);

  let eventType = input.eventTypeUri?.trim();
  if (!eventType) {
    const meRes = await fetch(`${API}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!meRes.ok) throw new Error(`Calendly users/me failed: ${meRes.status}`);
    const me = (await meRes.json()) as { resource?: { uri?: string } };
    const userUri = me.resource?.uri;
    if (!userUri) throw new Error("Calendly user uri missing");
    const etRes = await fetch(
      `${API}/event_types?user=${encodeURIComponent(userUri)}&active=true`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!etRes.ok) throw new Error(`Calendly event_types failed: ${etRes.status}`);
    const et = (await etRes.json()) as { collection?: { uri?: string }[] };
    eventType = et.collection?.[0]?.uri;
  }
  if (!eventType) throw new Error("No Calendly event type configured");

  const params = new URLSearchParams({
    event_type: eventType,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
  });
  const res = await fetch(`${API}/event_type_available_times?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Calendly availability failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const body = (await res.json()) as {
    collection?: { start_time?: string; status?: string }[];
  };
  const slots: { slotId: string; startTimeIso: string; durationMin: number; spokenLabel: string }[] = [];
  for (const row of body.collection || []) {
    if (!row.start_time || row.status === "unavailable") continue;
    const startTimeIso = row.start_time;
    slots.push({
      slotId: `cal_${startTimeIso}`,
      startTimeIso,
      durationMin: 30,
      spokenLabel: new Date(startTimeIso).toLocaleString("en-US", {
        timeZone: input.timezone,
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    });
  }
  return slots.slice(0, 12);
}

export async function calendlyBookSlot(input: {
  workspaceId: string;
  connectionId: string;
  startTimeIso: string;
  inviteeEmail: string;
  inviteeName: string;
  eventTypeUri?: string | null;
}): Promise<{ eventUri: string; inviteeUri: string }> {
  const token = await getCalendlyToken(input.connectionId, input.workspaceId);
  let eventType = input.eventTypeUri?.trim();
  if (!eventType) throw new Error("event_type required for Calendly booking");

  const res = await fetch(`${API}/invitees`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      event_type: eventType,
      start_time: input.startTimeIso,
      invitee: {
        email: input.inviteeEmail,
        name: input.inviteeName,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Calendly book failed: ${res.status} ${text.slice(0, 300)}`);
  }
  const body = (await res.json()) as {
    resource?: { uri?: string; event?: string };
  };
  return {
    inviteeUri: body.resource?.uri || "",
    eventUri: body.resource?.event || "",
  };
}

export type CalendlyScheduledEvent = {
  uri: string;
  startTimeIso: string;
  endTimeIso: string;
  name: string;
  inviteeEmail?: string;
};

export async function calendlyListScheduledEvents(input: {
  workspaceId: string;
  connectionId: string;
  rangeStart: Date;
  rangeEnd: Date;
}): Promise<CalendlyScheduledEvent[]> {
  const token = await getCalendlyToken(input.connectionId, input.workspaceId);
  const meRes = await fetch(`${API}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!meRes.ok) throw new Error(`Calendly users/me failed: ${meRes.status}`);
  const me = (await meRes.json()) as { resource?: { uri?: string } };
  const userUri = me.resource?.uri;
  if (!userUri) throw new Error("Calendly user uri missing");

  const params = new URLSearchParams({
    user: userUri,
    status: "active",
    min_start_time: input.rangeStart.toISOString(),
    max_start_time: input.rangeEnd.toISOString(),
    count: "50",
  });
  const res = await fetch(`${API}/scheduled_events?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Calendly scheduled_events failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const body = (await res.json()) as {
    collection?: {
      uri?: string;
      start_time?: string;
      end_time?: string;
      name?: string;
    }[];
  };
  const events: CalendlyScheduledEvent[] = [];
  for (const row of body.collection || []) {
    if (!row.uri || !row.start_time) continue;
    events.push({
      uri: row.uri,
      startTimeIso: row.start_time,
      endTimeIso: row.end_time || row.start_time,
      name: row.name || "Calendly appointment",
    });
  }
  return events;
}

export async function calendlyCancelScheduledEvent(input: {
  workspaceId: string;
  connectionId: string;
  eventUri: string;
  reason?: string;
}): Promise<void> {
  const token = await getCalendlyToken(input.connectionId, input.workspaceId);
  const uuid = input.eventUri.split("/").pop();
  if (!uuid) throw new Error("Invalid Calendly event uri");
  const res = await fetch(`${API}/scheduled_events/${uuid}/cancellation`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      reason: input.reason || "Cancelled by caller via AI receptionist",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Calendly cancel failed: ${res.status} ${text.slice(0, 200)}`);
  }
}
