#!/usr/bin/env npx tsx
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { join } from "node:path";

for (const file of [".env.local", ".env"]) {
  const p = join(process.cwd(), file);
  if (existsSync(p)) config({ path: p });
}

import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";

async function main() {
  const prisma = getPrisma();

  const counts = await prisma.providerWebhookEvent.groupBy({
    by: ["eventType"],
    where: { provider: "telnyx", eventType: { startsWith: "call." } },
    _count: true,
    orderBy: { _count: { eventType: "desc" } },
    take: 20,
  });
  console.log("\nAll-time call.* webhook counts:");
  for (const row of counts) console.log(`  ${row.eventType}: ${row._count}`);

  const recent = await prisma.providerWebhookEvent.findMany({
    where: { provider: "telnyx", eventType: "call.initiated" },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { createdAt: true, status: true, errorMessage: true, payload: true },
  });
  console.log("\nLatest call.initiated webhooks:");
  for (const w of recent) {
    const root = (w.payload || {}) as Record<string, unknown>;
    const ep = (root.eventPayload || root) as Record<string, unknown>;
    console.log(
      JSON.stringify({
        at: w.createdAt.toISOString(),
        status: w.status,
        error: w.errorMessage,
        to: ep.to,
        from: ep.from,
        conn: ep.connection_id,
      }),
    );
  }

  const res = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/detail_records", {
    query: {
      "filter[record_type]": "call-control",
      "filter[cld]": "+15714073615",
      "page[size]": 100,
    },
  });
  const connected = (res.data || []).filter((r) => Number(r.call_sec) > 0);
  console.log(`\n571 call-control CDR: ${(res.data || []).length} total, ${connected.length} connected`);
  for (const r of connected.slice(0, 8)) {
    console.log(
      JSON.stringify({
        at: r.started_at,
        sec: r.call_sec,
        conn: r.connection_name,
        from: r.cli,
        hangup: r.hangup_cause,
      }),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
