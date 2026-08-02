import type { ApiKey, IntegrationWebhookEndpoint, Suppression, UsageRecord, Webhook } from "@prisma/client";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import {
  mapAutomation,
  mapCampaign,
  mapContact,
  mapConversation,
  mapPhoneNumber,
  mapRole,
  mapTemplate,
  mapWorkspace,
  titleCaseStatus,
} from "@/lib/mappers";
import type { DashboardMetrics, Campaign, Contact, Conversation, AutomationFlow, PhoneNumber, Template, Workspace, User, StatusChip } from "@/lib/types";

export async function requireWorkspaceContext() {
  const session = await getSession();
  const workspaceId = await getActiveWorkspaceId();
  if (!session || !workspaceId) {
    throw new Error("Unauthorized");
  }
  return { session, workspaceId };
}

export async function loadWorkspacesForUser(userId: string): Promise<Workspace[]> {
  const memberships = await getPrisma().membership.findMany({
    where: { userId },
    include: { workspace: true },
  });
  return (memberships as Array<{ workspace: { id: string; name: string; slug: string } }>).map((m) =>
    mapWorkspace(m.workspace),
  );
}

export type TeamMember = User & { membershipId: string };

export async function loadTeamMembers(workspaceId: string): Promise<TeamMember[]> {
  const memberships = await getPrisma().membership.findMany({
    where: { workspaceId },
    include: { user: true },
  });
  return (memberships as Array<{
    id: string;
    role: string;
    user: { id: string; name: string; email: string; isPlatformAdmin: boolean };
  }>).map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
    role: mapRole(m.role),
    isAdmin: m.user.isPlatformAdmin,
    membershipId: m.id,
  }));
}

export async function loadPhoneNumbers(workspaceId: string): Promise<PhoneNumber[]> {
  const rows = await getPrisma().phoneNumber.findMany({
    where: { workspaceId },
    orderBy: { e164: "asc" },
    include: { assignments: { include: { user: { select: { id: true, name: true } } } } },
  });
  return (rows as Parameters<typeof mapPhoneNumber>[0][]).map(mapPhoneNumber);
}

export async function loadContacts(workspaceId: string, status?: string): Promise<Contact[]> {
  const rows = await getPrisma().contact.findMany({
    where: {
      workspaceId,
      // Hide the synthetic workspace-level automation contact (used only as an FK
      // for event_type.* triggers) from user-facing contact lists.
      NOT: { customFields: { path: ["systemAutomationContact"], equals: true } },
      ...(status
        ? {
            status: status.toUpperCase() as
              | "SUBSCRIBED"
              | "UNSUBSCRIBED"
              | "BLOCKED"
              | "INVALID",
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      tagMembers: { include: { tag: true } },
      listMembers: { include: { list: true } },
    },
  });
  return (rows as Array<Record<string, unknown> & {
    tagMembers?: Array<{ tag: { name: string } }>;
    listMembers?: Array<{ list: { name: string } }>;
  }>).map((c) =>
    mapContact({
      ...c,
      tags: c.tagMembers,
      lists: c.listMembers,
    } as Parameters<typeof mapContact>[0]),
  );
}

export async function loadContactById(workspaceId: string, id: string) {
  const c = await getPrisma().contact.findFirst({
    where: { id, workspaceId },
    include: {
      tagMembers: { include: { tag: true } },
      listMembers: { include: { list: true } },
    },
  });
  return c
    ? mapContact({
        ...c,
        tags: c.tagMembers,
        lists: c.listMembers,
      })
    : null;
}

export type ContactListSummary = {
  id: string;
  name: string;
  description: string;
  contactCount: number;
};

export type SegmentSummary = {
  id: string;
  name: string;
  conditions: unknown;
};

export async function loadLists(workspaceId: string): Promise<ContactListSummary[]> {
  const rows = await getPrisma().contactList.findMany({
    where: { workspaceId },
    include: { _count: { select: { members: true } } },
    orderBy: { name: "asc" },
  });
  return (rows as Array<{ id: string; name: string; description: string | null; _count: { members: number } }>).map((l) => ({
    id: l.id,
    name: l.name,
    description: l.description || "",
    contactCount: l._count.members,
  }));
}

export async function loadTags(workspaceId: string) {
  const rows = await getPrisma().tag.findMany({
    where: { workspaceId },
    include: { _count: { select: { contacts: true } } },
    orderBy: { name: "asc" },
  });
  return (rows as Array<{ id: string; name: string; _count: { contacts: number } }>).map((t) => ({
    id: t.id,
    name: t.name,
    contactCount: t._count.contacts,
  }));
}

export async function loadSegments(workspaceId: string): Promise<SegmentSummary[]> {
  const rows = await getPrisma().segment.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
  });
  return (rows as Array<{ id: string; name: string; conditions: unknown }>).map((s) => ({
    id: s.id,
    name: s.name,
    conditions: s.conditions,
  }));
}

