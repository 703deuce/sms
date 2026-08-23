import type {
  AutomationFlow,
  Campaign,
  Contact,
  Conversation,
  PhoneNumber,
  StatusChip,
  Template,
  User,
  Workspace,
} from "@/lib/types";

function titleCaseStatus(value: string): StatusChip {
  const map: Record<string, StatusChip> = {
    DRAFT: "Draft",
    SCHEDULED: "Scheduled",
    SENDING: "Sending",
    COMPLETED: "Completed",
    FAILED: "Failed",
    PAUSED: "Paused",
    CANCELED: "Canceled",
    CANCELLED: "Canceled",
    ACTIVE: "Active",
    PENDING: "Pending",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    OPEN: "Open",
    CLOSED: "Closed",
    SUBSCRIBED: "Subscribed",
    UNSUBSCRIBED: "Unsubscribed",
    BLOCKED: "Blocked",
    INVALID: "Invalid",
    ARCHIVED: "Archived",
  };
  return map[value?.toUpperCase?.() || ""] || ((value || "Pending") as StatusChip);
}

export function mapWorkspace(w: {
  id: string;
  name: string;
  slug: string;
  type?: string;
}): Workspace {
  const type =
    w.type === "PERSONAL" || w.type === "BUSINESS" ? w.type : undefined;
  return { id: w.id, name: w.name, slug: w.slug, type };
}

export function mapRole(role: string): User["role"] {
  const map: Record<string, User["role"]> = {
    OWNER: "Owner",
    ADMINISTRATOR: "Administrator",
    MANAGER: "Manager",
    CAMPAIGN_CREATOR: "Campaign creator",
    INBOX_AGENT: "Inbox agent",
    ANALYST: "Analyst",
    READ_ONLY: "Read only",
  };
  return map[role] || "Inbox agent";
}

export function mapPhoneNumber(n: {
  id: string;
  e164: string;
  type: string;
  areaCode: string | null;
  friendlyName: string | null;
  provider?: string | null;
  twilioSid?: string | null;
  providerNumberId?: string | null;
  a2pStatus: string;
  messagingService: string | null;
  monthlyCostCents: number;
  status: string;
  voiceForwardTo?: string | null;
  webhookUrl?: string | null;
  settingsJson?: unknown;
  assignments?: Array<{ userId: string; user?: { id: string; name: string } | null }>;
}): PhoneNumber {
  const assignments = n.assignments || [];
  return {
    id: n.id,
    number: n.e164,
    type: n.type === "Toll-free" || n.type === "toll_free" ? "Toll-free" : "Local",
    areaCode: n.areaCode || n.e164.slice(2, 5) || "",
    friendlyName: n.friendlyName || n.e164,
    provider: n.provider === "twilio" ? "twilio" : "telnyx",
    providerNumberId: n.providerNumberId ?? null,
    twilioSid: n.twilioSid ?? null,
    a2pStatus: titleCaseStatus(n.a2pStatus),
    messagingService: n.messagingService || "Default",
    assignedUsers: assignments
      .map((a) => a.user?.name)
      .filter((name): name is string => Boolean(name)),
    assignedUserIds: assignments.map((a) => a.userId),
    voiceForwardTo: n.voiceForwardTo ?? null,
    webhookUrl: n.webhookUrl ?? null,
    settingsJson:
      n.settingsJson && typeof n.settingsJson === "object"
        ? (n.settingsJson as Record<string, unknown>)
        : null,
    monthlyCost: (n.monthlyCostCents || 0) / 100,
    status: titleCaseStatus(n.status),
  };
}

export function mapContact(c: {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string;
  email: string | null;
  status: string;
  consentSource: string | null;
  consentDate: Date | string | null;
  lastMessaged: Date | string | null;
  lastReply: Date | string | null;
  createdAt?: Date | string;
  assignedUser: string | null;
  company?: string | null;
  customFields?: unknown;
  tags?: Array<{ tag: { name: string } } | { name: string }>;
  lists?: Array<{ list: { name: string } } | { name: string }>;
}): Contact {
  const tags =
    c.tags?.map((t) => ("tag" in t ? t.tag.name : t.name)).filter(Boolean) || [];
  const lists =
    c.lists?.map((l) => ("list" in l ? l.list.name : l.name)).filter(Boolean) || [];
  return {
    id: c.id,
    firstName: c.firstName || "",
    lastName: c.lastName || "",
    phone: c.phone,
    email: c.email || "",
    status: titleCaseStatus(c.status) as Contact["status"],
    lists,
    tags,
    consentSource: c.consentSource || "",
    consentDate: c.consentDate ? new Date(c.consentDate).toISOString().slice(0, 10) : "",
    lastMessaged: c.lastMessaged ? new Date(c.lastMessaged).toISOString().slice(0, 10) : null,
    lastReply: c.lastReply ? new Date(c.lastReply).toISOString().slice(0, 10) : null,
    dateAdded: c.createdAt
      ? new Date(c.createdAt).toISOString().slice(0, 10)
      : "",
    assignedUser: c.assignedUser,
    company: c.company || undefined,
    customFields:
      c.customFields && typeof c.customFields === "object"
        ? (c.customFields as Record<string, string>)
        : undefined,
  };
}

