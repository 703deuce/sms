/**
 * Round-trip AR reminder sequence config (save → reload) without HTTP.
 * Requires DATABASE_URL and a writable test workspace (creates ephemeral workspace).
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-ar-reminder-sequence-persist.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  loadAppointmentPlatformConfig,
  saveAppointmentPlatformConfig,
} from "../src/lib/appointments/settings";
import { getPrisma } from "../src/lib/db";

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.log("SKIP test-ar-reminder-sequence-persist — DATABASE_URL not set");
    return;
  }

  const prisma = getPrisma();
  const workspaceId = `ws_ar_persist_${randomUUID().slice(0, 8)}`;
  await prisma.workspace.create({
    data: {
      id: workspaceId,
      name: "AR persist test",
      slug: `ar-persist-${randomUUID().slice(0, 8)}`,
    },
  });

  try {
    const marker = `persist-marker-${Date.now()}`;
    await saveAppointmentPlatformConfig(workspaceId, {
      reminders: {
        reminder24h: {
          enabled: true,
          channel: "sms",
          minutesBefore: 1440,
          label: marker,
          template: "Hi {{first_name}}, reminder: {{appointment_time}}",
        },
      },
    });

    const reloaded = await loadAppointmentPlatformConfig(workspaceId);
    assert.equal(reloaded.reminders.reminder24h.label, marker);
    assert.equal(reloaded.reminders.reminder24h.enabled, true);

    const setup = await prisma.solutionSetup.findFirst({
      where: { workspaceId, solutionType: "appointments-platform" },
    });
    assert.ok(setup?.configJson, "solutionSetup row persisted");

    console.log("PASS test-ar-reminder-sequence-persist");
  } finally {
    await prisma.solutionSetup.deleteMany({ where: { workspaceId } });
    await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => undefined);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