export async function loadCampaigns(workspaceId: string, status?: string): Promise<Campaign[]> {
  const rows = await getPrisma().campaign.findMany({
    where: {
      workspaceId,
      ...(status
        ? {
            status: status.toUpperCase() as
              | "DRAFT"
              | "SCHEDULED"
              | "SENDING"
              | "COMPLETED"
              | "FAILED"
              | "PAUSED"
              | "CANCELED",
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows.map(mapCampaign);
}

export async function loadCampaignById(workspaceId: string, id: string) {
  const c = await getPrisma().campaign.findFirst({
    where: { id, workspaceId },
  });
  return c ? mapCampaign(c) : null;
}

export async function loadConversations(workspaceId: string): Promise<Conversation[]> {
  const rows = await getPrisma().conversation.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      contact: true,
      assignee: { select: { id: true, name: true, email: true } },
      messages: { orderBy: { createdAt: "asc" }, take: 100 },
    },
  });
  return rows.map(mapConversation);
}

export async function loadTemplates(workspaceId: string): Promise<Template[]> {
  const rows = await getPrisma().template.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
  });
  return rows.map(mapTemplate);
}

export async function loadAutomations(workspaceId: string): Promise<AutomationFlow[]> {
  const rows = await getPrisma().automationFlow.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(mapAutomation);
}

export async function loadAutomationById(workspaceId: string, id: string) {
  const a = await getPrisma().automationFlow.findFirst({
    where: { id, workspaceId },
  });
  return a ? { ...mapAutomation(a), definition: a.definition } : null;
}

export async function loadSuppressions(workspaceId: string): Promise<Suppression[]> {
  return getPrisma().suppression.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}

export async function loadRegistration(workspaceId: string) {
  return getPrisma().messagingRegistration.findUnique({
    where: { workspaceId },
  });
}

export async function loadRegistrationEvents(workspaceId: string) {
  return getPrisma().messagingRegistrationEvent.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export type AuditLogEntry = {
  id: string;
  event: string;
  actor: string;
  detail: string;
  at: string;
};

export async function loadAuditLogs(workspaceId: string): Promise<AuditLogEntry[]> {
  const rows = await getPrisma().auditLog.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { name: true } } },
  });
  return (rows as Array<{
    id: string;
    event: string;
    detail: string | null;
    createdAt: Date;
    user: { name: string } | null;
  }>).map((r) => ({
    id: r.id,
    event: r.event,
    actor: r.user?.name || "System",
    detail: r.detail || "",
    at: r.createdAt.toISOString(),
  }));
}

export type CampaignMessageLog = {
  id: string;
  at: string;
  to: string;
  from: string;
  campaign: string;
  status: string;
  segments: number;
  cost: number;
  body: string;
};

export async function loadCampaignMessages(workspaceId: string): Promise<CampaignMessageLog[]> {
  const rows = await getPrisma().campaignMessage.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      campaign: { select: { name: true } },
    },
  });
  return (rows as Array<{
    id: string;
    createdAt: Date;
    to: string;
    body: string;
    status: string;
    campaign: { name: string } | null;
  }>).map((m) => ({
    id: m.id,
    at: m.createdAt.toISOString(),
    to: m.to,
    from: "",
    campaign: m.campaign?.name || "—",
    status: titleCaseStatus(m.status === "delivered" ? "Delivered" : m.status === "failed" ? "Failed" : m.status),
    segments: 1,
    cost: 0.015,
    body: m.body,
  }));
}

export async function loadUsage(workspaceId: string): Promise<UsageRecord[]> {
  return getPrisma().usageRecord.findMany({
    where: { workspaceId },
    orderBy: { periodStart: "desc" },
    take: 12,
  });
}

export async function loadApiKeys(workspaceId: string): Promise<ApiKey[]> {
  return getPrisma().apiKey.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });
}

export async function loadOutboundWebhooks(workspaceId: string): Promise<Webhook[]> {
  return getPrisma().webhook.findMany({
    where: { workspaceId },
  });
}

export async function loadIntegrationEndpoints(workspaceId: string): Promise<IntegrationWebhookEndpoint[]> {
  return getPrisma().integrationWebhookEndpoint.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });
}

export async function loadWorkspace(workspaceId: string) {
  return getPrisma().workspace.findUnique({ where: { id: workspaceId } });
}

export type OptInFormSummary = {
  id: string;
  name: string;
  slug: string | null;
  listName: string;
  url: string | null;
  status: string;
  submissions: number;
  views: number;
};

