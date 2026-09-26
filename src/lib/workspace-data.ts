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
import { visibleContactWhere } from "@/lib/contacts/visible-contacts";
import {
  countVisibleListMembersBulk,
  resolveVisibleContactFilter,
} from "@/lib/contacts/workspace-membership";

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
  return (memberships as Array<{
    workspace: { id: string; name: string; slug: string; type?: string };
  }>).map((m) => mapWorkspace(m.workspace));
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

export async function loadPhoneNumbers(
  workspaceId: string,
  options?: { includeLinked?: boolean },
): Promise<PhoneNumber[]> {
  if (options?.includeLinked) {
    const { loadWorkspaceAccessiblePhoneNumbers, mapAccessiblePhoneToPhoneNumber } = await import(
      "@/lib/numbers/workspace-accessible-numbers"
    );
    const accessible = await loadWorkspaceAccessiblePhoneNumbers(workspaceId);
    return accessible.map(mapAccessiblePhoneToPhoneNumber);
  }

  const rows = await getPrisma().phoneNumber.findMany({
    where: { workspaceId },
    orderBy: { e164: "asc" },
    include: { assignments: { include: { user: { select: { id: true, name: true } } } } },
  });
  return (rows as Parameters<typeof mapPhoneNumber>[0][]).map(mapPhoneNumber);
}

export async function loadContacts(workspaceId: string, status?: string): Promise<Contact[]> {
  const { contacts } = await loadContactsPage(workspaceId, { page: 1, perPage: 200, status });
  return contacts;
}

export async function loadContactStats(workspaceId: string) {
  const prisma = getPrisma();
  const baseWhere = visibleContactWhere(workspaceId);
  const [total, subscribed, unsubscribed] = await Promise.all([
    prisma.contact.count({ where: baseWhere }),
    prisma.contact.count({ where: { ...baseWhere, status: "SUBSCRIBED" } }),
    prisma.contact.count({ where: { ...baseWhere, status: "UNSUBSCRIBED" } }),
  ]);
  return { total, subscribed, unsubscribed };
}

export async function loadContactsPage(
  workspaceId: string,
  opts: { page: number; perPage: number; status?: string; listId?: string },
): Promise<{ contacts: Contact[]; total: number }> {
  const where = await resolveVisibleContactFilter(workspaceId, {
    status: opts.status,
    listId: opts.listId,
  });
  const skip = (Math.max(1, opts.page) - 1) * opts.perPage;
  const [total, rows] = await Promise.all([
    getPrisma().contact.count({ where }),
    getPrisma().contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: opts.perPage,
      include: {
        tagMembers: { include: { tag: true } },
        listMembers: { include: { list: true } },
      },
    }),
  ]);
  const contacts = (rows as Array<Record<string, unknown> & {
    tagMembers?: Array<{ tag: { name: string } }>;
    listMembers?: Array<{ list: { name: string } }>;
  }>).map((c) =>
    mapContact({
      ...c,
      tags: c.tagMembers,
      lists: c.listMembers,
    } as Parameters<typeof mapContact>[0]),
  );
  return { contacts, total };
}

export async function loadContactById(workspaceId: string, id: string) {
  const c = await getPrisma().contact.findFirst({
    where: { id, ...visibleContactWhere(workspaceId) },
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
  contactCount?: number;
};

export async function loadLists(workspaceId: string): Promise<ContactListSummary[]> {
  const { lists } = await loadListsPage(workspaceId, { page: 1, perPage: 500 });
  return lists;
}

export async function loadListsPage(
  workspaceId: string,
  opts: { page: number; perPage: number },
): Promise<{ lists: ContactListSummary[]; total: number }> {
  const skip = (Math.max(1, opts.page) - 1) * opts.perPage;
  const [total, rows] = await Promise.all([
    getPrisma().contactList.count({ where: { workspaceId } }),
    getPrisma().contactList.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
      skip,
      take: opts.perPage,
    }),
  ]);
  const lists = await (async () => {
    const listRows = rows as Array<{ id: string; name: string; description: string | null }>;
    const counts = await countVisibleListMembersBulk(
      workspaceId,
      listRows.map((l) => l.id),
    );
    return listRows.map((l) => ({
      id: l.id,
      name: l.name,
      description: l.description || "",
      contactCount: counts.get(l.id) || 0,
    }));
  })();
  return { lists, total };
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

export async function loadConversations(
  workspaceId: string,
  filters?: import("@/lib/mass-texting/inbox-filters").InboxListFilters,
  userId?: string,
): Promise<Conversation[]> {
  const { buildConversationWhere } = await import("@/lib/mass-texting/inbox-filters");
  const { INBOX_LIST_DEFAULT_TAKE } = await import("@/lib/inbox/inbox-pagination");
  const where = buildConversationWhere(workspaceId, filters ?? { product: "all" }, userId);
  const rows = await getPrisma().conversation.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: INBOX_LIST_DEFAULT_TAKE,
    include: {
      contact: true,
      assignee: { select: { id: true, name: true, email: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      missedCallEvent: { select: { detectedAt: true } },
    },
  });

  type ConversationQueryRow = (typeof rows)[number] & {
    campaignId?: string | null;
    missedCallEvent?: { detectedAt: Date } | null;
  };

  const campaignIds = [
    ...new Set(
      rows
        .map((r: ConversationQueryRow) => r.campaignId)
        .filter((id: string | null | undefined): id is string => Boolean(id)),
    ),
  ];
  const campaigns =
    campaignIds.length > 0
      ? await getPrisma().campaign.findMany({
          where: { workspaceId, id: { in: campaignIds } },
          select: { id: true, name: true },
        })
      : [];
  type CampaignNameRow = { id: string; name: string };
  const campaignNames = new Map(
    (campaigns as CampaignNameRow[]).map((c) => [c.id, c.name] as const),
  );

  return rows.map((row: ConversationQueryRow) =>
    mapConversation({
      ...row,
      campaignName: row.campaignId ? campaignNames.get(row.campaignId) ?? null : null,
      missedCallDetectedAt: row.missedCallEvent?.detectedAt
        ? row.missedCallEvent.detectedAt.toISOString()
        : null,
    }),
  );
}

export async function loadTemplates(workspaceId: string): Promise<Template[]> {
  const rows = await getPrisma().template.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
  });
  return rows.map(mapTemplate);
}

