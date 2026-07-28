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

async function claimWaitingRecipient(id: string) {
  const now = new Date();
  const result = await getPrisma().campaignRecipient.updateMany({
    where: { id, workflowStatus: "waiting", nextActionAt: { lte: now } },
    data: { workflowStatus: "in_progress" },
  });
  return result.count === 1;
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

  // Activate parked recipients once campaign is SENDING
  const pending = await prisma.campaignRecipient.findMany({
    where: { workflowStatus: "pending", campaign: { status: "SENDING" } },
    take: BATCH_LIMIT,
  });
  for (const recipient of pending) {
    await prisma.campaignRecipient.update({
      where: { id: recipient.id },
      data: { workflowStatus: "in_progress" },
    });
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
    // Honor scheduled campaigns
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

  if (["completed", "stopped", "opted_out", "failed"].includes(recipient.workflowStatus)) {
    return recipient;
  }

  if (recipient.campaign.status === "PAUSED" || recipient.campaign.status === "CANCELED") {
    return recipient;
  }

  const facts = factsOverride || factsFromRecipientMetadata(recipient.metadata);
  const sequence = parseSequence(recipient.campaign.sequenceJson);
  if (!sequence.length) {
    return prisma.campaignRecipient.update({
      where: { id: recipientId },
      data: { workflowStatus: "completed", completedAt: new Date(), stopReason: "empty_sequence" },
    });
  }

  let step = findStep(sequence, recipient.currentStep);
  if (!step) {
    return prisma.campaignRecipient.update({
      where: { id: recipientId },
      data: { workflowStatus: "completed", completedAt: new Date(), stopReason: "missing_step" },
    });
  }

  for (let guard = 0; guard < 20; guard += 1) {
    if (step.step_type === "end") {
      return prisma.campaignRecipient.update({
        where: { id: recipientId },
        data: {
          workflowStatus: "completed",
          currentStep: step.step_key,
          completedAt: new Date(),
          nextActionAt: null,
        },
      });
    }

    if (step.step_type === "wait") {
      const ms = waitDurationMs(step.config);
      const next = nextStepAfter(sequence, step.step_key);
      return prisma.campaignRecipient.update({
        where: { id: recipientId },
        data: {
          workflowStatus: "waiting",
          currentStep: next?.step_key || step.step_key,
          nextActionAt: new Date(Date.now() + ms),
        },
      });
    }

    if (step.step_type === "condition") {
      const targetKey = evaluateCondition(step, facts);
      const target = findStep(sequence, targetKey);
      if (!target || target.step_type === "end") {
        return prisma.campaignRecipient.update({
          where: { id: recipientId },
          data: {
            workflowStatus: "completed",
            currentStep: targetKey,
            completedAt: new Date(),
            stopReason: "condition_end",
            nextActionAt: null,
          },
        });
      }
      step = target;
      await prisma.campaignRecipient.update({
        where: { id: recipientId },
        data: { currentStep: step.step_key, workflowStatus: "in_progress" },
      });
      continue;
    }

    if (step.step_type === "send_sms" || step.step_type === "send_email") {
      // Stay on this step until send succeeds; tryAdvanceRecipientAfterSend moves forward
      const existing = await prisma.campaignMessage.findFirst({
        where: {
          recipientId,
          stepKey: step.step_key,
          status: { in: ["queued", "sending", "sent", "delivered", "clicked"] },
        },
      });
      if (!existing) {
        await queueSendForStep(recipient.id, step);
      }
      return prisma.campaignRecipient.update({
        where: { id: recipientId },
        data: {
          workflowStatus: "in_progress",
          currentStep: step.step_key,
          completedAt: null,
        },
      });
    }

    return prisma.campaignRecipient.update({
      where: { id: recipientId },
      data: {
        workflowStatus: "failed",
        stopReason: `unknown_step_type:${step.step_type}`,
      },
    });
  }

  return null;
}

/** Create queued message only — campaign_send_batch enforces windows/limits before enqueue. */
async function queueSendForStep(recipientId: string, step: SequenceStep) {
  const prisma = getPrisma();
  const recipient = await prisma.campaignRecipient.findUniqueOrThrow({
    where: { id: recipientId },
    include: { campaign: true },
  });

  const channel = step.step_type === "send_email" ? "email" : "sms";
  const to = channel === "email" ? recipient.email : recipient.phone;
  if (!to) {
    await prisma.campaignRecipient.update({
      where: { id: recipientId },
      data: { workflowStatus: "failed", stopReason: `missing_${channel}_address` },
    });
    return;
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
}

export async function tryAdvanceRecipientAfterSend(recipientId: string) {
  const prisma = getPrisma();
  const recipient = await prisma.campaignRecipient.findUnique({ where: { id: recipientId } });
  if (!recipient) return;
  if (["completed", "stopped", "opted_out", "failed"].includes(recipient.workflowStatus)) return;

  const campaign = await prisma.campaign.findUnique({ where: { id: recipient.campaignId } });
  const sequence = parseSequence(campaign?.sequenceJson);
  const current = findStep(sequence, recipient.currentStep);
  if (!current) return;

  // Move past the send step that just succeeded
  if (current.step_type === "send_sms" || current.step_type === "send_email") {
    const next = nextStepAfter(sequence, current.step_key);
    if (!next) {
      await prisma.campaignRecipient.update({
        where: { id: recipientId },
        data: {
          workflowStatus: "completed",
          completedAt: new Date(),
          nextActionAt: null,
        },
      });
      return;
    }
    await prisma.campaignRecipient.update({
      where: { id: recipientId },
      data: {
        currentStep: next.step_key,
        workflowStatus: "in_progress",
      },
    });
  }

  const facts = factsFromRecipientMetadata(recipient.metadata);
  await advanceRecipient(recipientId, facts);
}

export async function markRecipientFact(
  recipientId: string,
  fact: keyof ConditionFacts,
  value = true,
) {
  const prisma = getPrisma();
  const recipient = await prisma.campaignRecipient.findUnique({ where: { id: recipientId } });
  if (!recipient) return;
  const prev = (recipient.metadata && typeof recipient.metadata === "object"
    ? (recipient.metadata as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  await prisma.campaignRecipient.update({
    where: { id: recipientId },
    data: {
      metadata: { ...prev, [fact]: value } as import("@prisma/client").Prisma.InputJsonValue,
    },
  });
}
