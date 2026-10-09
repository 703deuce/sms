/**
 * Trace calendarView/delta bootstrap for one Microsoft connection (production diagnostics).
 * Usage: npx tsx scripts/trace-microsoft-delta-bootstrap.ts [connectionId]
 */
import { getWorkspaceCalendarConnection } from "../src/lib/calendar/connections";
import {
  callMicrosoftGraph,
  getValidAccessToken,
  type CalendarConfig,
} from "../src/lib/calendar/providers";
import { resolveMicrosoftCalendarViewSyncWindow } from "../src/lib/calendar/microsoft-sync-window";
import {
  GRAPH_PREFER_OUTLOOK_UTC,
  microsoftCalendarViewDeltaUrl,
  microsoftCalendarViewUrl,
  parseMicrosoftGraphError,
} from "../src/lib/microsoft/graph-helpers";

const workspaceId = process.env.WORKSPACE_ID || "ws_1";
const connectionId = process.argv[2] || "cmu1uq7f15s1o5s4f6c5b6a57";

async function probe(label: string, url: URL, token: string, ctx: { connectionId: string; config: CalendarConfig }) {
  const res = await callMicrosoftGraph(token, url.toString(), {
    headers: { Prefer: GRAPH_PREFER_OUTLOOK_UTC },
  }, ctx);
  const err = res.ok ? null : await parseMicrosoftGraphError(res);
  console.log(
    JSON.stringify({
      label,
      url: url.toString().replace(/Bearer.*/, "[redacted]"),
      status: res.status,
      ok: res.ok,
      graphCode: err?.graphCode,
      graphMessage: err?.graphMessage,
      requestId: err?.requestId,
    }, null, 2),
  );
  if (res.ok) {
    const json = await res.json() as {
      value?: unknown[];
      "@odata.nextLink"?: string;
      "@odata.deltaLink"?: string;
    };
    console.log(
      JSON.stringify({
        label: `${label}:body`,
        valueCount: json.value?.length ?? 0,
        hasNextLink: Boolean(json["@odata.nextLink"]),
        hasDeltaLink: Boolean(json["@odata.deltaLink"]),
        deltaLinkPrefix: json["@odata.deltaLink"]?.slice(0, 120),
      }, null, 2),
    );
  }
}

async function main() {
  const conn = await getWorkspaceCalendarConnection(workspaceId, connectionId);
  if (!conn) throw new Error("Connection not found");
  const config = (conn.config || {}) as CalendarConfig;
  const calendarId = (config.importCalendarIds || [])[0];
  if (!calendarId) throw new Error("No importCalendarIds");

  const token = await getValidAccessToken(connectionId, "microsoft", config);
  if (!token) throw new Error("No token");

  const { timeMin, timeMax } = resolveMicrosoftCalendarViewSyncWindow(config);
  const ctx = { connectionId, config };

  console.log(JSON.stringify({
    connectionId,
    calendarIdLength: calendarId.length,
    calendarIdSuffix: calendarId.slice(-8),
    windowStart: timeMin.toISOString(),
    windowEnd: timeMax.toISOString(),
    windowDays: Math.round((timeMax.getTime() - timeMin.getTime()) / 86400000),
  }, null, 2));

  const deltaUrlForbidden = new URL(microsoftCalendarViewDeltaUrl(calendarId));
  deltaUrlForbidden.searchParams.set("startDateTime", timeMin.toISOString());
  deltaUrlForbidden.searchParams.set("endDateTime", timeMax.toISOString());
  deltaUrlForbidden.searchParams.set("$top", "250");
  await probe("delta_with_top_forbidden", deltaUrlForbidden, token, ctx);

  const deltaNoTop = new URL(microsoftCalendarViewDeltaUrl(calendarId));
  deltaNoTop.searchParams.set("startDateTime", timeMin.toISOString());
  deltaNoTop.searchParams.set("endDateTime", timeMax.toISOString());
  await probe("delta_no_top", deltaNoTop, token, ctx);

  const viewUrl = new URL(microsoftCalendarViewUrl(calendarId));
  viewUrl.searchParams.set("startDateTime", timeMin.toISOString());
  viewUrl.searchParams.set("endDateTime", timeMax.toISOString());
  viewUrl.searchParams.set("$top", "250");
  await probe("calendarView", viewUrl, token, ctx);

  const defaultCalDelta = new URL(microsoftCalendarViewDeltaUrl());
  defaultCalDelta.searchParams.set("startDateTime", timeMin.toISOString());
  defaultCalDelta.searchParams.set("endDateTime", timeMax.toISOString());
  await probe("default_calendar_delta", defaultCalDelta, token, ctx);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