export async function loadAutomations(workspaceId: string): Promise<AutomationFlow[]> {
  const { backfillAgentWorkflows } = await import("@/lib/agents/workflows");
  await backfillAgentWorkflows(workspaceId).catch(() => 0);
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
  return a
    ? {
        ...mapAutomation(a),
        definition: a.definition,
        ownershipKind: a.ownershipKind ?? null,
        ownerAgentId: a.ownerAgentId ?? null,
        ownerLabel: a.ownerLabel ?? null,
      }
    : null;
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
      where: visibleContactWhere(workspaceId),
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
    prisma.phoneNumber.findMany({ where: { workspaceId, status: "Active" } }),
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

  const { pickPreferredSmsSendingNumber, isApprovedMessagingStatus, isHpCertifiedSmsNumber } = await import(
    "@/lib/messaging/preferred-sending-number"
  );
  const { isPhoneMessagingApproved } = await import(
    "@/lib/messaging/compliance/messaging-compliance"
  );
  const preferred = pickPreferredSmsSendingNumber(numbers);
  const campaignOk = isApprovedMessagingStatus(registration?.campaignStatus);
  const numberOk = preferred
    ? isHpCertifiedSmsNumber(preferred.e164 || (preferred as { number?: string }).number) ||
      isPhoneMessagingApproved({
        settingsJson: preferred.settingsJson,
        a2pStatus: preferred.a2pStatus,
        type: preferred.type,
      })
    : false;
  const a2p =
    (campaignOk && (registration?.phoneAttached || numberOk)) || numberOk
      ? "Approved"
      : registration
        ? "Pending"
        : "Pending";

  return {
    a2pStatus: a2p as DashboardMetrics["a2pStatus"],
    activeNumber: preferred?.e164 || registration?.phoneE164 || "No number",
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
  const numbers = await loadPhoneNumbers(workspaceId, { includeLinked: true });
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

/** Unread open inbox threads — canonical Messages sidebar badge (workspace-wide). */
export async function loadInboxUnreadConversationCount(workspaceId: string): Promise<number> {
  return getPrisma()
    .conversation.count({
      where: { workspaceId, unread: true, status: "OPEN" },
    })
    .catch(() => 0);
}

const SHELL_METRICS_DEFAULTS: DashboardMetrics = {
  a2pStatus: "Pending",
  activeNumber: "No number",
  creditsRemaining: 0,
  messagesSentPeriod: 0,
  deliveryRate: 0,
  replyRate: 0,
  clickRate: 0,
  optOutRate: 0,
  contactGrowth: 0,
  balance: 0,
};

/** Sidebar credits badge only — avoids dashboard campaign aggregation on every navigation. */
async function loadShellCreditsRemaining(workspaceId: string): Promise<number> {
  const usage = await getPrisma().usageRecord.findFirst({
    where: { workspaceId },
    orderBy: { periodStart: "desc" },
    select: { costCents: true },
  });
  const costCents = usage?.costCents ?? 0;
  return Math.max(0, 10000 - Math.round(costCents / 2));
}

export async function loadShellData(userId: string, workspaceId: string) {
  const [workspaces, phoneNumbersRaw, creditsRemaining, workspace, unreadNotifications, inboxUnreadCount] =
    await Promise.all([
    loadWorkspacesForUser(userId),
    loadPhoneNumbers(workspaceId, { includeLinked: true }),
    loadShellCreditsRemaining(workspaceId),
    loadWorkspace(workspaceId),
    getPrisma()
      .inAppNotification.count({ where: { workspaceId, userId, readAt: null } })
      .catch(() => 0),
    loadInboxUnreadConversationCount(workspaceId),
  ]);
  const metrics: DashboardMetrics = {
    ...SHELL_METRICS_DEFAULTS,
    creditsRemaining,
  };
  const { sortPhoneNumbersForSms, pickPreferredSmsSendingNumber, scoreSmsSendingNumber } = await import(
    "@/lib/messaging/preferred-sending-number"
  );
  const phoneNumbers = sortPhoneNumbersForSms(
    phoneNumbersRaw.filter((n) => String(n.status || "Active").toLowerCase() === "active"),
  );
  const storedFromId =
    (workspace as { activeFromNumberId?: string | null } | null)?.activeFromNumberId ?? null;
  const stored = storedFromId ? phoneNumbers.find((n) => n.id === storedFromId) : null;
  const preferred = pickPreferredSmsSendingNumber(phoneNumbers);
  const storedIsCompetitive =
    stored && preferred ? scoreSmsSendingNumber(stored) >= scoreSmsSendingNumber(preferred) : Boolean(stored);
  return {
    workspaces,
    phoneNumbers,
    metrics,
    workspace,
    activeFromNumberId: storedIsCompetitive ? storedFromId : preferred?.id ?? storedFromId,
    unreadNotifications,
    inboxUnreadCount,
  };
}
