/**
 * Playbook end-to-end wiring — creates campaigns/automations per template in an isolated workspace.
 *
 * Run:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-playbook-e2e.ts
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { config } from "dotenv";
import { getPrisma } from "../src/lib/db";
import {
  CAMPAIGN_CATEGORIES,
  buildSequenceForCategory,
  DEFAULT_MESSAGES,
  type CampaignCategoryId,
} from "../src/lib/campaigns/catalog";
import { playbookHref } from "../src/lib/campaigns/playbook-routes";
import {
  buildAutomationDefinitionFromCampaignPlaybook,
  getCampaignPlaybookAutomationSpec,
} from "../src/lib/campaigns/playbook-automation";
import { seedBroadcastComposeFromPlaybook } from "../src/lib/campaigns/playbook-broadcast";
import { parseSequence } from "../src/lib/campaigns/sequence-engine";
import {
  validateAutomationForPublish,
  hasBlockingErrors,
} from "../src/lib/automations/validation";
import { createBroadcastCampaign } from "../src/lib/mass-texting/broadcast/service";
import { buildPreSendReview } from "../src/lib/mass-texting/pre-send-review";
import { grantWorkspaceProductFeature } from "../src/lib/products/feature-entitlements";
import { getOrCreateMassTextingBillingAccount, updateMassTextingLifecycle } from "../src/lib/mass-texting/billing-account";
import { campaignConfigIsMassText } from "../src/lib/mass-texting/campaign-send";
import { normalizeE164 } from "../src/lib/messaging/twilio-mappings";

config({ path: ".env.local" });

const TEST_PHONE = normalizeE164(process.env.ALLOWED_TEST_PHONE || "+15555550100");

async function createWorkspace() {
  const prisma = getPrisma();
  const suffix = randomBytes(4).toString("hex");
  return prisma.workspace.create({
    data: {
      name: `Playbook E2E ${suffix}`,
      slug: `playbook-e2e-${suffix}`,
      type: "BUSINESS",
    },
  });
}

async function cleanup(workspaceId: string) {
  const prisma = getPrisma();
  const campaignIds = (
    await prisma.campaign.findMany({ where: { workspaceId }, select: { id: true } })
  ).map((c) => c.id);
  if (campaignIds.length) {
    await prisma.campaignMessage.deleteMany({ where: { campaignId: { in: campaignIds } } });
  }
  await prisma.campaignRecipient.deleteMany({ where: { workspaceId } });
  await prisma.campaignLaunchAudit.deleteMany({ where: { workspaceId } });
  await prisma.campaign.deleteMany({ where: { workspaceId } });
  await prisma.automationFlow.deleteMany({ where: { workspaceId } });
  const lists = await prisma.contactList.findMany({ where: { workspaceId }, select: { id: true } });
  if (lists.length) {
    await prisma.contactListMember.deleteMany({
      where: { listId: { in: lists.map((l) => l.id) } },
    });
  }
  await prisma.contactList.deleteMany({ where: { workspaceId } });
  await prisma.contact.deleteMany({ where: { workspaceId } });
  await prisma.massTextingCreditReservation.deleteMany({ where: { workspaceId } });
  await prisma.massTextingBillingAccount.deleteMany({ where: { workspaceId } });
  await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => undefined);
}

async function createSequenceCampaign(
  workspaceId: string,
  categoryId: CampaignCategoryId,
  phone: string,
) {
  const prisma = getPrisma();
  const message = DEFAULT_MESSAGES[categoryId];
  const sequence = buildSequenceForCategory(categoryId, message, {
    delayHours: 1,
    followUpCount: 2,
    stopOnReply: true,
  });
  const parsed = parseSequence(sequence);
  assert.ok(parsed.some((s) => s.step_type === "send_sms"), `${categoryId} has SMS step`);

  const campaign = await prisma.campaign.create({
    data: {
      workspaceId,
      name: `E2E ${categoryId}`,
      type: categoryId,
      category: categoryId,
      audience: `Manual: ${phone}`,
      body: message,
      status: "DRAFT",
      sequenceJson: sequence as object,
      configJson: { trigger: "manual test" },
      createdBy: "playbook-e2e",
    },
  });

  let contact = await prisma.contact.findFirst({
    where: { workspaceId, phone },
  });
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        workspaceId,
        phone,
        firstName: "Playbook",
        lastName: "Test",
        status: "SUBSCRIBED",
      },
    });
  }

  await prisma.campaignRecipient.create({
    data: {
      workspaceId,
      campaignId: campaign.id,
      contactId: contact.id,
      phone,
      displayName: "Playbook Test",
      workflowStatus: "pending",
      enrollmentKey: `${campaign.id}:p:${phone}`,
    },
  });

  return campaign;
}

async function main() {
  const workspace = await createWorkspace();
  console.log(`Workspace: ${workspace.id}`);

  try {
    for (const cat of CAMPAIGN_CATEGORIES) {
      const href = playbookHref(cat);
      if (cat.engine === "broadcast") {
        assert.match(href, /^\/campaigns\/new\?playbook=/);
        const seeded = seedBroadcastComposeFromPlaybook(cat.id, { name: "", message: "" }, { force: true });
        assert.ok(seeded.message.length > 10, `${cat.id} broadcast message seeded`);
        assert.equal(seeded.categoryId, cat.id);
      } else if (cat.engine === "automation") {
        const def = buildAutomationDefinitionFromCampaignPlaybook(cat.id);
        assert.ok(def, `${cat.id} automation definition`);
        const spec = getCampaignPlaybookAutomationSpec(cat.id);
        assert.ok(spec, `${cat.id} automation spec`);
        const issues = validateAutomationForPublish(spec!.title, def!);
        const blocking = issues.filter((i) => i.severity === "error");
        if (cat.id === "custom") {
          assert.ok(
            blocking.some((i) => i.message.includes("Connect the trigger")),
            "custom playbook should need user wiring before publish",
          );
        } else {
          assert.equal(
            blocking.length,
            0,
            `${cat.id} automation blocking: ${blocking.map((i) => i.message).join("; ")}`,
          );
        }
      } else {
        assert.equal(href, `/campaigns/new/${cat.id}`, cat.id);
        const seq = buildSequenceForCategory(cat.id, DEFAULT_MESSAGES[cat.id], {
          delayHours: 1,
          followUpCount: 2,
        });
        assert.ok(seq.some((s) => s.step_type === "send_sms"), `${cat.id} sequence SMS`);
      }
    }

    await grantWorkspaceProductFeature(workspace.id, "mass_texting", "trial");
    await getOrCreateMassTextingBillingAccount(workspace.id);
    await updateMassTextingLifecycle(workspace.id, "TRIAL_ACTIVE", {
      trialStartedAt: new Date(),
      trialEndsAt: new Date(Date.now() + 14 * 86400000),
      trialSegmentsUsed: 0,
    });

    const prisma = getPrisma();
    const contact = await prisma.contact.create({
      data: {
        workspaceId: workspace.id,
        phone: TEST_PHONE,
        firstName: "Playbook",
        lastName: "Broadcast",
        status: "SUBSCRIBED",
      },
    });

    const broadcast = await createBroadcastCampaign(
      workspace.id,
      {
        name: "Playbook promotion test",
        message: DEFAULT_MESSAGES.promotion,
        category: "promotion",
        audience: {
          include: [{ type: "contact", id: contact.id, name: "Playbook Broadcast" }],
          exclude: [],
        },
        scheduleMode: "now",
        timezone: "America/New_York",
      },
      "playbook-e2e",
    );
    assert.equal(broadcast.category, "promotion");
    const review = await buildPreSendReview(workspace.id, broadcast.id);
    assert.ok(review, "broadcast pre-send review");
    assert.equal(review!.finalRecipientCount, 1, "broadcast enrolled 1 recipient");
    assert.ok(review!.canSend || review!.blockReason, "review returns send gate");

    const sequenceCategories = CAMPAIGN_CATEGORIES.filter((c) => c.engine === "sequence").map(
      (c) => c.id as CampaignCategoryId,
    );
    for (const categoryId of sequenceCategories) {
      const campaign = await createSequenceCampaign(workspace.id, categoryId, TEST_PHONE);
      const config =
        campaign.configJson && typeof campaign.configJson === "object"
          ? (campaign.configJson as Record<string, unknown>)
          : {};
      assert.equal(
        campaignConfigIsMassText(config),
        false,
        `${categoryId} sequence should not be force-tagged mass text from builder config`,
      );
      const seqReview = await buildPreSendReview(workspace.id, campaign.id);
      assert.ok(seqReview, `${categoryId} pre-send review`);
      assert.equal(seqReview!.finalRecipientCount, 1, `${categoryId} enrolled`);
    }

    for (const id of ["missed_call", "status_update"] as const) {
      const spec = getCampaignPlaybookAutomationSpec(id)!;
      const def = buildAutomationDefinitionFromCampaignPlaybook(id)!;
      const row = await prisma.automationFlow.create({
        data: {
          workspaceId: workspace.id,
          name: spec.title,
          trigger: spec.triggerBlockType,
          definition: def as object,
          status: "DRAFT",
        },
      });
      assert.ok(row.id, `${id} automation row`);
      const issues = validateAutomationForPublish(spec.title, def);
      assert.equal(hasBlockingErrors(issues), false, `${id} publish validation`);
    }

    console.log("playbook e2e checks passed");
  } finally {
    await cleanup(workspace.id);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
