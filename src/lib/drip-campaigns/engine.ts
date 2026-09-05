import "server-only";

import { mergeMessageVars } from "@/lib/automations/actions";
import {
  contactMatchesSegment,
  parseSegmentConditions,
} from "@/lib/contacts/segment-query";
import { isAutomationContact } from "@/lib/contacts/visible-contacts";
import { filterWorkspaceListIds } from "@/lib/contacts/workspace-membership";
import { getPrisma } from "@/lib/db";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { sendQuickSms } from "@/lib/sms/send-quick";
import { getDripCampaign, listActiveDripCampaigns } from "./service";
import {
  delayToMs,
  parseDripSteps,
  type DripCampaignRecord,
  type DripCampaignTriggerType,
  type DripEnrollmentRecord,
  type DripTriggerConfig,
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

async function contactInExclusionSegment(
  workspaceId: string,
  contactId: string,
  segmentId: string,
): Promise<boolean> {
  const prisma = getPrisma();
  const segment = await prisma.segment.findFirst({
    where: { id: segmentId, workspaceId },
  });
  if (!segment) return false;

  const contact = await prisma.contact.findFirst({
    where: { id: contactId, workspaceId },
    include: { tagMembers: { include: { tag: true } } },
  });
  if (!contact) return false;

  return contactMatchesSegment(
    {
      id: contact.id,
      status: contact.status,
      customFields: contact.customFields,
      tagNames: contact.tagMembers.map((t) => t.tag.name),
      source: contact.consentSource,
    },
    parseSegmentConditions(segment.conditions),
  );
}

async function isExcluded(
  workspaceId: string,
  contactId: string,
  config: DripTriggerConfig,
): Promise<boolean> {
  const prisma = getPrisma();

  if (config.exclusionListId) {
    const [listId] = await filterWorkspaceListIds(workspaceId, [config.exclusionListId]);
    if (listId) {
      const member = await prisma.contactListMember.findFirst({
        where: { contactId, listId },
      });
      if (member) return true;
    }
  }

  if (config.exclusionSegmentId) {
    if (await contactInExclusionSegment(workspaceId, contactId, config.exclusionSegmentId)) {
      return true;
    }
  }

  return false;
}

export async function scheduleDripStep(
  enrollmentId: string,
  stepIndex: number,
  runAfter = new Date(),
  workspaceId?: string,
) {
  await enqueueJob({
    jobType: "drip_campaign_step",
    workspaceId,
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
    select: { id: true, status: true, customFields: true },
  });
  if (!contact || contact.status !== "SUBSCRIBED") return false;
  if (isAutomationContact(contact.customFields)) return false;
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
    await scheduleDripStep(enrollment.id, 0, nextRunAt, campaign.workspaceId);
  }
  return true;
}

export async function triggerDripCampaigns(ctx: DripTriggerContext): Promise<number> {
  const campaigns = await listActiveDripCampaigns(ctx.workspaceId);
  let enrolled = 0;
  for (const campaign of campaigns) {
    if (!matchesTrigger(campaign, ctx)) continue;
    const ok = await enrollContactInDripCampaign(campaign, ctx.contactId);
    if (ok) enrolled += 1;
  }
  return enrolled;
}

