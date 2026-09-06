import "server-only";

import { microsoftGraphFetch } from "@/lib/calendar/providers";
import type { CalendarConfig } from "@/lib/calendar/providers";
import { MICROSOFT_GRAPH_V1 } from "@/lib/microsoft/graph-helpers";

export async function createTeamsMeetingForAppointment(input: {
  connectionId: string;
  config: CalendarConfig;
  subject: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  attendees?: Array<{ email: string; name?: string }>;
}): Promise<{ joinUrl: string; eventId: string } | null> {
  const body = {
    subject: input.subject,
    body: { contentType: "HTML", content: "Teams meeting created by Transovo" },
    start: {
      dateTime: input.startsAt.toISOString(),
      timeZone: input.timezone,
    },
    end: {
      dateTime: input.endsAt.toISOString(),
      timeZone: input.timezone,
    },
    isOnlineMeeting: true,
    onlineMeetingProvider: "teamsForBusiness",
    attendees: (input.attendees || []).map((a) => ({
      emailAddress: { address: a.email, name: a.name || a.email },
      type: "required",
    })),
  };

  const res = await microsoftGraphFetch(
    input.connectionId,
    input.config,
    `${MICROSOFT_GRAPH_V1}/me/events`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) return null;
  const json = (await res.json()) as {
    id?: string;
    onlineMeeting?: { joinUrl?: string };
  };
  const joinUrl = json.onlineMeeting?.joinUrl;
  if (!json.id || !joinUrl) return null;
  return { joinUrl, eventId: json.id };
}

export async function attachTeamsUrlToAppointment(
  workspaceId: string,
  appointmentId: string,
  joinUrl: string,
) {
  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
  });
  if (!row) return;
  const meta = (row.metadata || {}) as Record<string, unknown>;
  await prisma.voiceAppointment.update({
    where: { id: appointmentId },
    data: {
      metadata: {
        ...meta,
        meetingUrl: joinUrl,
        joinUrl,
        locationKind: "microsoft_teams",
      } as object,
    },
  });
}
