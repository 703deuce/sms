import { getPrisma } from "@/lib/db";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
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

export async function processSequenceWaits() {
  const prisma = getPrisma();
  const now = new Date();
  const due = await prisma.campaignRecipient.findMany({
    where: { workflowStatus: "waiting", nextActionAt: { lte: now } },
    take: BATCH_LIMIT,
    include: { campaign: true },
  });

  let advanced = 0;
  for (const recipient of due) {
    const claimed = await claimWaitingRecipient(recipient.id);
    if (!claimed) continue;
    await advanceRecipient(recipient.id);
    advanced += 1;
  }
  return { advanced };
}

export async function advanceRecipient(recipientId: string, facts: ConditionFacts = { no_activity: true }) {
  const prisma = getPrisma();
  const recipient = await prisma.campaignRecipient.findUnique({
    where: { id: recipientId },
    include: { campaign: true },
  });
  if (!recipient) return null;

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

  // Walk until we queue a send, schedule a wait, or end
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
      await queueSendForStep(recipient.id, step);
      const next = nextStepAfter(sequence, step.step_key);
      return prisma.campaignRecipient.update({
        where: { id: recipientId },
        data: {
          workflowStatus: next ? "in_progress" : "completed",
          currentStep: next?.step_key || step.step_key,
          completedAt: next ? null : new Date(),
        },
      });
    }

    // Unknown step — stop
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

async function queueSendForStep(
  recipientId: string,
  step: SequenceStep,
) {
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

  const message = await prisma.campaignMessage.create({
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

  await enqueueJob({
    jobType: channel === "email" ? "send_campaign_email" : "send_campaign_sms",
    queueName: channel === "email" ? "email-send" : "sms-send",
    workspaceId: recipient.workspaceId,
    payload: { messageId: message.id },
    idempotencyKey: `send-campaign-message:${message.id}`,
  });
}

export async function tryAdvanceRecipientAfterSend(recipientId: string) {
  const recipient = await getPrisma().campaignRecipient.findUnique({ where: { id: recipientId } });
  if (!recipient) return;
  if (["completed", "stopped", "opted_out", "failed"].includes(recipient.workflowStatus)) return;

  const sequence = parseSequence(
    (await getPrisma().campaign.findUnique({ where: { id: recipient.campaignId } }))?.sequenceJson,
  );
  const current = findStep(sequence, recipient.currentStep);
  if (!current) return;

  // If current points at next wait, process it; otherwise leave for drain
  if (current.step_type === "wait") {
    await advanceRecipient(recipientId);
  }
}
