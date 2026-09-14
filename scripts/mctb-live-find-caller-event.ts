#!/usr/bin/env npx tsx
import { getPrisma } from "@/lib/db";

const raw = process.argv[2] || process.env.CUSTOMER_PHONE || "5714776175";
const digits = raw.replace(/\D/g, "");
const e164 = digits.length === 10 ? `+1${digits}` : `+${digits}`;

async function main() {
  const prisma = getPrisma();
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const events = await prisma.missedCallEvent.findMany({
    where: { callerE164: e164, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true,
      workspaceId: true,
      status: true,
      smsSentAt: true,
      createdAt: true,
      callerE164: true,
      traceId: true,
      suppressionReason: true,
    },
  });
  console.log("caller", e164);
  console.log(JSON.stringify(events, null, 2));

  const consent = await prisma.smartRoutingSmsConsentEvent.findMany({
    where: { callerNumber: e164 },
    orderBy: { consentedAt: "desc" },
    take: 5,
  });
  console.log("\nconsent events:", JSON.stringify(consent, null, 2));
}

main();
