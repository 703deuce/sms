/**
 * Read-only: recent outbound to a cert phone across mass, AR, reviews.
 *   CERT_PHONE=+15714776175 npx tsx scripts/prod-diagnose-phone-sends.ts
 */
import { getPrisma } from "../src/lib/db";

const phone = process.env.CERT_PHONE?.trim() || "+15714776175";
const digits = phone.replace(/\D/g, "").slice(-10);
const since = new Date(Date.now() - 72 * 3600 * 1000);

async function main() {
  const prisma = getPrisma();

  const messages = await prisma.message.findMany({
    where: {
      createdAt: { gte: since },
      OR: [{ to: { contains: digits } }, { to: phone }],
    },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      to: true,
      from: true,
      status: true,
      campaignId: true,
      body: true,
      createdAt: true,
      providerMessageId: true,
      workspaceId: true,
    },
  });

  console.log("\n=== Message rows (last 72h) ===");
  for (const m of messages) {
    console.log({
      at: m.createdAt.toISOString(),
      to: m.to,
      from: m.from,
      status: m.status,
      campaignId: m.campaignId,
      ws: m.workspaceId,
      body: m.body?.slice(0, 70),
      pid: m.providerMessageId,
    });
  }

  const campaigns = await prisma.campaign.findMany({
    where: { name: { contains: "Mass text", mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, name: true, status: true, workspaceId: true, createdAt: true },
  });
  console.log("\n=== Mass campaigns (name ~ Mass text) ===");
  console.log(campaigns);

  const arDispatches = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      status: string;
      intended_fire_at: Date;
      timeline_type: string;
      to_e164: string | null;
      last_error: string | null;
    }>
  >(
    `SELECT id, status, "intendedFireAt" as intended_fire_at, "timelineType" as timeline_type,
            "toE164" as to_e164, "lastError" as last_error
     FROM ar_reminder_dispatches
     WHERE ("toE164" LIKE $1 OR "toE164" LIKE $2)
       AND "createdAt" >= $3
     ORDER BY "createdAt" DESC LIMIT 20`,
    `%${digits}%`,
    `%${phone}%`,
    since,
  ).catch(() => []);

  console.log("\n=== AR reminder dispatches ===");
  console.log(arDispatches);

  const reviewSends = await prisma.$queryRawUnsafe<
    Array<{ id: string; status: string; phone: string; created_at: Date }>
  >(
    `SELECT id, status, customer_phone as phone, created_at
     FROM review_request_sends
     WHERE customer_phone LIKE $1 AND created_at >= $2
     ORDER BY created_at DESC LIMIT 15`,
    `%${digits}%`,
    since,
  ).catch(() => []);

  console.log("\n=== Review request sends ===");
  console.log(reviewSends);

  const appts = await prisma.voiceAppointment.findMany({
    where: {
      workspaceId: "ws_1",
      startsAt: { gte: since },
    },
    orderBy: { startsAt: "desc" },
    take: 15,
    select: { id: true, serviceName: true, startsAt: true, status: true, metadata: true },
  });
  console.log("\n=== Recent voice appointments (ws_1) ===");
  for (const a of appts) {
    const meta = a.metadata as Record<string, unknown> | null;
    console.log({
      id: a.id,
      service: a.serviceName,
      startsAt: a.startsAt.toISOString(),
      status: a.status,
      customerPhone: meta?.customerPhone ?? meta?.phone ?? meta?.attendeePhone,
      customerName: meta?.customerName ?? meta?.attendeeName,
    });
  }

  const allDisp = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      status: string;
      timeline_type: string;
      intended_fire_at: Date;
      to_e164: string | null;
      last_error: string | null;
      appointment_id: string;
    }>
  >(
    `SELECT id, status, "timelineType" as timeline_type, "intendedFireAt" as intended_fire_at,
            "toE164" as to_e164, "lastError" as last_error, "appointmentId" as appointment_id
     FROM ar_reminder_dispatches
     WHERE "workspaceId" = 'ws_1' AND "createdAt" >= $1
     ORDER BY "createdAt" DESC LIMIT 25`,
    since,
  );

  console.log("\n=== All AR dispatches ws_1 (72h) ===");
  console.log(allDisp);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
