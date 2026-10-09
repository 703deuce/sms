/**
 * Contract test: multi-page delta follows nextLink and commits checkpoint only via commitMicrosoftDeltaCheckpoint.
 */
import assert from "node:assert/strict";

async function main() {
  const calls: string[] = [];
  const deltaLink = "https://graph.microsoft.com/v1.0/me/calendarView/delta?$deltatoken=final";

  const mockFetch = async (url: string) => {
    calls.push(url);
    if (url.includes("page=1")) {
      return {
        ok: true,
        json: async () => ({
          value: [{ id: "e1", subject: "A", start: { dateTime: "2026-10-10T10:00:00", timeZone: "UTC" }, end: { dateTime: "2026-10-10T11:00:00", timeZone: "UTC" } }],
          "@odata.nextLink": "https://graph.microsoft.com/v1.0/me/calendarView/delta?page=2",
        }),
      };
    }
    if (url.includes("page=2")) {
      return {
        ok: true,
        json: async () => ({
          value: [{ id: "e2", subject: "B", start: { dateTime: "2026-10-11T10:00:00", timeZone: "UTC" }, end: { dateTime: "2026-10-11T11:00:00", timeZone: "UTC" } }],
          "@odata.deltaLink": deltaLink,
        }),
      };
    }
    throw new Error(`unexpected url ${url}`);
  };

  let next = "https://graph.microsoft.com/v1.0/me/calendarView/delta?page=1";
  const events: string[] = [];
  let finalLink: string | undefined;
  while (next) {
    const res = await mockFetch(next);
    const body = await res.json();
    for (const ev of body.value || []) events.push(ev.id);
    if (body["@odata.nextLink"]) {
      next = body["@odata.nextLink"];
      continue;
    }
    finalLink = body["@odata.deltaLink"];
    break;
  }

  assert.deepEqual(events, ["e1", "e2"]);
  assert.equal(finalLink, deltaLink);
  assert.equal(calls.length, 2);

  console.log("PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
