/**
 * Simulated Microsoft reconcile discovery — no real Graph calls.
 * Usage: npx tsx scripts/test-microsoft-reconcile-scale.ts --connections 1000
 */
import assert from "node:assert/strict";
import { getPrisma } from "../src/lib/db";
import { getOrCreateArScaleTestWorkspace } from "./lib/ar-scale-test-workspace";

const count = Number(process.argv.find((a) => a.startsWith("--connections="))?.split("=")[1] || 100);

async function main() {
  const prisma = getPrisma();
  const ws = { id: await getOrCreateArScaleTestWorkspace() };

  const ids: string[] = [];
  const now = Date.now();
  for (let i = 0; i < count; i += 1) {
    const id = `sim-ms-conn-${i}-${Date.now()}`;
    ids.push(id);
    await prisma.voiceCalendarConnection.create({
      data: {
        id,
        workspaceId: ws.id,
        name: `Sim Microsoft ${i}`,
        provider: "microsoft",
        status: "connected",
        nextSyncDueAt: new Date(now - 60_000),
        config: {
          syncEnabled: true,
          importCalendarIds: ["primary"],
        },
      },
    });
  }

  const started = Date.now();
  const { discoverAndEnqueueMicrosoftCalendarSyncs } = await import(
    "../src/lib/calendar/microsoft-reconcile-discovery"
  );
  let totalEnqueued = 0;
  let ticks = 0;
  while (ticks < 50 && totalEnqueued < count) {
    const result = await discoverAndEnqueueMicrosoftCalendarSyncs({
      budget: 500,
      dryRun: true,
      workspaceId: ws.id,
    });
    totalEnqueued += result.enqueued;
    ticks += 1;
    if (result.enqueued === 0) break;
  }
  const elapsedMs = Date.now() - started;

  console.log(
    JSON.stringify({
      connections: count,
      ticks,
      totalEnqueued,
      elapsedMs,
      enqueuedPerSecond: Math.round((totalEnqueued / elapsedMs) * 1000),
    }),
  );

  assert.ok(totalEnqueued >= Math.min(count, 500 * ticks), "expected discovery enqueue coverage");
  assert.ok(totalEnqueued >= count * 0.95, `expected ~all connections discovered: ${totalEnqueued}/${count}`);

  await prisma.voiceCalendarConnection.deleteMany({ where: { id: { in: ids } } }).catch(() => undefined);

  console.log("PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
