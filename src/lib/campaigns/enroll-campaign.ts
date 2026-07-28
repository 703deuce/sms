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

  if (phone) {
    const suppressed = await prisma.suppression.findFirst({
      where: { workspaceId: input.workspaceId, phone },
    });
    if (suppressed) {
      throw new Error("Contact is on the suppression list");
    }
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
      email: input.email,
      displayName: input.displayName,
      workflowStatus,
      currentStep,
      nextActionAt,
      metadata: input.metadata,
    },
  });

  if (campaign.status === "DRAFT") {
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: "SENDING" },
    });
  }

  if (workflowStatus === "in_progress") {
    await advanceRecipient(recipient.id);
  }

  return recipient;
}
