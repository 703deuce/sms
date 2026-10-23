import assert from "node:assert/strict";
import { applyInboundCrmFieldsToContact, lockContactFieldForUserEdit } from "../lib/server/crm/native/sync-field-apply";
import { assertOutboundDialAllowed } from "../lib/server/crm/native/dial-gates";
import { listDialCandidates } from "../lib/server/crm/native/phone-fallthrough";
import { getPrisma } from "../lib/server/db";

async function main() {
  const candidates = listDialCandidates(
    {
      id: "c1",
      phone: "+13125550100",
      status: "SUBSCRIBED",
      timezone: null,
      customFields: { alt_phone: "+13125550101" },
      phones: [
        { id: "p1", e164: "+13125550102", priority: 0, isPreferred: true, outcome: null },
        { id: "p2", e164: "+13125550103", priority: 1, isPreferred: false, outcome: "no_answer" },
      ],
    },
    ["phones", "phone", "alt_phone"],
  );
  assert.equal(candidates[0].e164, "+13125550102");
  assert.equal(candidates[0].phoneId, "p1");
  assert.ok(candidates.some((c) => c.field === "alt_phone"));

  if (!process.env.DATABASE_URL) {
    console.log("test-crm-native-b2: skip DB integration (no DATABASE_URL)");
    console.log("test-crm-native-b2: PASS");
    return;
  }

  const prisma = getPrisma();
  const ws = await prisma.workspace.findFirst({ select: { id: true } });
  assert.ok(ws?.id, "need a workspace on scratch DB");
  const workspaceId = ws.id;
  const phone = `+1312555${String(Date.now()).slice(-4)}`;
  const contact = await prisma.contact.create({
    data: { workspaceId, phone, firstName: "B2", email: "locked@example.com" },
  });
  await lockContactFieldForUserEdit({ workspaceId, contactId: contact.id, fieldKey: "email" });
  const r1 = await applyInboundCrmFieldsToContact({
    workspaceId,
    contactId: contact.id,
    provider: "salesforce",
    updates: [{ fieldKey: "email", value: "crm@example.com" }, { fieldKey: "title", value: "VP" }],
  });
  assert.ok(r1.skipped.some((s) => s.fieldKey === "email" && s.reason === "user_lock"));
  assert.ok(r1.applied.includes("title"));
  const after = await prisma.contact.findUnique({ where: { id: contact.id } });
  assert.equal(after?.email, "locked@example.com");
  assert.equal(after?.title, "VP");

  await prisma.workspaceCrmSettings.upsert({
    where: { workspaceId },
    create: { workspaceId, blockedCountries: ["GB"] },
    update: { blockedCountries: ["GB"] },
  });
  let blocked = false;
  try {
    await assertOutboundDialAllowed(workspaceId, "+447911123456");
  } catch {
    blocked = true;
  }
  assert.equal(blocked, true, "M19 should block GB when in blockedCountries");

  const { ensureDefaultDealStages } = await import("../lib/server/crm/native/deals");
  const stages = await ensureDefaultDealStages(workspaceId);
  const stage2 = stages[1]?.id;
  assert.ok(stage2);
  const deal = await prisma.crmDeal.create({
    data: { workspaceId, title: "B2 deal test", stageId: stages[0]!.id },
  });
  const moved = await prisma.crmDeal.update({
    where: { id: deal.id },
    data: { stageId: stage2 },
  });
  assert.equal(moved.stageId, stage2);

  const task = await prisma.crmTask.create({
    data: { workspaceId, title: "Call back", contactId: contact.id, status: "open" },
  });
  await prisma.crmTask.update({ where: { id: task.id }, data: { status: "done" } });
  const done = await prisma.crmTask.findUnique({ where: { id: task.id } });
  assert.equal(done?.status, "done");

  await prisma.contact.delete({ where: { id: contact.id } }).catch(() => undefined);
  await prisma.crmDeal.delete({ where: { id: deal.id } }).catch(() => undefined);

  console.log("test-crm-native-b2: PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