export function mapCampaign(c: {
  id: string;
  name: string;
  type: string;
  audience: string;
  scheduledAt: Date | string | null;
  status: string;
  sent: number;
  delivered: number;
  replies: number;
  clicks: number;
  optOuts: number;
  createdBy: string | null;
  body: string;
  costCents?: number;
  configJson?: unknown;
}): Campaign {
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    audience: c.audience,
    scheduledAt: c.scheduledAt ? new Date(c.scheduledAt).toISOString() : null,
    status: titleCaseStatus(c.status),
    sent: c.sent,
    delivered: c.delivered,
    replies: c.replies,
    clicks: c.clicks,
    optOuts: c.optOuts,
    createdBy: c.createdBy || "",
    body: c.body,
    cost: (c.costCents || 0) / 100,
    configJson: c.configJson,
  };
}

export function mapConversation(c: {
  id: string;
  contactId: string;
  status: string;
  tags: string[];
  unread: boolean;
  updatedAt: Date | string;
  contact?: {
    id: string;
    phone: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  assignee?: { name: string } | null;
  messages?: Array<{
    id: string;
    direction: string;
    body: string;
    userName: string | null;
    createdAt: Date | string;
  }>;
}): Conversation {
  const first = c.contact?.firstName || "";
  const last = c.contact?.lastName || "";
  const name = `${first} ${last}`.trim() || c.contact?.phone || "Unknown";
  const repeatCaller =
    "repeatCaller" in c && c.repeatCaller
      ? (c.repeatCaller as { missedToday: number; total: number })
      : undefined;
  return {
    id: c.id,
    contactId: c.contactId,
    contactName: name,
    phone: c.contact?.phone || "",
    lastMessage: c.messages?.[c.messages.length - 1]?.body || c.messages?.[0]?.body || "",
    assignedTo: c.assignee?.name || null,
    status: titleCaseStatus(c.status) as Conversation["status"],
    tags: c.tags || [],
    updatedAt: new Date(c.updatedAt).toISOString(),
    unread: c.unread,
    repeatCaller,
    messages: (c.messages || [])
      .slice()
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )
      .map((m) => ({
        id: m.id,
        direction: (m.direction === "in" || m.direction === "inbound"
          ? "in"
          : m.direction === "note"
            ? "note"
            : "out") as "in" | "out" | "note",
        body: m.body,
        at: new Date(m.createdAt).toISOString(),
        user: m.userName || undefined,
      })),
  };
}

export function mapTemplate(t: {
  id: string;
  name: string;
  category: string;
  type: string;
  channel: string;
  body: string;
  shared: boolean;
  tags: string[];
}): Template {
  return {
    id: t.id,
    name: t.name,
    category: t.category,
    type: t.type as Template["type"],
    channel: (t.channel === "MMS" ? "MMS" : "SMS") as Template["channel"],
    body: t.body,
    shared: t.shared,
    tags: t.tags || [],
  };
}

export function mapAutomation(a: {
  id: string;
  name: string;
  trigger: string;
  enrolled: number;
  messagesSent: number;
  completionRate: number;
  status: string;
  updatedAt: Date | string;
  sourceSolutionSetupId?: string | null;
  ownerAgentId?: string | null;
  ownershipKind?: string | null;
  ownerLabel?: string | null;
  advancedCustomized?: boolean | null;
  description?: string | null;
}): AutomationFlow {
  const ownershipKind =
    a.ownershipKind ||
    (a.sourceSolutionSetupId || a.description?.startsWith("Generated from ")
      ? "agent_workflow"
      : "standalone");

  const ownedBy =
    a.ownerLabel ||
    (a.description?.startsWith("Generated from ")
      ? a.description.replace(/^Generated from\s+/, "").trim()
      : null);

  const createdFrom =
    ownershipKind === "agent_workflow"
      ? "Agent workflow"
      : a.description?.startsWith("Generated from ")
        ? a.description.replace(/^Generated from\s+/, "")
        : a.sourceSolutionSetupId
          ? "Agent workflow"
          : "Standalone automation";

  return {
    id: a.id,
    name: a.name,
    trigger: a.trigger,
    enrolled: a.enrolled,
    messagesSent: a.messagesSent,
    completionRate: a.completionRate,
    status: titleCaseStatus(a.status),
    updatedAt: new Date(a.updatedAt).toISOString(),
    sourceSolutionSetupId: a.sourceSolutionSetupId ?? null,
    ownerAgentId: a.ownerAgentId ?? null,
    ownershipKind,
    ownerLabel: ownedBy,
    advancedCustomized: Boolean(a.advancedCustomized),
    createdFrom,
    ownedBy,
  };
}

export { titleCaseStatus };
