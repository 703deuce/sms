import "server-only";

import { mergeMessageVars } from "@/lib/automations/actions";
import { getPrisma } from "@/lib/db";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { sendQuickSms } from "@/lib/sms/send-quick";
import { getDripCampaign, listDripCampaigns } from "./service";
import {
  delayToMs,
  parseDripSteps,
  type DripCampaignRecord,
  type DripCampaignTriggerType,
  type DripEnrollmentRecord,
} from "./types";

export type DripTriggerContext = {
  workspaceId: string;
  contactId: string;
  triggerType: DripCampaignTriggerType;
  listId?: string;
  tagId?: string;
  formId?: string;
};

function matchesTrigger(row: DripCampaignRecord, ctx: DripTriggerContext): boolean {
  if (row.status !== "active") return false;
  if (row.triggerType !== ctx.triggerType) return false;
  switch (ctx.triggerType) {
    case "tag_added":
      return Boolean(ctx.tagId && row.triggerConfig.tagId === ctx.tagId);
    case "list_join":
      return Boolean(ctx.listId && row.triggerConfig.listId === ctx.listId);
    case "form_submitted":
      return Boolean(ctx.formId && row.triggerConfig.formId === ctx.formId);
    case "contact_added":
      return true;
    default:
      return false;
  }
}

async function isExcluded(
  workspaceId: string,
  contactId: string,
  config: DripCampaignRecord["triggerConfig"],
): Promise<boolean> {
  if (config.exclusionListId) {
    const member = await getPrisma().contactListMember.findFirst({
      where: { contactId, listId: config.exclusionListId },
    });
    if (member) return true;
  }
  return false;
}

export async function scheduleDripStep(
  enrollmentId: string,
  stepIndex: number,
  runAfter = new Date(),
) {
  await enqueueJob({
    jobType: "drip_campaign_step",
    workspaceId: undefined,
    payload: { enrollmentId, stepIndex },
    idempotencyKey: `drip-step:${enrollmentId}:${stepIndex}`,
    runAfter,
  });
}

export async function enrollContactInDripCampaign(
  campaign: DripCampaignRecord,
  contactId: string,
): Promise<boolean> {
  const prisma = getPrisma();
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, workspaceId: campaign.workspaceId },
  });
  if (!contact || contact.status !== "SUBSCRIBED") return false;
  if (await isExcluded(campaign.workspaceId, contactId, campaign.triggerConfig)) return false;

  const existing = await prisma.dripCampaignEnrollment.findFirst({
    where: { dripCampaignId: campaign.id, contactId },
  });
  if (existing) return false;

  const steps = parseDripSteps(campaign.steps);
  if (!steps.length) return false;

  const firstDelay = delayToMs(steps[0]);
  const nextRunAt = new Date(Date.now() + firstDelay);

  const enrollment = await prisma.dripCampaignEnrollment.create({
    data: {
      dripCampaignId: campaign.id,
      workspaceId: campaign.workspaceId,
      contactId,
      status: "active",
      currentStepIndex: 0,
      nextRunAt,
    },
  });

  await prisma.dripCampaign.update({
    where: { id: campaign.id },
    data: { triggeredCount: { increment: 1 } },
  });

  if (firstDelay === 0) {
    await processDripCampaignStep({ enrollmentId: enrollment.id, stepIndex: 0 });
  } else {
    await scheduleDripStep(enrollment.id, 0, nextRunAt);
  }
  return true;
}

export async function triggerDripCampaigns(ctx: DripTriggerContext): Promise<number> {
  const campaigns = await listDripCampaigns(ctx.workspaceId);
  let enrolled = 0;
  for (const campaign of campaigns) {
    if (!matchesTrigger(campaign, ctx)) continue;
    const ok = await enrollContactInDripCampaign(campaign, ctx.contactId);
    if (ok) enrolled += 1;
  }
  return enrolled;
}

