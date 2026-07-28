import type { Prisma, RecipientWorkflowStatus } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { randomTrackingToken } from "@/lib/messaging/crypto";
import { getAppBaseUrl } from "@/lib/messaging/twilio-config";
import { mergeTemplate, splitDisplayName } from "@/lib/messaging/template";
import {
  evaluateCondition,
  findStep,
  nextStepAfter,
  parseSequence,
  waitDurationMs,
  type ConditionFacts,
  type SequenceStep,
} from "./sequence-engine";

const BATCH_LIMIT = 80;
const ACTIVE: RecipientWorkflowStatus[] = ["pending", "scheduled", "in_progress", "waiting"];
const TERMINAL: RecipientWorkflowStatus[] = ["completed", "stopped", "opted_out", "failed"];

async function claimWaitingRecipient(id: string) {
  const now = new Date();
  const result = await getPrisma().campaignRecipient.updateMany({
    where: { id, workflowStatus: "waiting", nextActionAt: { lte: now } },
    data: { workflowStatus: "in_progress" },
  });
  return result.count === 1;
}

async function casRecipient(
  id: string,
  data: {
    workflowStatus?: RecipientWorkflowStatus;
    currentStep?: string | null;
    nextActionAt?: Date | null;
    completedAt?: Date | null;
    stopReason?: string | null;
    enrollmentKey?: null;
    metadata?: Prisma.InputJsonValue;
  },
) {
  return getPrisma().campaignRecipient.updateMany({
    where: { id, workflowStatus: { in: ACTIVE } },
    data,
  });
}

function factsFromRecipientMetadata(metadata: unknown): ConditionFacts {
  const base: ConditionFacts = { no_activity: true };
  if (!metadata || typeof metadata !== "object") return base;
  const m = metadata as Record<string, unknown>;
  const facts: ConditionFacts = {
    message_delivered: Boolean(m.message_delivered),
    link_clicked: Boolean(m.link_clicked),
    customer_replied: Boolean(m.customer_replied),
    customer_opted_out: Boolean(m.customer_opted_out),
    review_detected: Boolean(m.review_detected),
    valid_phone: m.valid_phone == null ? undefined : Boolean(m.valid_phone),
    valid_email: m.valid_email == null ? undefined : Boolean(m.valid_email),
  };
  facts.no_activity = !(
    facts.message_delivered ||
    facts.link_clicked ||
    facts.customer_replied ||
    facts.review_detected
  );
  return facts;
}

