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

  const { ensureDefaultDealStages, createDeal, moveDealStage, upsertDealStages } = await import(
    "../lib/server/crm/native/deals",
  );
  const stages = await ensureDefaultDealStages(workspaceId);
  const stage2 = stages[1]?.id;
  assert.ok(stage2);
  const deal = await createDeal(workspaceId, { title: "B2 deal test", stageId: stages[0]!.id });
  const moved = await moveDealStage(workspaceId, deal.id, stage2);
  assert.equal(moved.stageId, stage2);

  {
    const tempName = `B2 temp stage ${Date.now()}`;
    const withTemp = await upsertDealStages(workspaceId, [
      ...stages.map((s, i) => ({
        id: s.id,
        name: s.name,
        sortOrder: i,
        isClosedWon: s.isClosedWon,
        isClosedLost: s.isClosedLost,
      })),
      { name: tempName, sortOrder: stages.length },
    ]);
    const tempStage = withTemp.find((s) => s.name === tempName);
    assert.ok(tempStage?.id);
    const onTemp = await createDeal(workspaceId, { title: "B2 stage-delete deal", stageId: tempStage!.id });
    const kept = withTemp
      .filter((s) => s.id !== tempStage!.id)
      .map((s, i) => ({
        id: s.id,
        name: s.name,
        sortOrder: i,
        isClosedWon: s.isClosedWon,
        isClosedLost: s.isClosedLost,
      }));
    await upsertDealStages(workspaceId, kept);
    const afterDelete = await prisma.crmDeal.findUnique({ where: { id: onTemp.id } });
    assert.ok(afterDelete);
    assert.notEqual(afterDelete!.stageId, tempStage!.id, "deals must move off deleted stage");
    assert.ok(kept.some((k) => k.id === afterDelete!.stageId), "deal lands on a remaining stage");
    await prisma.crmDeal.delete({ where: { id: onTemp.id } }).catch(() => undefined);
  }

  const { createTask, patchTask, createAppointment, patchAppointment } = await import(
    "../lib/server/crm/native/tasks-appointments",
  );
  const task = await createTask(workspaceId, {
    title: "Call back",
    contactId: contact.id,
    assigneeUserId: "b2-owner-user",
  });
  await patchTask(workspaceId, task.id, { status: "done" });
  let done = await prisma.crmTask.findUnique({ where: { id: task.id } });
  assert.equal(done?.status, "done");
  await patchTask(workspaceId, task.id, { status: "open", assigneeUserId: "b2-owner-2" });
  done = await prisma.crmTask.findUnique({ where: { id: task.id } });
  assert.equal(done?.status, "open");
  assert.equal(done?.assigneeUserId, "b2-owner-2");

  const starts = new Date(Date.now() + 86400000);
  starts.setMinutes(0, 0, 0);
  const ends = new Date(starts.getTime() + 3600000);
  const appt = await createAppointment(workspaceId, {
    title: "B2 appt",
    startsAt: starts.toISOString(),
    endsAt: ends.toISOString(),
    timezone: "America/Chicago",
    contactId: contact.id,
  });
  const rescheduled = new Date(starts.getTime() + 7200000);
  await patchAppointment(workspaceId, appt.id, {
    startsAt: rescheduled.toISOString(),
    endsAt: new Date(rescheduled.getTime() + 3600000).toISOString(),
  });
  const apptAfter = await prisma.crmAppointment.findUnique({ where: { id: appt.id } });
  assert.equal(apptAfter?.startsAt?.toISOString(), rescheduled.toISOString());
  await patchAppointment(workspaceId, appt.id, { status: "cancelled" });
  const cancelled = await prisma.crmAppointment.findUnique({ where: { id: appt.id } });
  assert.equal(cancelled?.status, "cancelled");

  await prisma.crmAppointment.delete({ where: { id: appt.id } }).catch(() => undefined);
  await prisma.crmTask.delete({ where: { id: task.id } }).catch(() => undefined);
  await prisma.contact.delete({ where: { id: contact.id } }).catch(() => undefined);
  await prisma.crmDeal.delete({ where: { id: deal.id } }).catch(() => undefined);

  console.log("test-crm-native-b2: PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
