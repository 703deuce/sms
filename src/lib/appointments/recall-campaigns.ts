import "server-only";

import { randomBytes } from "crypto";
import { getPrisma } from "@/lib/db";
import { loadAppointmentPlatformConfig, saveAppointmentPlatformConfig } from "@/lib/appointments/settings";
import type { RecallCampaign } from "@/lib/appointments/scheduling-capabilities";

export async function listRecallCampaigns(workspaceId: string): Promise<RecallCampaign[]> {
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  return (platform as { recallCampaigns?: RecallCampaign[] }).recallCampaigns || [];
}

export async function saveRecallCampaign(workspaceId: string, campaign: RecallCampaign) {
  const campaigns = await listRecallCampaigns(workspaceId);
  const idx = campaigns.findIndex((c) => c.id === campaign.id);
  const next = idx >= 0 ? campaigns.map((c, i) => (i === idx ? campaign : c)) : [...campaigns, campaign];
  await saveAppointmentPlatformConfig(workspaceId, { recallCampaigns: next } as object);
  return campaign;
}

export async function deleteRecallCampaign(workspaceId: string, campaignId: string) {
  const campaigns = await listRecallCampaigns(workspaceId);
  await saveAppointmentPlatformConfig(workspaceId, {
    recallCampaigns: campaigns.filter((c) => c.id !== campaignId),
  } as object);
}

export type RecallSegment = {
  lastVisitDaysAgo?: number;
  appointmentTypeId?: string;
  appointmentTypeName?: string;
  noFutureAppointment?: boolean;
};

export async function resolveRecallSegmentContacts(
  workspaceId: string,
  segment: RecallSegment,
): Promise<Array<{ contactId: string; phone: string | null; email: string | null; name: string }>> {
  const prisma = getPrisma();
  const since = segment.lastVisitDaysAgo
    ? new Date(Date.now() - segment.lastVisitDaysAgo * 86400000)
    : undefined;

  const appointments = await prisma.voiceAppointment.findMany({
    where: {
      workspaceId,
      ...(segment.appointmentTypeName ? { serviceName: segment.appointmentTypeName } : {}),
      ...(since ? { startsAt: { lte: since } } : {}),
      status: { in: ["completed", "confirmed", "no_show"] },
    },
    orderBy: { startsAt: "desc" },
    take: 500,
    include: { contact: { select: { id: true, phone: true, email: true, firstName: true, lastName: true } } },
  });

  const seen = new Set<string>();
  const results: Array<{ contactId: string; phone: string | null; email: string | null; name: string }> = [];

  for (const appt of appointments) {
    if (!appt.contactId || seen.has(appt.contactId)) continue;
    if (segment.noFutureAppointment) {
      const future = await prisma.voiceAppointment.count({
        where: {
          workspaceId,
          contactId: appt.contactId,
          startsAt: { gte: new Date() },
          status: { notIn: ["canceled", "cancelled", "completed", "no_show"] },
        },
      });
      if (future > 0) continue;
    }
    seen.add(appt.contactId);
    const c = appt.contact;
    results.push({
      contactId: appt.contactId,
      phone: c?.phone || null,
      email: c?.email || null,
      name: `${c?.firstName || ""} ${c?.lastName || ""}`.trim() || "Customer",
    });
  }
  return results;
}

export async function runRecallCampaign(workspaceId: string, campaignId: string) {
  const campaigns = await listRecallCampaigns(workspaceId);
  const campaign = campaigns.find((c) => c.id === campaignId);
  if (!campaign || !campaign.active) throw new Error("Campaign not found or inactive");

  const contacts = await resolveRecallSegmentContacts(workspaceId, campaign.segment || {});
  let sent = 0;

  for (const contact of contacts.slice(0, campaign.maxRecipients || 100)) {
    const body = (campaign.messageTemplate || "We'd love to see you again — book your next appointment.")
      .replace(/\{\{name\}\}/g, contact.name);
    if (campaign.channel === "email" && contact.email) {
      const { sendTransactionalEmail } = await import("@/lib/email/brevo");
      await sendTransactionalEmail({
        workspaceId,
        to: contact.email,
        subject: campaign.subject || "Book your next appointment",
        html: body.replace(/\n/g, "<br/>"),
      });
      sent += 1;
    } else if (contact.phone) {
      const { sendAppointmentSms } = await import("@/lib/appointments/sms-sender");
      await sendAppointmentSms({ workspaceId, to: contact.phone, body });
      sent += 1;
    }
  }

  const updated = { ...campaign, lastRunAt: new Date().toISOString(), lastRunSent: sent };
  await saveRecallCampaign(workspaceId, updated);
  return { sent, targeted: contacts.length };
}

export function newRecallCampaign(): RecallCampaign {
  return {
    id: `rc_${randomBytes(6).toString("hex")}`,
    name: "Reactivation campaign",
    active: true,
    channel: "sms",
    subject: "Book your next appointment",
    messageTemplate: "Hi {{name}}, it's been a while! Reply or book online when you're ready.",
    segment: { noFutureAppointment: true, lastVisitDaysAgo: 90 },
    maxRecipients: 50,
    createdAt: new Date().toISOString(),
  };
}
