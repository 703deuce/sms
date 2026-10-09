import { getPrisma } from "@/lib/db";
import {
  getValidAccessToken,
  listMicrosoftCalendarEvents,
  type CalendarConfig,
} from "@/lib/calendar/providers";
import { isEventEligibleForReminderImport, mergeImportRules } from "@/lib/calendar/eligibility";
import { processCalendarProviderEvent } from "@/lib/calendar/import-sync";

const ws = process.env.WORKSPACE_ID || "ws_1";
const connId = process.env.CONNECTION_ID || "cmu1uq7f15s1o5s4f6c5b6a57";

async function main() {
  const prisma = getPrisma();
  const conn = await prisma.voiceCalendarConnection.findFirst({
    where: { id: connId, workspaceId: ws },
  });
  if (!conn) throw new Error("connection not found");
  const config = (conn.config || {}) as CalendarConfig;
  const calId = config.importCalendarIds?.[0];
  if (!calId) throw new Error("no import calendar");

  const token = await getValidAccessToken(conn.id, "microsoft", config);
  if (!token) throw new Error("no token");

  const timeMin = new Date();
  timeMin.setDate(timeMin.getDate() - 1);
  const timeMax = new Date();
  timeMax.setDate(timeMax.getDate() + 30);

  const events = await listMicrosoftCalendarEvents(token, timeMin, timeMax, calId, {
    connectionId: conn.id,
    config,
  });
  events.sort((a, b) => a.start.getTime() - b.start.getTime());

  const rules = mergeImportRules(config);
  console.log(`events in window: ${events.length} (${timeMin.toISOString()} .. ${timeMax.toISOString()})`);

  for (const event of events.slice(-25)) {
    const elig = isEventEligibleForReminderImport(event, rules, config.email);
    const { result, reason } = await processCalendarProviderEvent({
      workspaceId: ws,
      connectionId: connId,
      provider: "microsoft",
      event,
      config,
      calendarId: calId,
    }).then((r) => ({ result: r.result, reason: r.reason }));
    console.log(
      event.start.toISOString(),
      JSON.stringify(event.summary || "").slice(0, 40),
      "eligible",
      elig.eligible,
      elig.reason || "",
      "process",
      result,
      reason || "",
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