export async function processSequenceWaits() {
  const prisma = getPrisma();
  const now = new Date();
  const staleCutoff = new Date(Date.now() - 10 * 60 * 1000);

  // Reclaim recipients stuck in_progress with no queued/sending work
  const stuck = await prisma.campaignRecipient.findMany({
    where: {
      workflowStatus: "in_progress",
      updatedAt: { lt: staleCutoff },
      campaign: { status: "SENDING" },
    },
    take: BATCH_LIMIT,
  });
  for (const recipient of stuck) {
    const open = await prisma.campaignMessage.count({
      where: {
        recipientId: recipient.id,
        status: { in: ["queued", "sending"] },
      },
    });
    if (open > 0) continue;
    // Re-enter advancement (safe — send steps are unique per recipient/step)
    await advanceRecipient(recipient.id);
  }

  // Activate parked recipients once campaign is SENDING (CAS)
  const pending = await prisma.campaignRecipient.findMany({
    where: { workflowStatus: "pending", campaign: { status: "SENDING" } },
    take: BATCH_LIMIT,
    include: { campaign: true },
  });
  for (const recipient of pending) {
    const sequence = parseSequence(recipient.campaign.sequenceJson);
    const first = findStep(sequence, recipient.currentStep) || sequence[0];

    // Honor preserved enroll delay / first wait without starting the clock before activation
    if (recipient.nextActionAt && recipient.nextActionAt > now) {
      const claimed = await prisma.campaignRecipient.updateMany({
        where: { id: recipient.id, workflowStatus: "pending" },
        data: { workflowStatus: "waiting" },
      });
      if (claimed.count !== 1) continue;
      continue;
    }

    if (first?.step_type === "wait" && !recipient.nextActionAt) {
      const ms = waitDurationMs(first.config);
      const next = nextStepAfter(sequence, first.step_key);
      const claimed = await prisma.campaignRecipient.updateMany({
        where: { id: recipient.id, workflowStatus: "pending" },
        data: {
          workflowStatus: "waiting",
          currentStep: next?.step_key || first.step_key,
          nextActionAt: new Date(Date.now() + ms),
        },
      });
      if (claimed.count !== 1) continue;
      continue;
    }

    const claimed = await prisma.campaignRecipient.updateMany({
      where: { id: recipient.id, workflowStatus: "pending" },
      data: { workflowStatus: "in_progress" },
    });
    if (claimed.count !== 1) continue;
    await advanceRecipient(recipient.id);
  }

  const due = await prisma.campaignRecipient.findMany({
    where: {
      workflowStatus: "waiting",
      nextActionAt: { lte: now },
      campaign: { status: { in: ["SENDING", "SCHEDULED"] } },
    },
    take: BATCH_LIMIT,
    include: { campaign: true },
  });

  let advanced = 0;
  for (const recipient of due) {
    if (
      recipient.campaign.status === "SCHEDULED" &&
      recipient.campaign.scheduledAt &&
      recipient.campaign.scheduledAt > now
    ) {
      continue;
    }
    if (recipient.campaign.status === "SCHEDULED" && (!recipient.campaign.scheduledAt || recipient.campaign.scheduledAt <= now)) {
      await prisma.campaign.update({
        where: { id: recipient.campaignId },
        data: { status: "SENDING" },
      });
    }

    const claimed = await claimWaitingRecipient(recipient.id);
    if (!claimed) continue;
    await advanceRecipient(recipient.id);
    advanced += 1;
  }
  return { advanced };
}

