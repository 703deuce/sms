/** Production conversation types for the inbox adapter (decoupled from Kimi mock data). */

export type Tag = {
  id: string;
  name: string;
  color: string;
  description: string;
  created: string;
  untagOnClose: boolean;
};

export type Teammate = {
  id: string;
  name: string;
  initials: string;
  color: string;
};

export type MessageKind = "inbound" | "outbound" | "note" | "event" | "mms" | "other" | "day";

export type Message = {
  id: string;
  kind: MessageKind;
  author?: string;
  initials?: string;
  text?: string;
  time?: string;
  eventText?: string;
  image?: string;
  images?: string[];
  caption?: string;
  isAi?: boolean;
};

export type ConversationStatus = "open" | "pending" | "closed" | "snoozed" | "spam";

export type Conversation = {
  id: string;
  contactId?: string;
  name: string;
  initials: string;
  color: string;
  preview: string;
  ago: string;
  unread?: boolean;
  status: ConversationStatus;
  assignee: string | null;
  tags: string[];
  phone: string;
  email?: string;
  messages: Message[];
  productSource?: string | null;
  productSourceLabel?: string | null;
  campaignId?: string | null;
  campaignName?: string | null;
  fromE164?: string | null;
  repeatCaller?: { missedToday: number; total: number };
  appointmentContext?: {
    id: string;
    serviceName: string | null;
    startsAt: string;
    label: string;
  } | null;
  missedCallEventId?: string | null;
  missedCallDetectedAt?: string | null;
  mctbUrgent?: {
    isUrgent: boolean;
    reason?: string | null;
    summary?: string | null;
    messagePreview?: string | null;
    assessedAt?: string | null;
    ruleVersion?: string | null;
  } | null;
};
