import type { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { parseSequence, waitDurationMs, type SequenceStep } from "./sequence-engine";
import { advanceRecipient } from "./sequence-runner";

export type EnrollContactInput = {
  workspaceId: string;
  campaignId: string;
  phone?: string;
  email?: string;
  displayName?: string;
  contactId?: string;
  /** Delay before first sequence action (e.g. webhook job-completed → wait 2h). */
  sendDelayMinutes?: number;
  metadata?: Prisma.InputJsonValue;
};

export async function enrollContactInCampaign(input: EnrollContactInput) {
  const prisma = getPrisma();
  const campaign = await prisma.campaign.findFirst({
    where: { id: input.campaignId, workspaceId: input.workspaceId },
  });
  if (!campaign) throw new Error("Campaign not found");

  const phone = input.phone ? normalizeE164(input.phone) : undefined;
  const email = input.email?.trim().toLowerCase() || undefined;

  if (phone) {
    const suppressed = await prisma.suppression.findFirst({
      where: { workspaceId: input.workspaceId, phone },
    });
    if (suppressed) {
      throw new Error("Contact is on the suppression list");
    }

    const dupe = await prisma.campaignRecipient.findFirst({
      where: {
        campaignId: input.campaignId,
        phone,
        workflowStatus: { notIn: ["completed", "stopped", "failed", "opted_out"] },
      },
    });
    if (dupe) {
      throw new Error("Contact already enrolled in this campaign");
    }
  }

  if (email) {
    const suppressed = await prisma.suppression.findFirst({
      where: { workspaceId: input.workspaceId, email },
    });
    if (suppressed) {
      throw new Error("Email is on the suppression list");
    }

    const dupeEmail = await prisma.campaignRecipient.findFirst({
      where: {
        campaignId: input.campaignId,
        email,
        workflowStatus: { notIn: ["completed", "stopped", "failed", "opted_out"] },
      },
    });
    if (dupeEmail) {
      throw new Error("Contact already enrolled in this campaign");
    }
  }

  if (!phone && !email) {
    throw new Error("phone or email is required to enroll");
  }

  const sequence = parseSequence(campaign.sequenceJson);
  const first = sequence[0] as SequenceStep | undefined;

  let workflowStatus: "waiting" | "in_progress" | "pending" = "in_progress";
  let nextActionAt: Date | null = null;
  let currentStep = first?.step_key || null;

  const delayMs = Math.max(0, Number(input.sendDelayMinutes || 0) * 60_000);

  if (delayMs > 0) {
    workflowStatus = "waiting";
    nextActionAt = new Date(Date.now() + delayMs);
  } else if (first?.step_type === "wait") {
    workflowStatus = "waiting";
    nextActionAt = new Date(Date.now() + waitDurationMs(first.config));
    currentStep = sequence[1]?.step_key || first.step_key;
  }

  const recipient = await prisma.campaignRecipient.create({
    data: {
      workspaceId: input.workspaceId,
      campaignId: input.campaignId,
      contactId: input.contactId,
      phone,
      email,
      displayName: input.displayName,
      workflowStatus,
      currentStep,
      nextActionAt,
      metadata: input.metadata,
    },
  });

  if (campaign.status === "SENDING") {
    // already active
  } else if (campaign.status !== "DRAFT" && campaign.status !== "SCHEDULED" && campaign.status !== "PAUSED") {
    // completed/canceled/failed — still allow enroll into historical? no — only active-ish
  }

  // Do NOT auto-activate DRAFT/SCHEDULED campaigns on enroll — caller must activate.
  // Recipients wait until campaign is SENDING (scheduled activation handled by drain).

  if (workflowStatus === "in_progress" && campaign.status === "SENDING") {
    await advanceRecipient(recipient.id);
  } else if (workflowStatus === "in_progress" && campaign.status !== "SENDING") {
    // Park until campaign is activated
    await prisma.campaignRecipient.update({
      where: { id: recipient.id },
      data: { workflowStatus: "pending", nextActionAt: null },
    });
  }

  return recipient;
}

export type BulkRecipient = {
  phone?: string;
  email?: string;
  displayName?: string;
  contactId?: string;
};

export async function validateBulkRecipients(
  workspaceId: string,
  campaignId: string | null,
  recipients: BulkRecipient[],
) {
  const prisma = getPrisma();
  const accepted: BulkRecipient[] = [];
  const rejected: Array<BulkRecipient & { reason: string }> = [];
  const seenPhones = new Set<string>();
  const seenEmails = new Set<string>();

  for (const r of recipients) {
    let phone: string | undefined;
    try {
      phone = r.phone ? normalizeE164(r.phone) : undefined;
    } catch {
      rejected.push({ ...r, reason: "invalid_phone" });
      continue;
    }
    const email = r.email?.trim().toLowerCase() || undefined;
    if (!phone && !email) {
      rejected.push({ ...r, reason: "missing_address" });
      continue;
    }
    if (phone && seenPhones.has(phone)) {
      rejected.push({ ...r, reason: "duplicate_in_batch" });
      continue;
    }
    if (email && seenEmails.has(email)) {
      rejected.push({ ...r, reason: "duplicate_in_batch" });
      continue;
    }

    if (phone) {
      const suppressed = await prisma.suppression.findFirst({
        where: { workspaceId, phone },
      });
      if (suppressed) {
        rejected.push({ ...r, reason: "suppressed" });
        continue;
      }
      if (campaignId) {
        const active = await prisma.campaignRecipient.findFirst({
          where: {
            campaignId,
            phone,
            workflowStatus: { notIn: ["completed", "stopped", "failed", "opted_out"] },
          },
        });
        if (active) {
          rejected.push({ ...r, reason: "already_enrolled" });
          continue;
        }
      }
      seenPhones.add(phone);
    }

    if (email) {
      const suppressed = await prisma.suppression.findFirst({
        where: { workspaceId, email },
      });
      if (suppressed) {
        rejected.push({ ...r, reason: "suppressed" });
        continue;
      }
      seenEmails.add(email);
    }

    accepted.push({ ...r, phone, email });
  }

  return { accepted, rejected };
}
