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
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const prisma = getPrisma();

  const allTelnyx = await prisma.providerWebhookEvent.count({
    where: { provider: "telnyx", createdAt: { gte: since } },
  });
  const callEvents = await prisma.providerWebhookEvent.count({
    where: {
      provider: "telnyx",
      createdAt: { gte: since },
      eventType: { startsWith: "call." },
    },
  });
  console.log("Telnyx webhooks 24h:", allTelnyx, "call.*:", callEvents);

  const recent = await prisma.providerWebhookEvent.findMany({
    where: { provider: "telnyx", createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { createdAt: true, eventType: true, status: true, errorMessage: true },
  });
  console.log("\nLatest telnyx webhooks:");
  for (const r of recent) console.log(" ", r.createdAt.toISOString(), r.eventType, r.status, r.errorMessage || "");

  const missed = await prisma.missedCallEvent.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      createdAt: true,
      callerE164: true,
      businessE164: true,
      status: true,
      suppressionReason: true,
      metadata: true,
    },
  });
  console.log("\nMissed calls 24h:");
  for (const m of missed) {
    const meta = (m.metadata || {}) as Record<string, unknown>;
    console.log(
      " ",
      m.createdAt.toISOString(),
      m.callerE164,
      "→",
      m.businessE164,
      m.status,
      m.suppressionReason || "",
      meta.path || meta.captureMode || "",
    );
  }

  const voice = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/detail_records", {
    query: {
      "filter[record_type]": "call-control",
      "filter[cld]": "+15714073615",
      "page[size]": 3,
    },
  });
  console.log("\nLatest call-control legs (full):");
  for (const r of voice.data || []) {
    console.log(JSON.stringify(r, null, 2));
  }
}

main().catch(console.error);
