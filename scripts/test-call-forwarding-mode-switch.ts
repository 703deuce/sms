/**
 * API mode switching: CF → SR → CF preserves configs.
 * Usage:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-call-forwarding-mode-switch.ts
 */
import { randomBytes } from "crypto";
import { getPrisma } from "../src/lib/db";
import {
  setCallHandlingMode,
} from "../src/lib/numbers/call-handling-mode";
import { readCallHandlingMode } from "../src/lib/numbers/call-handling-mode-shared";
import { readPersonalCallSettings } from "../src/lib/numbers/personal-call-settings";
import { applyPersonalCallSettingsToRow } from "../src/lib/numbers/state-service";

async function main() {
  const prisma = getPrisma();
  const suffix = randomBytes(4).toString("hex");
  const workspace = await prisma.workspace.create({
    data: { name: `CF Mode ${suffix}`, slug: `cf-mode-${suffix}`, type: "BUSINESS" },
  });

  await prisma.workspaceProductFeature.create({
    data: { workspaceId: workspace.id, featureKey: "CALL_FORWARDING", status: "ACTIVE" },
  });
  await prisma.workspaceProductFeature.create({
    data: { workspaceId: workspace.id, featureKey: "SMART_ROUTING", status: "ACTIVE" },
  });

  const e164 = `+1415555${String(Math.floor(Math.random() * 9000) + 1000)}`;
  const applied = applyPersonalCallSettingsToRow(
    {
      e164,
      voiceForwardTo: null,
      settingsJson: {},
    },
    {
      forwardingEnabled: true,
      forwardDestination: "+17035551212",
      incomingCallHandling: "forward",
    },
  );

  const pn = await prisma.phoneNumber.create({
    data: {
      workspaceId: workspace.id,
      e164,
      type: "Local",
      provider: "telnyx",
      providerNumberId: `test-${suffix}`,
      status: "Active",
      voiceForwardTo: applied.voiceForwardTo,
      settingsJson: applied.settingsJson,
    },
  });

  await setCallHandlingMode(workspace.id, pn.id, "call_forwarding");
  let row = await prisma.phoneNumber.findUnique({ where: { id: pn.id } });
  if (readCallHandlingMode(row!.settingsJson) !== "call_forwarding") {
    throw new Error("expected call_forwarding mode");
  }

  const flow = await prisma.smartRoutingFlow.create({
    data: {
      workspaceId: workspace.id,
      name: "Test tree",
      type: "phone_menu",
      status: "active",
      assignedPhoneNumberId: pn.id,
      routingNumberE164: e164,
    },
  });

  await setCallHandlingMode(workspace.id, pn.id, "smart_routing");
  row = await prisma.phoneNumber.findUnique({ where: { id: pn.id } });
  if (readCallHandlingMode(row!.settingsJson) !== "smart_routing") {
    throw new Error("expected smart_routing mode");
  }
  const fwdAfterSr = readPersonalCallSettings(row!);
  if (!fwdAfterSr.forwardTargets.includes("+17035551212")) {
    throw new Error("forward destination lost after SR switch");
  }

  await setCallHandlingMode(workspace.id, pn.id, "call_forwarding");
  row = await prisma.phoneNumber.findUnique({ where: { id: pn.id } });
  if (readCallHandlingMode(row!.settingsJson) !== "call_forwarding") {
    throw new Error("expected call_forwarding mode after switch back");
  }
  const flowStill = await prisma.smartRoutingFlow.findUnique({ where: { id: flow.id } });
  if (!flowStill) throw new Error("smart routing flow deleted");

  await prisma.smartRoutingFlow.delete({ where: { id: flow.id } });
  await prisma.phoneNumber.delete({ where: { id: pn.id } });
  await prisma.workspaceProductFeature.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.workspace.delete({ where: { id: workspace.id } });

  console.log("test:call-forwarding-mode-switch ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