export async function processDripCampaignStep(payload: {
  enrollmentId: string;
  stepIndex: number;
}) {
  const prisma = getPrisma();
  const enrollment = await prisma.dripCampaignEnrollment.findUnique({
    where: { id: payload.enrollmentId },
  });
  if (!enrollment || enrollment.status !== "active") {
    return { skipped: true, reason: "enrollment_inactive" };
  }

  if (payload.stepIndex < enrollment.currentStepIndex) {
    return { skipped: true, reason: "step_already_processed" };
  }

  const campaignRow = await prisma.dripCampaign.findUnique({
    where: { id: enrollment.dripCampaignId },
  });
  if (!campaignRow || campaignRow.status !== "active") {
    return { skipped: true, reason: "campaign_inactive" };
  }

  const contact = await prisma.contact.findFirst({
    where: { id: enrollment.contactId, workspaceId: enrollment.workspaceId },
  });
  if (!contact || contact.status !== "SUBSCRIBED") {
    await prisma.dripCampaignEnrollment.update({
      where: { id: enrollment.id },
      data: { status: "opted_out", completedAt: new Date(), nextRunAt: null },
    });
    return { skipped: true, reason: "contact_opted_out" };
  }

  const steps = parseDripSteps(campaignRow.stepsJson);
  const step = steps[payload.stepIndex];
  if (!step) {
    await prisma.dripCampaignEnrollment.update({
      where: { id: enrollment.id },
      data: { status: "completed", completedAt: new Date(), nextRunAt: null },
    });
    return { completed: true };
  }

  let fromE164: string | undefined;
  if (campaignRow.phoneNumberId) {
    const pn = await prisma.phoneNumber.findFirst({
      where: { id: campaignRow.phoneNumberId, workspaceId: enrollment.workspaceId },
      select: { e164: true },
    });
    fromE164 = pn?.e164 || undefined;
  }

  const body = await mergeMessageVars(enrollment.workspaceId, contact, step.message);
  const idempotencyKey = `drip:${enrollment.dripCampaignId}:${enrollment.contactId}:${payload.stepIndex}`;

  await sendQuickSms({
    workspaceId: enrollment.workspaceId,
    to: contact.phone,
    body,
    from: fromE164,
    mediaUrls: step.mediaUrls,
    idempotencyKey,
  });

  const now = new Date();
  const nextIndex = payload.stepIndex + 1;
  const nextStep = steps[nextIndex];

  await prisma.dripCampaign.update({
    where: { id: campaignRow.id },
    data: {
      messagesSent: { increment: 1 },
      lastSentAt: now,
    },
  });

  if (nextStep) {
    const nextRunAt = new Date(now.getTime() + delayToMs(nextStep));
    await prisma.dripCampaignEnrollment.update({
      where: { id: enrollment.id },
      data: {
        currentStepIndex: nextIndex,
        lastSentAt: now,
        nextRunAt,
      },
    });
    await scheduleDripStep(enrollment.id, nextIndex, nextRunAt);
  } else {
    await prisma.dripCampaignEnrollment.update({
      where: { id: enrollment.id },
      data: {
        currentStepIndex: nextIndex,
        lastSentAt: now,
        nextRunAt: null,
        status: "completed",
        completedAt: now,
      },
    });
  }

  return { sent: true, stepIndex: payload.stepIndex };
}

export async function loadDripCampaignDetail(workspaceId: string, id: string) {
  const campaign = await getDripCampaign(workspaceId, id);
  if (!campaign) return null;

  const prisma = getPrisma();
  const enrollments = await prisma.dripCampaignEnrollment.findMany({
    where: { dripCampaignId: id, workspaceId },
    orderBy: { startedAt: "desc" },
    take: 100,
  });

  const contactIds = enrollments.map((e) => e.contactId);
  const contacts = await prisma.contact.findMany({
    where: { workspaceId, id: { in: contactIds } },
    select: { id: true, phone: true, firstName: true, lastName: true },
  });
  const byId = new Map(contacts.map((c) => [c.id, c]));

  const recipients: DripEnrollmentRecord[] = enrollments.map((e) => {
    const c = byId.get(e.contactId);
    return {
      id: e.id,
      dripCampaignId: e.dripCampaignId,
      workspaceId: e.workspaceId,
      contactId: e.contactId,
      status: e.status as DripEnrollmentRecord["status"],
      currentStepIndex: e.currentStepIndex,
      nextRunAt: e.nextRunAt?.toISOString() ?? null,
      startedAt: e.startedAt.toISOString(),
      completedAt: e.completedAt?.toISOString() ?? null,
      lastSentAt: e.lastSentAt?.toISOString() ?? null,
      replied: e.replied,
      opened: e.opened,
      contactName:
        [c?.firstName, c?.lastName].filter(Boolean).join(" ") || c?.phone || "Unknown",
      contactPhone: c?.phone || "",
    };
  });

  const totalEnrollments = enrollments.length;
  const repliedCount = enrollments.filter((e) => e.replied).length;
  const openedCount = enrollments.filter((e) => e.opened).length;

  const activityByDay = new Map<string, { sent: number; replies: number }>();
  for (const e of enrollments) {
    if (!e.lastSentAt) continue;
    const key = e.lastSentAt.toISOString().slice(0, 10);
    const cur = activityByDay.get(key) || { sent: 0, replies: 0 };
    cur.sent += 1;
    if (e.replied) cur.replies += 1;
    activityByDay.set(key, cur);
  }

  const chartLabels = [...activityByDay.keys()].sort().slice(-7);
  const chartSent = chartLabels.map((d) => activityByDay.get(d)?.sent || 0);
  const chartReplies = chartLabels.map((d) => activityByDay.get(d)?.replies || 0);

  const dripMessages = await prisma.message.findMany({
    where: {
      workspaceId,
      idempotencyKey: { startsWith: `drip:${id}:` },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { id: true, to: true, status: true, createdAt: true },
  });
  const { summarizeDeliveryStatuses } = await import("@/lib/automate/delivery-stats");
  const delivery = summarizeDeliveryStatuses(dripMessages.map((m) => m.status));

  return {
    campaign,
    recipients,
    stats: {
      totalTriggered: campaign.triggeredCount,
      messagesSent: campaign.messagesSent,
      avgOpenRate: totalEnrollments ? (openedCount / totalEnrollments) * 100 : 0,
      avgReplyRate: totalEnrollments ? (repliedCount / totalEnrollments) * 100 : 0,
      deliveryRate: delivery.deliveryRate,
      deliveredCount: delivery.delivered,
      failedCount: delivery.failed,
    },
    delivery,
    recentDeliveries: dripMessages.slice(0, 50).map((m) => ({
      id: m.id,
      to: m.to,
      status: m.status,
      sentAt: m.createdAt.toISOString(),
    })),
    chart: {
      labels: chartLabels.map((d) =>
        new Date(d).toLocaleDateString(undefined, { weekday: "short" }),
      ),
      sent: chartSent,
      replies: chartReplies,
    },
  };
}
