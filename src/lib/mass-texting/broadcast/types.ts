/** Mass Texting broadcast campaign — product types (not legacy automation campaigns). */

export type BroadcastAudienceSelection = {
  type: "all" | "list" | "segment" | "contact" | "appointment_preset";
  id: string;
  name: string;
  bookingTypeName?: string;
};

export type BroadcastAudienceDefinition = {
  include: BroadcastAudienceSelection[];
  exclude: BroadcastAudienceSelection[];
};

export type BroadcastScheduleMode = "now" | "later" | "recurring";

export type BroadcastRecurrence = {
  startDate: string;
  interval: number;
  unit: "days" | "weeks" | "months";
  sendHour: number;
  sendMinute: number;
  ampm: "AM" | "PM";
  timezone: string;
  endMode: "never" | "on" | "after";
  endDate?: string;
  endAfter?: number;
  weekdays?: number[];
  runsCompleted?: number;
};

export type BroadcastCampaignConfig = {
  productSource: "mass_text";
  massTexting: true;
  broadcastVersion: 1;
  audience: BroadcastAudienceDefinition;
  numberId?: string;
  scheduleMode: BroadcastScheduleMode;
  timezone?: string;
  recurrence?: BroadcastRecurrence;
  mediaUrls?: string[];
  trackLinks?: boolean;
  trackedLinks?: Array<{ url: string; name: string; tracked: boolean }>;
  messageType: "sms" | "mms";
};

export type BroadcastCampaignInput = {
  name: string;
  message: string;
  audience: BroadcastAudienceDefinition;
  /** Playbook category when created from /playbooks (broadcast | promotion). */
  category?: string | null;
  numberId?: string;
  scheduleMode: BroadcastScheduleMode;
  scheduledAt?: string | null;
  timezone?: string;
  recurrence?: BroadcastRecurrence;
  mediaUrls?: string[];
  trackLinks?: boolean;
  trackedLinks?: Array<{ url: string; name: string; tracked: boolean }>;
};

export type AudiencePreviewResult = {
  selectedCount: number;
  duplicateRemoved: number;
  excludedCount: number;
  suppressedRemoved: number;
  invalidRemoved: number;
  unsubscribedRemoved: number;
  eligibleCount: number;
  eligibleSample: Array<{ contactId: string; name: string; phone: string }>;
};

export type BroadcastRecipientRow = {
  id: string;
  contactId: string | null;
  name: string;
  phone: string;
  status: string;
  skippedReason: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  clickedAt: string | null;
  repliedAt: string | null;
  optedOutAt: string | null;
  failureReason: string | null;
  providerMessageId: string | null;
};
