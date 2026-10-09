/**
 * Simulated Microsoft subscription renewal scheduler throughput.
 * Usage: npx tsx scripts/test-microsoft-subscription-renew-scale.ts --connections=1000
 */
import assert from "node:assert/strict";
import { getPrisma } from "../src/lib/db";
import { getOrCreateArScaleTestWorkspace } from "./lib/ar-scale-test-workspace";

const count = Number(process.argv.find((a) => a.startsWith("--connections="))?.split("=")[1] || 200);

async function main() {
  const prisma = getPrisma();
  const ws = { id: await getOrCreateArScaleTestWorkspace() };

  const ids: string[] = [];
  const now = Date.now();
  for (let i = 0; i < count; i += 1) {
    const id = `sim-ms-renew-${i}-${now}`;
    ids.push(id);
    await prisma.voiceCalendarConnection.create({
      data: {
        id,
        workspaceId: ws.id,
        name: `Sim renew ${i}`,
        provider: "microsoft",
        status: "connected",
        subscriptionRenewDueAt: new Date(now - 60_000),
        config: {
          syncEnabled: false,
          importCalendarIds: [],
          microsoftSubscription: { expiresAt: new Date(now + 3600_000).toISOString() },
        },
      },
    });
  }

  const started = Date.now();
  const { renewDueMicrosoftCalendarSubscriptions } = await import(
    "../src/lib/calendar/microsoft-subscription-renewal-scheduler"
  );
  let scanned = 0;
  let ticks = 0;
  while (ticks < 30 && scanned < count) {
    const result = await renewDueMicrosoftCalendarSubscriptions({ budget: 100 });
    scanned += result.scanned;
    ticks += 1;
    if (result.scanned === 0) break;
  }
  const elapsedMs = Date.now() - started;

  console.log(
    JSON.stringify({
      connections: count,
      ticks,
      scanned,
      elapsedMs,
      scannedPerSecond: Math.round((scanned / Math.max(elapsedMs, 1)) * 1000),
    }),
  );

  assert.ok(scanned > 0, "expected renewal scan progress");

  await prisma.voiceCalendarConnection.deleteMany({ where: { id: { in: ids } } });
  console.log("PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
