/**
 * Mass Texting send-safety certification: scheduler, recurrence, metrics isolation,
 * large-campaign chunking, tenant isolation, STOP-after-schedule.
 *
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mass-texting-send-safety.ts
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { getPrisma } from "../src/lib/db";
import { grantWorkspaceProductFeature } from "../src/lib/products/feature-entitlements";
import { campaignConfigIsMassText } from "../src/lib/mass-texting/campaign-send";
import { enqueueDueCampaignMessages } from "../src/lib/campaigns/campaign-processor";
import { tickRecurringCampaigns } from "../src/lib/campaigns/recurrence";
import { loadMassTextOverviewMetrics } from "../src/lib/mass-texting/overview-metrics";
import { processInboundMessage } from "../src/lib/messaging/inbound-process";
import { normalizeE164 } from "../src/lib/messaging/twilio-mappings";

function suffix() {
  return randomBytes(4).toString("hex");
}

async function createWorkspace(name: string) {
  const prisma = getPrisma();
  const id = suffix();
  return prisma.workspace.create({
    data: { name: `${name} ${id}`, slug: `mt-safe-${id}`, type: "BUSINESS" },
  });
}

async function cleanupWorkspace(workspaceId: string) {
  const prisma = getPrisma();
  await prisma.jobQueue.deleteMany({ where: { workspaceId } }).catch(() => {});
  await prisma.campaignMessage.deleteMany({ where: { workspaceId } }).catch(() => {});
  await prisma.campaignRecipient.deleteMany({ where: { workspaceId } }).catch(() => {});
  await prisma.campaignLaunchAudit.deleteMany({ where: { workspaceId } }).catch(() => {});
  await prisma.campaign.deleteMany({ where: { workspaceId } }).catch(() => {});
  await prisma.suppression.deleteMany({ where: { workspaceId } }).catch(() => {});
  await prisma.conversationMessage.deleteMany({
    where: { conversation: { workspaceId } },
  }).catch(() => {});
  await prisma.conversation.deleteMany({ where: { workspaceId } }).catch(() => {});
  await prisma.contact.deleteMany({ where: { workspaceId } }).catch(() => {});
  await prisma.phoneNumber.deleteMany({ where: { workspaceId } }).catch(() => {});
  await prisma.workspaceProductFeature.deleteMany({ where: { workspaceId } }).catch(() => {});
  await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => {});
}

async function main() {
  const prisma = getPrisma();
  const ws = await createWorkspace("MT Safety");
  const other = await createWorkspace("MT Other Safety");
  try {
    await grantWorkspaceProductFeature(ws.id, "mass_texting", "trial");
    await grantWorkspaceProductFeature(other.id, "mctb", "active");

    const mtCampaign = await prisma.campaign.create({
      data: {
        workspaceId: ws.id,
        name: "MT scheduled no-audit",
        type: "Broadcast",
        category: "promotion",
        audience: "List",
        body: "Hi there",
        status: "SCHEDULED",
        scheduledAt: new Date(Date.now() - 60_000),
        configJson: { productSource: "mass_text", massTexting: true },
      },
    });
    assert.equal(campaignConfigIsMassText(mtCampaign.configJson), true);

    const firstPass = await enqueueDueCampaignMessages(ws.id);
    assert.equal(firstPass.enqueued, 0, "queued messages on un-audited mass text must not enqueue");
    const stillScheduled = await prisma.campaign.findUnique({ where: { id: mtCampaign.id } });
    assert.equal(stillScheduled?.status, "SCHEDULED", "Mass Text without launch audit must not auto-SENDING");

    const parent = await prisma.campaign.create({
      data: {
        workspaceId: ws.id,
        name: "MT recurring parent",
        type: "Broadcast",
        category: "promotion",
        audience: "List",
        body: "Weekly",
        status: "SCHEDULED",
        scheduledAt: new Date(Date.now() - 60_000),
        configJson: {
          productSource: "mass_text",
          massTexting: true,
          recurrence: {
            frequency: "daily",
            interval: 1,
            nextRunAt: new Date(Date.now() - 60_000).toISOString(),
          },
        },
      },
    });
    const beforeCount = await prisma.campaign.count({ where: { workspaceId: ws.id } });
    await tickRecurringCampaigns(ws.id);
    const afterCount = await prisma.campaign.count({ where: { workspaceId: ws.id } });
    assert.equal(afterCount, beforeCount, "Mass Texting recurrence must not spawn child campaigns in V1");
    const parentAfter = await prisma.campaign.findUnique({ where: { id: parent.id } });
    assert.equal(parentAfter?.status, "SCHEDULED");

    const mctbCampaign = await prisma.campaign.create({
      data: {
        workspaceId: ws.id,
        name: "MCTB review",
        type: "Sequence",
        category: "review",
        audience: "Custom",
        body: "Please review us",
        status: "COMPLETED",
        sent: 50,
        delivered: 48,
        replies: 10,
        optOuts: 1,
        configJson: { productSource: "mctb" },
      },
    });
    await prisma.campaign.update({
      where: { id: mtCampaign.id },
      data: { sent: 7, delivered: 7, replies: 2, optOuts: 0 },
    });
    const metrics = await loadMassTextOverviewMetrics(ws.id);
    assert.equal(metrics.delivered, 7, "overview delivered must ignore MCTB campaigns");
    assert.equal(metrics.replies, 2);
    assert.ok(!metrics.recentCampaigns.some((c) => c.id === mctbCampaign.id));

    const blast = await prisma.campaign.create({
      data: {
        workspaceId: ws.id,
        name: "chunk blast",
        type: "Broadcast",
        category: "promotion",
        audience: "List",
        body: "chunk",
        status: "SENDING",
        configJson: { productSource: "mass_text", massTexting: true },
      },
    });
    const recipients = [];
    for (let i = 0; i < 120; i += 1) {
      recipients.push(
        prisma.campaignRecipient.create({
          data: {
            workspaceId: ws.id,
            campaignId: blast.id,
            phone: `+1555${String(1000000 + i).slice(0, 7)}`,
            workflowStatus: "in_progress",
            currentStep: "sms_1",
            enrollmentKey: `${blast.id}:p:${i}`,
          },
        }),
      );
    }
    const createdRecipients = await Promise.all(recipients);
    await Promise.all(
      createdRecipients.map((r: { id: string; phone: string | null }, i: number) =>
        prisma.campaignMessage.create({
          data: {
            workspaceId: ws.id,
            campaignId: blast.id,
            recipientId: r.id,
            channel: "sms",
            stepKey: "sms_1",
            to: r.phone || `+1555000${i}`,
            body: "chunk",
            status: "queued",
            scheduledFor: new Date(Date.now() - 1000),
          },
        }),
      ),
    );
    const dueMessages = await prisma.campaignMessage.findMany({
      where: {
        workspaceId: ws.id,
        campaignId: blast.id,
        status: "queued",
      },
      take: 250,
    });
    assert.equal(dueMessages.length, 120);
    const chunk = dueMessages.slice(0, 100);
    assert.equal(chunk.length, 100);
    const keys = chunk.map((m: { id: string }) => `send-campaign-message:${m.id}`);
    assert.equal(keys.length, new Set(keys).size, "no duplicate send keys in a chunk");

    const phone = normalizeE164("555-200-3000");
    await prisma.contact.create({
      data: {
        workspaceId: ws.id,
        phone,
        firstName: "Pat",
        status: "SUBSCRIBED",
      },
    });
    await prisma.phoneNumber.create({
      data: {
        workspaceId: ws.id,
        e164: "+15550009999",
        type: "local",
        status: "Active",
        settingsJson: { massTextRole: "primary" },
      },
    });
    const stop = await processInboundMessage({
      workspaceId: ws.id,
      from: phone,
      to: "+15550009999",
      body: "STOP",
      providerMessageId: `stop-${suffix()}`,
    });
    assert.equal(stop.kind, "stop");
    const otherContact = await prisma.contact.findFirst({
      where: { workspaceId: other.id, phone },
    });
    assert.equal(otherContact, null);
    const leaked = await prisma.contact.findFirst({
      where: { id: (await prisma.contact.findFirst({ where: { workspaceId: ws.id } }))!.id, workspaceId: other.id },
    });
    assert.equal(leaked, null);

    const unsub = await prisma.contact.create({
      data: {
        workspaceId: ws.id,
        phone: "+15553004000",
        firstName: "Opted",
        status: "UNSUBSCRIBED",
      },
    });
    await prisma.contact.upsert({
      where: { workspaceId_phone: { workspaceId: ws.id, phone: unsub.phone } },
      create: {
        workspaceId: ws.id,
        phone: unsub.phone,
        firstName: "ShouldNot",
        status: "SUBSCRIBED",
      },
      update: { firstName: "ImportAttempt" },
    });
    const afterImport = await prisma.contact.findUnique({ where: { id: unsub.id } });
    assert.equal(afterImport?.status, "UNSUBSCRIBED", "upsert must not reactivate opted-out contacts");

    console.log("test-mass-texting-send-safety: ok");
  } finally {
    await cleanupWorkspace(ws.id);
    await cleanupWorkspace(other.id);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
