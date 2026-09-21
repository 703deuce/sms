#!/usr/bin/env npx tsx
/**
 * Fetch Microsoft calendar event by transovo_booking_attempt id in description.
 *
 *   BOOKING_ATTEMPT_ID=bka_... NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/lookup-voice-v3-booking-attempt.ts
 */
import { getValidAccessToken, listMicrosoftCalendarEventsForAppointmentDiscovery } from "@/lib/voice/calendar/providers";
import { extractTransovoLabeledIdentity } from "@/lib/voice-v3/calendar/appointment-discovery-identity";
import { resolveVoiceV3AgentConfigForAgent } from "@/lib/voice-v3/config/from-published-agent";
import { resolveVoiceV3MicrosoftCalendar } from "@/lib/voice-v3/calendar/microsoft/resolve-voice-v3-microsoft-calendar";

const BOOKING_ATTEMPT_ID =
  process.env.BOOKING_ATTEMPT_ID?.trim() || "bka_cmual7tho3r3a1h5p111n215l";
const WORKSPACE_ID = process.env.WORKSPACE_ID?.trim() || "ws_1";
const AGENT_ID = process.env.VOICE_AGENT_ID?.trim() || "cmshz2lc25c622c4i58303501";

async function main() {
  const config = await resolveVoiceV3AgentConfigForAgent({
    workspaceId: WORKSPACE_ID,
    agentId: AGENT_ID,
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

  const events = await listMicrosoftCalendarEventsForAppointmentDiscovery(
    token,
    timeMin,
    timeMax,
    calendarId,
    { connectionId: ms.connectionId, config: ms.calendarConfig },
  );

  const needle = `transovo_booking_attempt=${BOOKING_ATTEMPT_ID}`;
  const match = events.filter((e) => (e.description ?? "").includes(needle));

  if (!match.length) {
    console.log(
      JSON.stringify(
        {
          found: false,
          bookingAttemptId: BOOKING_ATTEMPT_ID,
          scannedEvents: events.length,
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
        },
        null,
        2,
      ),
    );
    process.exit(2);
  }

  for (const e of match) {
    const plain = (e.description ?? "").replace(/<[^>]+>/g, " ");
    const labeled = extractTransovoLabeledIdentity(plain);
    const nameFromSubject = e.summary?.includes(" — ")
      ? e.summary.split(" — ").slice(1).join(" — ").trim()
      : e.summary;
    console.log(
      JSON.stringify(
        {
          found: true,
          bookingAttemptId: BOOKING_ATTEMPT_ID,
          providerEventId: e.id,
          subject: e.summary,
          customerNameFromSubject: nameFromSubject,
          email: labeled.email,
          phone: labeled.phone,
          start: e.start.toISOString(),
          end: e.end.toISOString(),
          descriptionPlain: plain.trim(),
        },
        null,
        2,
      ),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
