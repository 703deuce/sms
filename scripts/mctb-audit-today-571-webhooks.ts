#!/usr/bin/env npx tsx
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { join } from "node:path";

for (const file of [".env.local", ".env"]) {
  const p = join(process.cwd(), file);
  if (existsSync(p)) config({ path: p });
}

import { getPrisma } from "@/lib/db";

function extract(payload: unknown) {
  const root = (payload || {}) as Record<string, unknown>;
  const data = (root.data || root) as Record<string, unknown>;
  const ep = (data.payload || root.eventPayload || data) as Record<string, unknown>;
  return {
    to: ep.to || ep.To || ep.destination_number,
    from: ep.from || ep.From,
    conn: ep.connection_id || ep.ConnectionId,
    callStatus: ep.texml_call_status || ep.CallStatus,
    hangup: ep.hangup_cause,
  };
}

async function main() {
  const prisma = getPrisma();
  const since = new Date("2026-08-28T00:00:00Z");
  const events = await prisma.providerWebhookEvent.findMany({
    where: { provider: "telnyx", createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true, eventType: true, status: true, payload: true },
  });

  console.log(`\nToday telnyx webhooks: ${events.length}\n`);
  for (const w of events) {
    const meta = extract(w.payload);
    const relevant =
      String(w.eventType).startsWith("texml") ||
      String(meta.to || "").includes("5714073615") ||
      String(meta.from || "").includes("5714073615");
    if (!relevant) continue;
    console.log(
      JSON.stringify({
        at: w.createdAt.toISOString(),
        type: w.eventType,
        status: w.status,
        ...meta,
      }),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