export async function loadOptInForms(workspaceId: string): Promise<OptInFormSummary[]> {
  const rows = await getPrisma().optInForm.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
  });
  return (rows as Array<{
    id: string;
    name: string;
    slug: string | null;
    listName: string;
    url: string | null;
    status: string;
    submissions: number;
    views: number;
  }>).map((f) => ({
    id: f.id,
    name: f.name,
    slug: f.slug,
    listName: f.listName,
    url: f.url,
    status: f.status,
    submissions: f.submissions,
    views: f.views,
  }));
}

export type IntegrationWebhookEventRow = {
  id: string;
  at: string;
  endpointName: string;
  status: string;
  error: string | null;
};

export async function loadIntegrationWebhookEvents(workspaceId: string): Promise<IntegrationWebhookEventRow[]> {
  const rows = await getPrisma().integrationWebhookEvent.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { endpoint: { select: { name: true } } },
  });
  return (rows as Array<{
    id: string;
    createdAt: Date;
    status: string;
    error: string | null;
    endpoint: { name: string };
  }>).map((e) => ({
    id: e.id,
    at: e.createdAt.toISOString(),
    endpointName: e.endpoint.name,
    status: e.status,
    error: e.error,
  }));
}

function isRecurringCampaign(row: {
  category: string | null;
  type: string;
  scheduledAt: Date | null;
  configJson: unknown;
}) {
  const config = row.configJson as Record<string, unknown> | null;
  if (config?.recurrence && typeof config.recurrence === "object") return true;
  return false;
}

export async function loadRecurringCampaigns(workspaceId: string): Promise<Campaign[]> {
  const rows = await getPrisma().campaign.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows.filter(isRecurringCampaign).map(mapCampaign);
}

export type SubscriberSourceRow = {
  source: string;
  subscribers: number;
  share: number;
  lastAdded: string;
  detail: string;
};

function categorizeConsentSource(source: string | null): string {
  const s = (source || "").toLowerCase();
  if (s.startsWith("form:") || s.includes("form")) return "Form";
  if (s.startsWith("keyword:") || s.includes("keyword")) return "Keyword";
  if (s.includes("qr")) return "QR";
  if (s === "import" || s.includes("import")) return "Import";
  if (s === "manual" || s.includes("manual")) return "Manual";
  if (s.includes("api") || s.includes("webhook") || s.includes("integration")) return "API";
  return "Integration";
}

export async function loadSubscriberSources(workspaceId: string): Promise<SubscriberSourceRow[]> {
  const prisma = getPrisma();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [contacts, forms, keywords, qrCodes] = await Promise.all([
    prisma.contact.findMany({
      where: { workspaceId },
      select: { consentSource: true, consentDate: true, createdAt: true },
    }),
    prisma.optInForm.findMany({ where: { workspaceId }, select: { name: true } }),
    prisma.keyword.findMany({ where: { workspaceId }, select: { keyword: true } }),
    prisma.qrCode.findMany({ where: { workspaceId }, select: { name: true } }),
  ]);

  const recent = (contacts as Array<{
    consentSource: string | null;
    consentDate: Date | null;
    createdAt: Date;
  }>).filter((c) => {
    const at = c.consentDate || c.createdAt;
    return at >= thirtyDaysAgo;
  });

  const buckets: Record<string, { count: number; lastAt: Date | null }> = {
    Form: { count: 0, lastAt: null },
    QR: { count: 0, lastAt: null },
    Keyword: { count: 0, lastAt: null },
    API: { count: 0, lastAt: null },
    Manual: { count: 0, lastAt: null },
    Import: { count: 0, lastAt: null },
    Integration: { count: 0, lastAt: null },
  };

  for (const c of recent) {
    const cat = categorizeConsentSource(c.consentSource);
    const at = c.consentDate || c.createdAt;
    buckets[cat].count += 1;
    if (!buckets[cat].lastAt || at > buckets[cat].lastAt) buckets[cat].lastAt = at;
  }

  const totalNew = Object.entries(buckets)
    .filter(([k]) => k !== "Import")
    .reduce((s, [, v]) => s + v.count, 0);

  const details: Record<string, string> = {
    Form: forms.map((f: { name: string }) => f.name).join(", ") || "No forms",
    QR: qrCodes.map((q: { name: string }) => q.name).join(", ") || "No QR codes",
    Keyword: keywords.map((k: { keyword: string }) => k.keyword).join(", ") || "No keywords",
    API: "REST API contact.create",
    Manual: "Added by team members",
    Import: "CSV/XLSX bulk imports",
    Integration: "Third-party integrations",
  };

  return Object.entries(buckets).map(([source, { count, lastAt }]) => ({
    source,
    subscribers: count,
    share: totalNew > 0 && source !== "Import" ? (count / totalNew) * 100 : source === "Import" ? 0 : 0,
    lastAdded: lastAt ? lastAt.toISOString().slice(0, 10) : "—",
    detail: details[source] || "",
  }));
}

