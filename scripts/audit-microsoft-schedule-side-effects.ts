/**
 * Audit Microsoft connection scheduling for scale-test contamination or dry-run damage.
 * Usage: npx tsx scripts/audit-microsoft-schedule-side-effects.ts
 */
import { getPrisma } from "../src/lib/db";
import { isSimMicrosoftConnectionId } from "./lib/ar-scale-test-workspace";

async function main() {
  const prisma = getPrisma();
  const now = Date.now();
  const leaseHorizonMs = 15 * 60_000;

  const simRows = await prisma.voiceCalendarConnection.findMany({
    where: {
      provider: "microsoft",
      id: { startsWith: "sim-ms-" },
    },
    select: { id: true, workspaceId: true, nextSyncDueAt: true },
    take: 20,
  });

  const suspicious = await prisma.voiceCalendarConnection.findMany({
    where: {
      provider: "microsoft",
      status: { in: ["connected", "needs_reauth"] },
      NOT: { id: { startsWith: "sim-ms-" } },
      nextSyncDueAt: { gt: new Date(now + leaseHorizonMs) },
    },
    select: {
      id: true,
      workspaceId: true,
      nextSyncDueAt: true,
      lastSyncAt: true,
      name: true,
    },
    take: 50,
  });

  console.log(
    JSON.stringify(
      {
        simConnectionRowsRemaining: simRows.length,
        simSample: simRows.slice(0, 5).map((r) => r.id),
        nonSimWithFarFutureNextSyncDueAt: suspicious.length,
        suspiciousSample: suspicious.slice(0, 10),
        note:
          "Far-future nextSyncDueAt on non-sim rows may be normal enqueue leases; investigate if lastSyncAt is stale.",
      },
      null,
      2,
    ),
  );

  if (simRows.length) {
    console.warn("WARN: sim-ms-* connections still present — run cleanup");
  }

  const orphanSim = simRows.filter((r) => isSimMicrosoftConnectionId(r.id));
  if (orphanSim.length) {
    await prisma.voiceCalendarConnection.deleteMany({
      where: { id: { in: orphanSim.map((r) => r.id) } },
    }).catch(() => undefined);
    console.log(`Cleaned ${orphanSim.length} sim-ms-* connections`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
