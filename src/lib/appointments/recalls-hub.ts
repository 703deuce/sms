import "server-only";

import { getPrisma } from "@/lib/db";
import {
  getNoShowRecoveryConfig,
  getNoShowRecoveryStats,
} from "@/lib/appointments/no-show-recovery";
import {
  listRecallCampaigns,
  resolveRecallSegmentContacts,
} from "@/lib/appointments/recall-campaigns";

export type RecallHubStat = {
  label: string;
  value: string;
  hint: string;
};

export type RecallActivityRow = {
  id: string;
  type: "recall" | "no_show";
  customer: string;
  phone: string;
  detail: string;
  status: "Sent" | "Rebooked" | "Awaiting reply" | "Suppressed";
  time: string;
  channel: "SMS";
  source: string;
  note?: string;
};

function formatPhone(phone?: string | null) {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function formatRelative(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (diffDays === 0) return `Today, ${time}`;
  if (diffDays === 1) return `Yesterday, ${time}`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function mapExecutionStatus(
  state: string,
  appointmentStatus?: string | null,
): RecallActivityRow["status"] {
  if (state === "skipped") return "Suppressed";
  if (appointmentStatus === "confirmed" || appointmentStatus === "scheduled") return "Rebooked";
  if (state === "sent") return "Sent";
  if (state === "failed") return "Suppressed";
  return "Awaiting reply";
}

export async function getRecallHubSummary(workspaceId: string) {
  const campaigns = await listRecallCampaigns(workspaceId);
  const activeCampaigns = campaigns.filter((c) => c.active);
  const noShowConfig = await getNoShowRecoveryConfig(workspaceId);
  const noShowStats = await getNoShowRecoveryStats(workspaceId);

  let eligible = 0;
  const segment = activeCampaigns[0]?.segment || { noFutureAppointment: true, lastVisitDaysAgo: 90 };
  try {
    const contacts = await resolveRecallSegmentContacts(workspaceId, segment);
    eligible = contacts.length;
  } catch {
    eligible = 0;
  }

  const stats: RecallHubStat[] = [
    {
      label: "Customers without a future appointment",
      value: String(eligible),
      hint: "Eligible for recall outreach",
    },
    {
      label: "No-shows this month",
      value: String(noShowStats.noShowsLast30Days),
      hint: noShowStats.workflowInstalled
        ? "No-show recovery workflow active"
        : "Install no-show recovery workflow",
    },
    {
      label: "Rebooked via recall",
      value: String(noShowStats.recoveredBookings),
      hint: "Last 30 days",
    },
    {
      label: "Active recall campaigns",
      value: String(activeCampaigns.length),
      hint: `${campaigns.length} total campaigns`,
    },
  ];

  const recallCampaignsMeta =
    activeCampaigns.length > 0
      ? `${activeCampaigns.length} active campaign${activeCampaigns.length === 1 ? "" : "s"} · ${eligible} eligible customers`
      : "No active campaigns · set up recall outreach";

  const noShowRecoveryMeta = noShowConfig.enabled
    ? `Enabled · ${noShowStats.noShowsLast30Days} no-shows (30d)`
    : "Disabled · turn on automatic follow-up";

  return { stats, recallCampaignsMeta, noShowRecoveryMeta };
}

export async function listRecallActivity(
  workspaceId: string,
  limit = 50,
): Promise<RecallActivityRow[]> {
  const prisma = getPrisma();
  const rows = await prisma.appointmentWorkflowStepExecution.findMany({
    where: {
      workspaceId,
      state: { in: ["sent", "scheduled", "failed", "skipped"] },
      execution: {
        workflow: {
          OR: [
            { templateId: { in: ["no_show_recovery", "re_engagement"] } },
            { name: { contains: "recall", mode: "insensitive" } },
            { name: { contains: "no-show", mode: "insensitive" } },
            { name: { contains: "recovery", mode: "insensitive" } },
          ],
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      execution: {
        select: {
          appointmentId: true,
          workflow: { select: { name: true, templateId: true } },
        },
      },
    },
  });

  const appointmentIds = [
    ...new Set(
      rows
        .map((r: (typeof rows)[number]) => r.execution?.appointmentId)
        .filter((id: string | undefined): id is string => Boolean(id)),
    ),
  ];

  type ApptRow = {
    id: string;
    inviteeName: string | null;
    inviteePhone: string | null;
    serviceName: string | null;
    status: string;
    startsAt: Date;
  };

  const appointments: ApptRow[] = appointmentIds.length
    ? await prisma.voiceAppointment.findMany({
        where: { workspaceId, id: { in: appointmentIds } },
        select: {
          id: true,
          inviteeName: true,
          inviteePhone: true,
          serviceName: true,
          status: true,
          startsAt: true,
        },
      })
    : [];
  const apptById = new Map(appointments.map((a: ApptRow) => [a.id, a]));

  const campaigns = await listRecallCampaigns(workspaceId);
  const campaignActivity: RecallActivityRow[] = campaigns
    .filter((c) => c.lastRunAt)
    .map((c) => ({
      id: `rc-run-${c.id}`,
      type: "recall" as const,
      customer: "Campaign batch",
      phone: "—",
      detail: `Recall campaign "${c.name}" sent to ${c.lastRunSent || 0} customers`,
      status: "Sent" as const,
      time: formatRelative(c.lastRunAt!),
      channel: "SMS" as const,
      source: `Recall campaign — ${c.name}`,
      note: "Segment run completed.",
    }));

  const workflowActivity: RecallActivityRow[] = rows.map((r: (typeof rows)[number]) => {
    const appt = r.execution?.appointmentId
      ? apptById.get(r.execution.appointmentId)
      : undefined;
    const templateId = r.execution?.workflow?.templateId;
    const isNoShow =
      templateId === "no_show_recovery" || appt?.status === "no_show";
    const wfName = r.execution?.workflow?.name || "Workflow";
    const at = r.executedAt?.toISOString() || r.createdAt.toISOString();
    return {
      id: r.id,
      type: isNoShow ? "no_show" : "recall",
      customer: appt?.inviteeName || "Customer",
      phone: formatPhone(appt?.inviteePhone),
      detail: `${isNoShow ? "No-show follow-up" : "Recall message"} — ${appt?.serviceName || "appointment"}`,
      status: mapExecutionStatus(r.state, appt?.status),
      time: formatRelative(at),
      channel: "SMS",
      source: isNoShow ? "No-show recovery" : wfName,
      note: r.failureReason || undefined,
    };
  });

  return [...campaignActivity, ...workflowActivity].slice(0, limit);
}
