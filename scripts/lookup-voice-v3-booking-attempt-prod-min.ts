#!/usr/bin/env npx tsx
import { getValidAccessToken, listMicrosoftCalendarEvents } from "@/lib/calendar/providers";
import { resolveVoiceV3AgentConfigForAgent } from "@/lib/voice-v3/config/from-published-agent";
import { resolveVoiceV3MicrosoftCalendar } from "@/lib/voice-v3/calendar/microsoft/resolve-voice-v3-microsoft-calendar";

const BOOKING_ATTEMPT_ID =
  process.env.BOOKING_ATTEMPT_ID?.trim() || "bka_cmual7tho3r3a1h5p111n215l";

async function main() {
  const config = await resolveVoiceV3AgentConfigForAgent({
    workspaceId: process.env.WORKSPACE_ID?.trim() || "ws_1",
    agentId: process.env.VOICE_AGENT_ID?.trim() || "cmshz2lc25c622c4i58303501",
  });
  const ms = await resolveVoiceV3MicrosoftCalendar(config);
  if (!ms.ok) {
    console.error(ms.message);
    process.exit(1);
  }

  const token = await getValidAccessToken(ms.connectionId, "microsoft", ms.calendarConfig);
  const timeMin = new Date(process.env.TIME_MIN || "2026-09-20T00:00:00.000Z");
  const timeMax = new Date(process.env.TIME_MAX || "2026-09-28T23:59:59.000Z");
  const calendarId = ms.calendarIds[0] || "primary";

  const events = await listMicrosoftCalendarEvents(
    token,
    timeMin,
    timeMax,
    calendarId,
    { connectionId: ms.connectionId, config: ms.calendarConfig },
  );

  const needle = `transovo_booking_attempt=${BOOKING_ATTEMPT_ID}`;
  const match = events.filter(
    (e) =>
      (e.description ?? "").includes(needle) ||
      (e.description ?? "").includes(BOOKING_ATTEMPT_ID),
  );

  console.log(
    JSON.stringify(
      {
        bookingAttemptId: BOOKING_ATTEMPT_ID,
        calendarId,
        scannedEvents: events.length,
        matchCount: match.length,
        matches: match.map((e) => ({
          providerEventId: e.id,
          subject: e.summary,
          start: e.start.toISOString(),
          end: e.end.toISOString(),
          description: e.description,
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
