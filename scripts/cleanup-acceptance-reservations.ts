/**
 * Expire active acceptance-test reservations so inventory is not held for 30 minutes.
 *
 * Usage:
 *   npx tsx scripts/cleanup-acceptance-reservations.ts
 *   WORKSPACE_ID=... PHONE=+12402077275 npx tsx scripts/cleanup-acceptance-reservations.ts
 */
import dotenv from "dotenv";

dotenv.config();

import { getPrisma } from "../src/lib/db";

const WORKSPACE_ID = process.env.WORKSPACE_ID ?? "cmsu9n9zq3y57165y5c2x3m59";
const PHONE_FILTER = process.env.PHONE?.trim();

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL required for reservation cleanup");
    process.exit(1);
  }

  const prisma = getPrisma();
  const where = {
    workspaceId: WORKSPACE_ID,
    reservationStatus: { in: ["reserved", "reserving"] as string[] },
    ...(PHONE_FILTER ? { phoneNumber: PHONE_FILTER } : {}),
  };

  const active = await prisma.premiumNumberReservation.findMany({
    where,
    select: { id: true, phoneNumber: true, reservationStatus: true, reservationExpiresAt: true },
  });

  if (!active.length) {
    console.log("No active acceptance reservations to clean up.");
    return;
  }

  const now = new Date();
  const updated = await prisma.premiumNumberReservation.updateMany({
    where: { id: { in: active.map((r) => r.id) } },
    data: {
      reservationStatus: "expired",
      reservationExpiresAt: now,
    },
  });

  console.log(`Expired ${updated.count} reservation(s):`);
  for (const row of active) {
    console.log(`  ${row.phoneNumber} (${row.id}) was ${row.reservationStatus}`);
  }
  console.log(
    "Note: Telnyx carrier holds expire on their own timeline; DB status prevents checkout reuse.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
