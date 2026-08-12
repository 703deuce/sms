export type StatusChip =
  | "Draft"
  | "Scheduled"
  | "Sending"
  | "Completed"
  | "Failed"
  | "Paused"
  | "Canceled"
  | "Active"
  | "Pending"
  | "Approved"
  | "Rejected"
  | "Open"
  | "Closed"
  | "Subscribed"
  | "Unsubscribed"
  | "Blocked"
  | "Invalid"
  | "Error"
  | "Archived";

export type Role =
  | "Owner"
  | "Administrator"
  | "Manager"
  | "Campaign creator"
  | "Inbox agent"
  | "Analyst"
  | "Read only";

export type Workspace = {
  id: string;
  name: string;
  slug: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isAdmin?: boolean;
};

export type PhoneNumber = {
  id: string;
  number: string;
  type: "Local" | "Toll-free";
  areaCode: string;
  friendlyName: string;
  a2pStatus: StatusChip;
  messagingService: string;
  assignedUsers: string[];
  assignedUserIds?: string[];
  voiceForwardTo?: string | null;
  webhookUrl?: string | null;
  settingsJson?: Record<string, unknown> | null;
  monthlyCost: number;
  status: StatusChip;
};

export type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  status: "Subscribed" | "Unsubscribed" | "Blocked" | "Invalid";
  lists: string[];
  tags: string[];
  consentSource: string;
  consentDate: string;
  lastMessaged: string | null;
  lastReply: string | null;
  dateAdded: string;
  assignedUser: string | null;
  company?: string;
  customFields?: Record<string, string>;
};

export type Campaign = {
  id: string;
  name: string;
  type: string;
  audience: string;
  scheduledAt: string | null;
  status: StatusChip;
  sent: number;
  delivered: number;
  replies: number;
  clicks: number;
  optOuts: number;
  createdBy: string;
  body: string;
  cost: number;
  configJson?: unknown;
};

export type ConversationChannel = "sms" | "email" | "call";

export type Conversation = {
  id: string;
  contactId: string;
  contactName: string;
  phone: string;
  email?: string;
  location?: string;
  lastMessage: string;
  assignedTo: string | null;
  status: "Open" | "Pending" | "Closed" | "Snoozed" | "Spam";
  tags: string[];
  updatedAt: string;
  unread: boolean;
  channel?: ConversationChannel;
  leadType?: string;
  leadStage?: string;
  source?: string;
  messages: Array<{
    id: string;
    direction: "in" | "out" | "note";
    body: string;
    at: string;
    user?: string;
  }>;
};

export type Template = {
  id: string;
  name: string;
  category: string;
  type: "Campaign" | "Inbox reply" | "Automation message" | "Compliance message";
  channel: "SMS" | "MMS";
  body: string;
  shared: boolean;
  tags: string[];
};

export type AutomationFlow = {
  id: string;
  name: string;
  trigger: string;
  enrolled: number;
  messagesSent: number;
  completionRate: number;
  status: StatusChip;
  updatedAt: string;
  sourceSolutionSetupId?: string | null;
  ownerAgentId?: string | null;
  ownershipKind?: "agent_workflow" | "standalone" | string | null;
  ownerLabel?: string | null;
  advancedCustomized?: boolean;
  /** "Agent workflow" | solution name | "Standalone automation" */
  createdFrom?: string | null;
  /** Owning agent display name when this is an agent workflow. */
  ownedBy?: string | null;
};

export type DashboardMetrics = {
  a2pStatus: StatusChip;
  activeNumber: string;
  creditsRemaining: number;
  messagesSentPeriod: number;
  deliveryRate: number;
  replyRate: number;
  clickRate: number;
  optOutRate: number;
  contactGrowth: number;
  balance: number;
};