export async function loadDashboardMetrics(workspaceId: string): Promise<DashboardMetrics> {
  const prisma = getPrisma();
  const [registration, numbers, campaigns, contacts, usage] = await Promise.all([
    prisma.messagingRegistration.findUnique({ where: { workspaceId } }),
    prisma.phoneNumber.findMany({ where: { workspaceId, status: "Active" }, take: 1 }),
    prisma.campaign.findMany({ where: { workspaceId }, take: 200 }),
    prisma.contact.count({
      where: {
        workspaceId,
        // Exclude the synthetic automation contact from headline contact metrics.
        NOT: { customFields: { path: ["systemAutomationContact"], equals: true } },
      },
    }),
    prisma.usageRecord.findFirst({
      where: { workspaceId },
      orderBy: { periodStart: "desc" },
    }),
  ]);

  const sent = (campaigns as Array<{ sent?: number }>).reduce((s: number, c) => s + (c.sent || 0), 0);
  const delivered = (campaigns as Array<{ delivered?: number }>).reduce((s: number, c) => s + (c.delivered || 0), 0);
  const replies = (campaigns as Array<{ replies?: number }>).reduce((s: number, c) => s + (c.replies || 0), 0);
  const clicks = (campaigns as Array<{ clicks?: number }>).reduce((s: number, c) => s + (c.clicks || 0), 0);
  const optOuts = (campaigns as Array<{ optOuts?: number }>).reduce((s: number, c) => s + (c.optOuts || 0), 0);
  const costCents = (campaigns as Array<{ costCents?: number }>).reduce((s: number, c) => s + (c.costCents || 0), 0);

  const campaignOk = (registration?.campaignStatus || "").toLowerCase() === "approved";
  const brandOk = (registration?.brandStatus || "").toLowerCase() === "approved";
  const a2p = campaignOk ? "Approved" : brandOk || registration ? "Pending" : "Pending";

  return {
    a2pStatus: a2p as DashboardMetrics["a2pStatus"],
    activeNumber: numbers[0]?.e164 || "No number",
    creditsRemaining: Math.max(0, 10000 - Math.round((usage?.costCents || costCents) / 2)),
    messagesSentPeriod: usage?.outbound || sent,
    deliveryRate: sent > 0 ? Math.round((delivered / sent) * 1000) / 10 : 0,
    replyRate: sent > 0 ? Math.round((replies / sent) * 1000) / 10 : 0,
    clickRate: sent > 0 ? Math.round((clicks / sent) * 1000) / 10 : 0,
    optOutRate: sent > 0 ? Math.round((optOuts / sent) * 1000) / 10 : 0,
    contactGrowth: contacts,
    balance: Math.max(0, 200 - costCents / 100),
  };
}

function stepStatusLabel(status?: string | null) {
  const s = (status || "not_started").toLowerCase();
  if (s === "approved" || s === "complete" || s === "completed") return "Approved";
  if (s === "rejected" || s === "failed") return "Rejected";
  if (s === "pending" || s === "in_review" || s === "submitted") return "Pending";
  if (s === "not_started" || s === "draft") return "Draft";
  return titleCaseStatus(status || "Pending");
}

export async function loadComplianceOverview(workspaceId: string) {
  const reg = await loadRegistration(workspaceId);
  const numbers = await loadPhoneNumbers(workspaceId);
  const brandOk = (reg?.brandStatus || "").toLowerCase() === "approved";
  const campaignOk = (reg?.campaignStatus || "").toLowerCase() === "approved";
  return {
    customerProfile: reg?.legalBusinessName ? "Complete" : "Incomplete",
    brand: stepStatusLabel(reg?.brandStatus),
    campaign: stepStatusLabel(reg?.campaignStatus),
    number: numbers.length || reg?.phoneE164 ? "Assigned" : "Missing",
    ready: Boolean(brandOk && campaignOk && (numbers.length || reg?.phoneE164)),
    businessName: reg?.legalBusinessName || "",
    website: reg?.websiteUrl || "",
    ein: reg?.businessRegistrationId || "",
    useCase: reg?.useCase || "",
    sampleMessages: reg?.sampleMessages || [],
    registration: reg,
  };
}

export async function loadShellData(userId: string, workspaceId: string) {
  const [workspaces, phoneNumbers, metrics, workspace, unreadNotifications] = await Promise.all([
    loadWorkspacesForUser(userId),
    loadPhoneNumbers(workspaceId),
    loadDashboardMetrics(workspaceId),
    loadWorkspace(workspaceId),
    getPrisma()
      .inAppNotification.count({ where: { workspaceId, userId, readAt: null } })
      .catch(() => 0),
  ]);
  return {
    workspaces,
    phoneNumbers,
    metrics,
    activeFromNumberId:
      (workspace as { activeFromNumberId?: string | null } | null)?.activeFromNumberId ?? null,
    unreadNotifications,
  };
}
