#!/usr/bin/env npx tsx
import { callMicrosoftGraph, getValidAccessToken } from "@/lib/calendar/providers";
import { resolveVoiceV3AgentConfigForAgent } from "@/lib/voice-v3/config/from-published-agent";
import { resolveVoiceV3MicrosoftCalendar } from "@/lib/voice-v3/calendar/microsoft/resolve-voice-v3-microsoft-calendar";
import { microsoftCalendarViewUrl } from "@/lib/microsoft/graph-helpers";

const BOOKING_ATTEMPT_ID =
  process.env.BOOKING_ATTEMPT_ID?.trim() || "bka_cmual7tho3r3a1h5p111n215l";

async function main() {
  const config = await resolveVoiceV3AgentConfigForAgent({
    workspaceId: "ws_1",
    agentId: "cmshz2lc25c622c4i58303501",
  });
  const ms = await resolveVoiceV3MicrosoftCalendar(config);
  if (!ms.ok) throw new Error(ms.message);
  const token = await getValidAccessToken(ms.connectionId, "microsoft", ms.calendarConfig);
  const url = new URL(microsoftCalendarViewUrl(undefined));
  url.searchParams.set("startDateTime", "2026-09-21T00:00:00.000Z");
  url.searchParams.set("endDateTime", "2026-09-22T00:00:00.000Z");
  url.searchParams.set("$select", "id,subject,body,bodyPreview,start,end,transactionId");
  url.searchParams.set("$top", "50");
  const res = await callMicrosoftGraph(token, url.toString(), {}, {
    connectionId: ms.connectionId,
    config: ms.calendarConfig,
  });
  if (!res.ok) throw new Error(`calendarView ${res.status} ${await res.text()}`);
  const data = (await res.json()) as {
    value: Array<{
      id: string;
      subject?: string;
      body?: { content?: string };
      bodyPreview?: string;
      start?: { dateTime?: string; timeZone?: string };
      end?: { dateTime?: string; timeZone?: string };
      transactionId?: string;
    }>;
  };
  const ev = data.value.find((v) => v.transactionId === BOOKING_ATTEMPT_ID);
  if (!ev) {
    console.log(JSON.stringify({ found: false, bookingAttemptId: BOOKING_ATTEMPT_ID }, null, 2));
    process.exit(2);
  }
  const body = ev.body?.content ?? ev.bodyPreview ?? "";
  const plain = String(body).replace(/<[^>]+>/g, "\n").replace(/&nbsp;/g, " ").trim();
  console.log(
    JSON.stringify(
      {
        found: true,
        providerEventId: ev.id,
        subject: ev.subject,
        start: ev.start,
        end: ev.end,
        transactionId: ev.transactionId,
        bodyPlain: plain,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