export async function advanceRecipient(recipientId: string, factsOverride?: ConditionFacts) {
  const prisma = getPrisma();
  const recipient = await prisma.campaignRecipient.findUnique({
    where: { id: recipientId },
    include: { campaign: true },
  });
  if (!recipient) return null;

  if (TERMINAL.includes(recipient.workflowStatus)) {
    return recipient;
  }

  if (recipient.campaign.status !== "SENDING" && recipient.campaign.status !== "SCHEDULED") {
    return recipient;
  }

  const facts = factsOverride || factsFromRecipientMetadata(recipient.metadata);
  const sequence = parseSequence(recipient.campaign.sequenceJson);
  if (!sequence.length) {
    await casRecipient(recipientId, {
      workflowStatus: "completed",
      completedAt: new Date(),
      stopReason: "empty_sequence",
      enrollmentKey: null,
    });
    return prisma.campaignRecipient.findUnique({ where: { id: recipientId } });
  }

  let step = findStep(sequence, recipient.currentStep);
  if (!step) {
    await casRecipient(recipientId, {
      workflowStatus: "completed",
      completedAt: new Date(),
      stopReason: "missing_step",
      enrollmentKey: null,
    });
    return prisma.campaignRecipient.findUnique({ where: { id: recipientId } });
  }

  for (let guard = 0; guard < 20; guard += 1) {
    // Re-check terminal mid-loop (STOP/click may have raced)
    const live = await prisma.campaignRecipient.findUnique({ where: { id: recipientId } });
    if (!live || TERMINAL.includes(live.workflowStatus)) {
      return live;
    }

    if (step.step_type === "end") {
      await casRecipient(recipientId, {
        workflowStatus: "completed",
        currentStep: step.step_key,
        completedAt: new Date(),
        nextActionAt: null,
        enrollmentKey: null,
      });
      return prisma.campaignRecipient.findUnique({ where: { id: recipientId } });
    }

    if (step.step_type === "wait") {
      const ms = waitDurationMs(step.config);
      const next = nextStepAfter(sequence, step.step_key);
      await casRecipient(recipientId, {
        workflowStatus: "waiting",
        currentStep: next?.step_key || step.step_key,
        nextActionAt: new Date(Date.now() + ms),
      });
      return prisma.campaignRecipient.findUnique({ where: { id: recipientId } });
    }

    if (step.step_type === "condition") {
      const targetKey = evaluateCondition(step, facts);
      const target = findStep(sequence, targetKey);
      if (!target || target.step_type === "end") {
        await casRecipient(recipientId, {
          workflowStatus: "completed",
          currentStep: targetKey,
          completedAt: new Date(),
          stopReason: "condition_end",
          nextActionAt: null,
          enrollmentKey: null,
        });
        return prisma.campaignRecipient.findUnique({ where: { id: recipientId } });
      }
      step = target;
      await casRecipient(recipientId, {
        currentStep: step.step_key,
        workflowStatus: "in_progress",
      });
      continue;
    }

    if (step.step_type === "send_sms" || step.step_type === "send_email") {
      if (recipient.campaign.status !== "SENDING") {
        // Park until campaign is actively sending
        await casRecipient(recipientId, {
          workflowStatus: "pending",
          currentStep: step.step_key,
        });
        return prisma.campaignRecipient.findUnique({ where: { id: recipientId } });
      }
      const existing = await prisma.campaignMessage.findFirst({
        where: {
          recipientId,
          stepKey: step.step_key,
          status: { in: ["queued", "sending", "sent", "delivered", "clicked"] },
        },
      });
      if (!existing) {
        const queued = await queueSendForStep(recipient.id, step);
        if (!queued) {
          // queueSendForStep already marked terminal failure — do not overwrite
          return prisma.campaignRecipient.findUnique({ where: { id: recipientId } });
        }
      }
      await casRecipient(recipientId, {
        workflowStatus: "in_progress",
        currentStep: step.step_key,
        completedAt: null,
      });
      return prisma.campaignRecipient.findUnique({ where: { id: recipientId } });
    }

    await casRecipient(recipientId, {
      workflowStatus: "failed",
      stopReason: `unknown_step_type:${step.step_type}`,
      enrollmentKey: null,
    });
    return prisma.campaignRecipient.findUnique({ where: { id: recipientId } });
  }

  return null;
}

/** Create queued message only — campaign_send_batch enforces windows/limits before enqueue. */
async function queueSendForStep(recipientId: string, step: SequenceStep): Promise<boolean> {
  const prisma = getPrisma();
  const recipient = await prisma.campaignRecipient.findUniqueOrThrow({
    where: { id: recipientId },
    include: { campaign: true },
  });

  const channel = step.step_type === "send_email" ? "email" : "sms";
  const to = channel === "email" ? recipient.email : recipient.phone;
  if (!to) {
    await casRecipient(recipientId, {
      workflowStatus: "failed",
      stopReason: `missing_${channel}_address`,
      completedAt: new Date(),
      enrollmentKey: null,
    });
    return false;
  }

  const trackingToken = randomTrackingToken();
  const trackedUrl = `${getAppBaseUrl()}/r/${trackingToken}`;
  const destinationUrl = process.env.REVIEW_LINK_FALLBACK || "https://transovo.ai";
  const names = splitDisplayName(recipient.displayName);

  const template =
    (typeof step.config?.body === "string" && step.config.body) ||
    recipient.campaign.body ||
    `Hi {{name}}, thanks for choosing us! {{tracking_link}} Reply STOP to opt out.`;

  let body = mergeTemplate(template, {
    ...names,
    customer_name: recipient.displayName || names.name,
    phone: recipient.phone || "",
    email: recipient.email || "",
    tracking_link: trackedUrl,
    review_link: trackedUrl,
  });
  if (!body.includes(trackedUrl)) {
    body = `${body.trim()} ${trackedUrl}`.trim();
  }

  try {
    await prisma.campaignMessage.create({
      data: {
        workspaceId: recipient.workspaceId,
        campaignId: recipient.campaignId,
        recipientId: recipient.id,
        channel,
        stepKey: step.step_key,
        to,
        body,
        status: "queued",
        scheduledFor: new Date(),
        trackingToken,
        destinationUrl,
      },
    });
    return true;
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
      // Concurrent worker already created this step message
      return true;
    }
    throw err;
  }
}

