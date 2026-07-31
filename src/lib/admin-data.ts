import { getPrisma } from "@/lib/db";
import { mapPhoneNumber, titleCaseStatus } from "@/lib/mappers";
import type { PhoneNumber as PhoneNumberType } from "@/lib/types";
import type { MessagingRegistration, Workspace } from "@prisma/client";

export type AdminRegistration = MessagingRegistration & {
  workspace: Pick<Workspace, "id" | "name">;
};

export type AdminPhoneNumber = PhoneNumberType & {
  customer: string;
  customerId: string;
};

export type AdminCustomer = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: "Trial" | "Paid" | "Active";
  mrr: number;
  messages: number;
  a2p: string;
  risk: "Low" | "Medium" | "High";
  createdAt: Date;
  memberCount: number;
};

type WorkspaceAggregate = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  memberships: Array<{ id: string }>;
  messagingRegistration: {
    brandStatus?: string | null;
    campaignStatus?: string | null;
  } | null;
  campaigns: Array<{ sent: number; optOuts: number }>;
  usageRecords: Array<{ outbound: number }>;
};

export async function loadAdminCustomers(): Promise<AdminCustomer[]> {
  const prisma = getPrisma();
  const workspaces = await prisma.workspace.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      memberships: true,
      messagingRegistration: true,
      campaigns: { select: { sent: true, delivered: true, optOuts: true, costCents: true } },
      usageRecords: { orderBy: { periodStart: "desc" }, take: 1 },
    },
  }) as WorkspaceAggregate[];

  return workspaces.map((ws) => {
    const campaigns = ws.campaigns ?? [];
    const usageRecords = ws.usageRecords ?? [];
    const memberships = ws.memberships ?? [];
    const sent = campaigns.reduce((s: number, c: { sent: number }) => s + c.sent, 0);
    const outbound = usageRecords[0]?.outbound ?? sent;
    const optOuts = campaigns.reduce((s: number, c: { optOuts: number }) => s + c.optOuts, 0);
    const optOutRate = sent > 0 ? optOuts / sent : 0;
    const reg = ws.messagingRegistration;
    const brandOk = (reg?.brandStatus || "").toLowerCase() === "approved";
    const campaignOk = (reg?.campaignStatus || "").toLowerCase() === "approved";
    const a2p = campaignOk && brandOk ? "Approved" : reg ? titleCaseStatus(reg.campaignStatus || reg.brandStatus || "PENDING") : "Pending";

    let risk: AdminCustomer["risk"] = "Low";
    if (optOutRate > 0.02 || (reg?.campaignStatus || "").toLowerCase() === "rejected") risk = "Medium";
    if (optOutRate > 0.05) risk = "High";

    const ageDays = (Date.now() - ws.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const status: AdminCustomer["status"] = ageDays < 30 && outbound < 500 ? "Trial" : "Paid";

    return {
      id: ws.id,
      name: ws.name,
      slug: ws.slug,
      plan: status === "Trial" ? "Growth (Trial)" : "Growth",
      status,
      mrr: status === "Paid" ? 79 : 0,
      messages: outbound,
      a2p,
      risk,
      createdAt: ws.createdAt,
      memberCount: memberships.length,
    };
  });
}

export async function loadAdminCustomerById(id: string): Promise<AdminCustomer | null> {
  const customers = await loadAdminCustomers();
  return customers.find((c) => c.id === id) ?? null;
}

export async function loadAdminPhoneNumbers(): Promise<AdminPhoneNumber[]> {
  const rows = (await getPrisma().phoneNumber.findMany({
    orderBy: { e164: "asc" },
    include: { workspace: { select: { id: true, name: true } } },
  })) as Array<Parameters<typeof mapPhoneNumber>[0] & {
    workspace: { id: string; name: string };
  }>;
  return rows.map((n) => ({
    ...mapPhoneNumber(n),
    customer: n.workspace.name,
    customerId: n.workspace.id,
  }));
}

export async function loadAdminRegistrations(): Promise<AdminRegistration[]> {
  return getPrisma().messagingRegistration.findMany({
    include: { workspace: { select: { id: true, name: true } } },
    orderBy: { registrationSubmittedAt: "desc" },
  });
}

export async function loadAdminUsageTotals() {
  const prisma = getPrisma();
  const [usage, campaigns, numbers] = await Promise.all([
    prisma.usageRecord.findMany({ orderBy: { periodStart: "desc" } }),
    prisma.campaign.findMany({ select: { sent: true, costCents: true, delivered: true } }),
    prisma.phoneNumber.findMany({ select: { monthlyCostCents: true } }),
  ]);

  const usageList = usage ?? [];
  const campaignList = campaigns ?? [];
  const numberList = numbers ?? [];
  const messageVolume = usageList.reduce((s: number, u: { outbound: number }) => s + u.outbound, 0) || campaignList.reduce((s: number, c: { sent: number }) => s + c.sent, 0);
  const costCents = usageList.reduce((s: number, u: { costCents: number }) => s + u.costCents, 0) || campaignList.reduce((s: number, c: { costCents: number }) => s + c.costCents, 0);
  const delivered = campaignList.reduce((s: number, c: { delivered: number }) => s + c.delivered, 0);
  const sent = campaignList.reduce((s: number, c: { sent: number }) => s + c.sent, 0);
  const failed = Math.max(0, sent - delivered);
  const monthlyNumberCost = numberList.reduce((s: number, n: { monthlyCostCents: number }) => s + n.monthlyCostCents, 0) / 100;

  return {
    messageVolume,
    costCents,
    delivered,
    sent,
    failed,
    failureRate: sent > 0 ? (failed / sent) * 100 : 0,
    monthlyNumberCost,
    twilioCost: messageVolume * 0.0085,
    revenue: messageVolume * 0.015,
  };
}

export type AdminAuditEntry = {
  id: string;
  workspaceName: string;
  event: string;
  detail: string;
  actor: string;
  at: string;
};

export async function loadAdminAuditLogs(limit = 50): Promise<AdminAuditEntry[]> {
  const rows = await getPrisma().auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: { select: { name: true } },
      workspace: { select: { name: true } },
    },
  });
  return (rows as Array<{
    id: string;
    event: string;
    detail: string | null;
    createdAt: Date;
    user: { name: string } | null;
    workspace: { name: string } | null;
  }>).map((r) => ({
    id: r.id,
    workspaceName: r.workspace?.name || "—",
    event: r.event,
    detail: r.detail || "",
    actor: r.user?.name || "System",
    at: r.createdAt.toISOString(),
  }));
}

export async function loadAdminRegistrationPipeline() {
  const regs = await loadAdminRegistrations();
  const pipeline = {
    brandSubmitted: 0,
    brandPending: 0,
    campaignDraft: 0,
    campaignRejected: 0,
    campaignApproved: 0,
  };
  for (const r of regs) {
    const brand = (r.brandStatus || "not_started").toLowerCase();
    const campaign = (r.campaignStatus || "not_started").toLowerCase();
    if (brand === "submitted" || brand === "in_review") pipeline.brandPending++;
    else if (brand !== "not_started" && brand !== "draft") pipeline.brandSubmitted++;
    if (campaign === "draft" || campaign === "not_started") pipeline.campaignDraft++;
    else if (campaign === "rejected" || campaign === "failed") pipeline.campaignRejected++;
    else if (campaign === "approved") pipeline.campaignApproved++;
  }
  return pipeline;
}
