#!/usr/bin/env npx tsx
import { getPrisma } from "../src/lib/db";
import { getMicrosoftCalendarCapabilities } from "../src/lib/microsoft/calendar-capabilities";

const STALE_ID = process.env.CALENDAR_ID || "cmu1qrrsw0i270x0a2o030k61";
const NEW_ID = process.env.NEW_CONN_ID || "cmu1uq7f15s1o5s4f6c5b6a57";

async function main() {
  const prisma = getPrisma();
  for (const id of [STALE_ID, NEW_ID]) {
    const row = await prisma.voiceCalendarConnection.findFirst({
      where: { id, workspaceId: "ws_1" },
    });
    console.log("\nConnection", id, row ? { status: row.status, name: row.name, updatedAt: row.updatedAt } : "NOT FOUND");
    const caps = await getMicrosoftCalendarCapabilities("ws_1", { calendarConnectionId: id });
    console.log("capabilities:", caps);
  }
}

main().catch(console.error);