export async function tryAdvanceRecipientAfterSend(recipientId: string) {
  const prisma = getPrisma();
  const recipient = await prisma.campaignRecipient.findUnique({ where: { id: recipientId } });
  if (!recipient) return;
  if (TERMINAL.includes(recipient.workflowStatus)) return;

  const campaign = await prisma.campaign.findUnique({ where: { id: recipient.campaignId } });
  const sequence = parseSequence(campaign?.sequenceJson);
  const current = findStep(sequence, recipient.currentStep);
  if (!current) return;

    // CAS move past the send step — only one finalizer wins
    if (current.step_type === "send_sms" || current.step_type === "send_email") {
      const next = nextStepAfter(sequence, current.step_key);
      if (!next) {
        const done = await prisma.campaignRecipient.updateMany({
          where: {
            id: recipientId,
            workflowStatus: { in: ACTIVE },
            currentStep: current.step_key,
          },
          data: {
            workflowStatus: "completed",
            completedAt: new Date(),
            nextActionAt: null,
            enrollmentKey: null,
          },
        });
        if (done.count === 1) await reconcileCampaignStatus(recipient.campaignId);
        return;
      }
      const moved = await prisma.campaignRecipient.updateMany({
        where: {
          id: recipientId,
          workflowStatus: { in: ACTIVE },
          currentStep: current.step_key,
        },
        data: {
          currentStep: next.step_key,
          workflowStatus: "in_progress",
        },
      });
      if (moved.count === 0) return;
    }

  const fresh = await prisma.campaignRecipient.findUnique({ where: { id: recipientId } });
  if (!fresh || TERMINAL.includes(fresh.workflowStatus)) return;
  const facts = factsFromRecipientMetadata(fresh.metadata);
  await advanceRecipient(recipientId, facts);
  await reconcileCampaignStatus(recipient.campaignId);
}

export async function markRecipientFact(
  recipientId: string,
  fact: keyof ConditionFacts,
  value = true,
) {
  const prisma = getPrisma();
  await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string; metadata: unknown }>>`
      SELECT id, metadata FROM campaign_recipients WHERE id = ${recipientId} FOR UPDATE
    `;
    const recipient = rows[0];
    if (!recipient) return;
    const prev =
      recipient.metadata && typeof recipient.metadata === "object"
        ? (recipient.metadata as Record<string, unknown>)
        : {};
    await tx.campaignRecipient.update({
      where: { id: recipientId },
      data: {
        metadata: { ...prev, [fact]: value } as Prisma.InputJsonValue,
      },
    });
  });
}

/** Mark campaign COMPLETED when no active recipients remain. */
export async function reconcileCampaignStatus(campaignId: string) {
  const prisma = getPrisma();
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.status !== "SENDING") return;

  const active = await prisma.campaignRecipient.count({
    where: {
      campaignId,
      workflowStatus: { in: ACTIVE },
    },
  });
  if (active > 0) return;

  const total = await prisma.campaignRecipient.count({ where: { campaignId } });
  if (total === 0) return;

  const failed = await prisma.campaignRecipient.count({
    where: { campaignId, workflowStatus: "failed" },
  });
  await prisma.campaign.updateMany({
    where: { id: campaignId, status: "SENDING" },
    data: { status: failed === total ? "FAILED" : "COMPLETED" },
  });
}
