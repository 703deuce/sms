#!/usr/bin/env npx tsx
import { callMicrosoftGraph, getValidAccessToken } from "@/lib/calendar/providers";
import { resolveVoiceV3AgentConfigForAgent } from "@/lib/voice-v3/config/from-published-agent";
import { resolveVoiceV3MicrosoftCalendar } from "@/lib/voice-v3/calendar/microsoft/resolve-voice-v3-microsoft-calendar";
import { microsoftCalendarViewUrl } from "@/lib/microsoft/graph-helpers";

async function tryView(calendarId: string | undefined, label: string) {
  const config = await resolveVoiceV3AgentConfigForAgent({
    workspaceId: "ws_1",
    agentId: "cmshz2lc25c622c4i58303501",
  });
  const ms = await resolveVoiceV3MicrosoftCalendar(config);
  if (!ms.ok) throw new Error(ms.message);
  const token = await getValidAccessToken(ms.connectionId, "microsoft", ms.calendarConfig);
  const url = new URL(microsoftCalendarViewUrl(calendarId));
  url.searchParams.set("startDateTime", "2026-09-21T00:00:00.000Z");
  url.searchParams.set("endDateTime", "2026-09-22T00:00:00.000Z");
  url.searchParams.set("$select", "id,subject,bodyPreview,start,end,transactionId");
  url.searchParams.set("$top", "50");
  const res = await callMicrosoftGraph(token, url.toString(), {}, {
    connectionId: ms.connectionId,
    config: ms.calendarConfig,
  });
  const text = await res.text();
  console.log(
    JSON.stringify({
      label,
      calendarId: calendarId ?? "(default)",
      status: res.status,
      bodySnippet: text.slice(0, 500),
    }),
  );
}

async function main() {
  const config = await resolveVoiceV3AgentConfigForAgent({
    workspaceId: "ws_1",
    agentId: "cmshz2lc25c622c4i58303501",
  });
  const ms = await resolveVoiceV3MicrosoftCalendar(config);
  if (!ms.ok) throw new Error(ms.message);
  console.log("calendarIds:", ms.calendarIds);
  await tryView(undefined, "no-calendar-id");
  await tryView("primary", "primary");
  for (const id of ms.calendarIds) {
    await tryView(id, "configured");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