/** Mark active/completed drip enrollments as replied after an inbound SMS. */
export async function markDripEnrollmentReplies(
  workspaceId: string,
  contactId: string,
): Promise<number> {
  const result = await getPrisma().dripCampaignEnrollment.updateMany({
    where: {
      workspaceId,
      contactId,
      replied: false,
      lastSentAt: { not: null },
      status: { in: ["active", "completed"] },
    },
    data: { replied: true },
  });
  return result.count;
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

  const campaign = await getDripCampaign(enrollment.workspaceId, enrollment.dripCampaignId);
  if (
    campaign &&
    (await isExcluded(enrollment.workspaceId, enrollment.contactId, campaign.triggerConfig))
  ) {
    await prisma.dripCampaignEnrollment.update({
      where: { id: enrollment.id },
      data: { status: "paused", nextRunAt: null },
    });
    return { skipped: true, reason: "contact_excluded" };
  }

  const contact = await prisma.contact.findFirst({
    where: { id: enrollment.contactId, workspaceId: enrollment.workspaceId },
    select: {
      id: true,
      phone: true,
      status: true,
      customFields: true,
      firstName: true,
      lastName: true,
    },
  });
  if (
    !contact ||
    contact.status !== "SUBSCRIBED" ||
    isAutomationContact(contact.customFields)
  ) {
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

  if ((step.channel || "sms") === "voice") {
    const { executeDripVoiceStep } = await import("@/lib/appointment-voice-reminders/drip-voice");
    await executeDripVoiceStep({
      workspaceId: enrollment.workspaceId,
      contactId: enrollment.contactId,
      phone: contact.phone,
      message: step.message,
      voiceReminderTemplateId: step.voiceReminderTemplateId,
      dripCampaignId: enrollment.dripCampaignId,
      stepIndex: payload.stepIndex,
    });
  } else {
    await sendQuickSms({
      workspaceId: enrollment.workspaceId,
      to: contact.phone,
      body,
      from: fromE164,
      mediaUrls: step.mediaUrls,
      idempotencyKey,
    });
  }

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
    await scheduleDripStep(enrollment.id, nextIndex, nextRunAt, enrollment.workspaceId);
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
  const enrollmentWhere = { dripCampaignId: id, workspaceId };

  const [enrollments, totalEnrollments, activeEnrollments, completedEnrollments, repliedCount, openedCount] =
    await Promise.all([
    prisma.dripCampaignEnrollment.findMany({
      where: enrollmentWhere,
      orderBy: { startedAt: "desc" },
      take: 100,
    }),
    prisma.dripCampaignEnrollment.count({ where: enrollmentWhere }),
    prisma.dripCampaignEnrollment.count({
      where: { ...enrollmentWhere, status: "active" },
    }),
    prisma.dripCampaignEnrollment.count({
      where: { ...enrollmentWhere, status: "completed" },
    }),
    prisma.dripCampaignEnrollment.count({
      where: { ...enrollmentWhere, replied: true },
    }),
    prisma.dripCampaignEnrollment.count({
      where: { ...enrollmentWhere, opened: true },
    }),
  ]);

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

  const dripMessages = await prisma.message.findMany({
    where: {
      workspaceId,
      idempotencyKey: { startsWith: `drip:${id}:` },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { id: true, to: true, status: true, createdAt: true },
  });

  const activityByDay = new Map<string, { sent: number; replies: number }>();
  for (const m of dripMessages) {
    const key = m.createdAt.toISOString().slice(0, 10);
    const cur = activityByDay.get(key) || { sent: 0, replies: 0 };
    cur.sent += 1;
    activityByDay.set(key, cur);
  }
  const repliedEnrollments = await prisma.dripCampaignEnrollment.findMany({
    where: { ...enrollmentWhere, replied: true, lastSentAt: { not: null } },
    select: { lastSentAt: true },
    take: 500,
  });
  for (const e of repliedEnrollments) {
    if (!e.lastSentAt) continue;
    const key = e.lastSentAt.toISOString().slice(0, 10);
    const cur = activityByDay.get(key) || { sent: 0, replies: 0 };
    cur.replies += 1;
    activityByDay.set(key, cur);
  }

  const chartLabels = [...activityByDay.keys()].sort().slice(-7);
  const chartSent = chartLabels.map((d) => activityByDay.get(d)?.sent || 0);
  const chartReplies = chartLabels.map((d) => activityByDay.get(d)?.replies || 0);

  const { summarizeDeliveryStatuses } = await import("@/lib/automate/delivery-stats");
  const delivery = summarizeDeliveryStatuses(dripMessages.map((m) => m.status));

  return {
    campaign,
    recipients,
    stats: {
      totalTriggered: campaign.triggeredCount,
      totalEnrollments,
      activeEnrollments,
      completedEnrollments,
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
