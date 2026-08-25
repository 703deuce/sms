/**
 * SMS webhook auth + outbound record (no PSTN).
 * Usage:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-call-forwarding-sms-pipeline.ts
 */
import { randomBytes } from "crypto";
import { getPrisma } from "../src/lib/db";
import { tryHandleCallForwardingSms } from "../src/lib/call-forwarding/sms-outbound";
import { upsertCallForwardingAuthorizedCaller } from "../src/lib/call-forwarding/authorized-callers";
import { updateCallForwardingWorkspaceSettings } from "../src/lib/call-forwarding/workspace-settings";

const DEST = "+17035551212";
const EMPLOYEE = "+17035559998";
const CONTROL = "+14155550100";

async function main() {
  const prisma = getPrisma();
  const suffix = randomBytes(4).toString("hex");
  const workspace = await prisma.workspace.create({
    data: { name: `CF Pipe ${suffix}`, slug: `cf-pipe-${suffix}`, type: "BUSINESS" },
  });

  await prisma.workspaceProductFeature.create({
    data: { workspaceId: workspace.id, featureKey: "CALL_FORWARDING", status: "ACTIVE" },
  });

  const pn = await prisma.phoneNumber.create({
    data: {
      workspaceId: workspace.id,
      e164: CONTROL,
      type: "Local",
      provider: "telnyx",
      providerNumberId: `test-${suffix}`,
      status: "Active",
      settingsJson: { callHandlingMode: "call_forwarding" },
    },
  });

  await updateCallForwardingWorkspaceSettings(workspace.id, {
    assignedPhoneNumberId: pn.id,
    businessNumberE164: CONTROL,
    controlPhoneNumberId: pn.id,
    controlNumberE164: CONTROL,
    smsOutboundEnabled: true,
  });

  const caller = await upsertCallForwardingAuthorizedCaller({
    workspaceId: workspace.id,
    name: "Test",
    phoneE164: EMPLOYEE,
  });

  const bad = await tryHandleCallForwardingSms({
    workspaceId: workspace.id,
    toE164: CONTROL,
    fromE164: "+19998887777",
    body: "7035551212",
  });
  if (!bad.handled) throw new Error("unauthorized should be handled silently");
  const badCount = await prisma.callForwardingOutboundCall.count({ where: { workspaceId: workspace.id } });
  if (badCount > 0) throw new Error("unauthorized created outbound");
  console.log("PASS: unauthorized → no outbound");

  await tryHandleCallForwardingSms({
    workspaceId: workspace.id,
    toE164: CONTROL,
    fromE164: EMPLOYEE,
    body: "7035551212",
  });

  const outbound = await prisma.callForwardingOutboundCall.findFirst({
    where: { workspaceId: workspace.id, authorizedCallerId: caller.id },
    orderBy: { createdAt: "desc" },
  });
  if (!outbound || outbound.destinationE164 !== DEST) throw new Error("outbound record wrong");
  if (outbound.customerCallControlId) throw new Error("customer leg before Press 1");
  console.log("PASS: authorized SMS → outbound, no customer leg");

  await prisma.callForwardingOutboundCall.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.callForwardingAuthorizedCaller.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.callForwardingWorkspaceSettings.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.phoneNumber.delete({ where: { id: pn.id } });
  await prisma.workspaceProductFeature.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.workspace.delete({ where: { id: workspace.id } });

  console.log("test:call-forwarding-sms-pipeline ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
