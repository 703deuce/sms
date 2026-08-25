/**
 * Setup save → reload persistence (API/DB).
 * Usage:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-call-forwarding-setup-persistence.ts
 */
import { randomBytes } from "crypto";
import { getPrisma } from "../src/lib/db";
import { loadCallForwardingSetup, saveCallForwardingSetup } from "../src/lib/call-forwarding/setup-service";
import { readPersonalForwardSchedule } from "../src/lib/numbers/personal-forward-schedule";

async function main() {
  const prisma = getPrisma();
  const suffix = randomBytes(4).toString("hex");
  const workspace = await prisma.workspace.create({
    data: { name: `CF Setup ${suffix}`, slug: `cf-setup-${suffix}`, type: "BUSINESS" },
  });

  await prisma.workspaceProductFeature.create({
    data: { workspaceId: workspace.id, featureKey: "CALL_FORWARDING", status: "ACTIVE" },
  });

  const e164 = `+1415555${String(Math.floor(Math.random() * 9000) + 1000)}`;
  const pn = await prisma.phoneNumber.create({
    data: {
      workspaceId: workspace.id,
      e164,
      type: "Local",
      provider: "telnyx",
      providerNumberId: `test-${suffix}`,
      status: "Active",
      voiceForwardTo: "+17035551212",
      settingsJson: { callHandlingMode: "call_forwarding", routingOwner: "call_forwarding" },
    },
  });

  await saveCallForwardingSetup(workspace.id, {
    phoneNumberId: pn.id,
    destination: "+17035551212",
    callScreeningEnabled: true,
    forwardRingSeconds: 28,
    forwardUnansweredAction: "transovo_voicemail",
  });

  await saveCallForwardingSetup(workspace.id, {
    forwardScheduleMode: "custom",
    forwardSchedule: {
      timezone: "America/New_York",
      blocks: [
        {
          id: "weekdays",
          days: [1, 2, 3, 4, 5],
          startTime: "08:00",
          endTime: "18:00",
          handling: "forward",
          targets: ["+17035551212"],
        },
      ],
      outsideHandling: "voicemail_only",
      outsideTargets: [],
    },
  });

  const loaded = await loadCallForwardingSetup(workspace.id);
  if (!loaded.callSettings?.callScreeningEnabled) throw new Error("screening missing");
  if (loaded.callSettings.forwardRingSeconds !== 28) throw new Error("ring seconds wrong");
  if (loaded.callSettings.forwardScheduleMode !== "custom") throw new Error("schedule mode wrong");

  const row = await prisma.phoneNumber.findUnique({ where: { id: pn.id } });
  const sched = readPersonalForwardSchedule(row!.settingsJson as Record<string, unknown>);
  if (!sched || sched.outsideHandling !== "voicemail_only") throw new Error("schedule wrong");

  await prisma.phoneNumber.delete({ where: { id: pn.id } });
  await prisma.callForwardingWorkspaceSettings.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.workspaceProductFeature.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.workspace.delete({ where: { id: workspace.id } });

  console.log("test:call-forwarding-setup-persistence ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
