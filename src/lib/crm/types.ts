/**
 * Normalized Transovo CRM objects.
 * Adapters translate between these and provider-specific APIs.
 * Business logic must never speak Salesforce/Zoho/Pipedrive directly.
 */

export type CrmProviderId = "salesforce" | "zoho" | "pipedrive";

export type CrmObjectType =
  | "contact"
  | "company"
  | "lead"
  | "deal"
  | "task"
  | "user"
  | "pipeline"
  | "pipeline_stage"
  | "stage"
  | "note"
  | "call"
  | "sms"
  | "recording"
  | "transcript"
  | "activity"
  | "callback"
  | "tag"
  | "custom_field"
  | "disposition"
  | "attachment";

export type CrmConnectionState =
  | "disconnected"
  | "pending_oauth"
  | "connected"
  | "needs_reauth"
  | "syncing"
  | "error";

export type SyncDirection = "inbound" | "outbound" | "bidirectional";

export type CrmContact = {
  id?: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  companyName?: string | null;
  ownerExternalId?: string | null;
  customFields?: Record<string, unknown>;
  source?: string | null;
  tags?: string[];
  status?: string | null;
};

export type CrmTag = {
  id?: string;
  name: string;
  color?: string | null;
};

export type CrmCustomFieldDefinition = {
  objectType: string;
  name: string;
  label: string;
  dataType:
    | "text"
    | "number"
    | "boolean"
    | "date"
    | "datetime"
    | "url"
    | "picklist"
    | "multipicklist"
    | "owner"
    | "unknown";
  required?: boolean;
  picklistValues?: string[];
};

export type CrmActivity = {
  id?: string;
  type: "task" | "note" | "call" | "sms" | "meeting" | "other";
  subject?: string | null;
  body?: string | null;
  status?: string | null;
  dueAt?: string | null;
  startedAt?: string | null;
  contactExternalId?: string | null;
  ownerExternalId?: string | null;
  updatedAt?: string | null;
};

export type CrmDisposition = {
  code: string;
  label: string;
};

export type CrmCompany = {
  id?: string;
  name: string;
  phone?: string | null;
  website?: string | null;
  ownerExternalId?: string | null;
  customFields?: Record<string, unknown>;
};

export type CrmLead = {
  id?: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  companyName?: string | null;
  source?: string | null;
  status?: string | null;
  ownerExternalId?: string | null;
  customFields?: Record<string, unknown>;
};

export type CrmDeal = {
  id?: string;
  name: string;
  amount?: number | null;
  currency?: string | null;
  stage?: string | null;
  pipeline?: string | null;
  contactExternalId?: string | null;
  companyExternalId?: string | null;
  ownerExternalId?: string | null;
  status?: string | null;
  closeDate?: string | null;
  customFields?: Record<string, unknown>;
};

export type CrmTask = {
  id?: string;
  subject: string;
  description?: string | null;
  dueAt?: string | null;
  status?: string | null;
  priority?: string | null;
  contactExternalId?: string | null;
  ownerExternalId?: string | null;
  relatedType?: string | null;
  relatedExternalId?: string | null;
  customFields?: Record<string, unknown>;
};

export type CrmNote = {
  id?: string;
  body: string;
  contactExternalId?: string | null;
  relatedType?: string | null;
  relatedExternalId?: string | null;
  customFields?: Record<string, unknown>;
};

export type CrmCallActivity = {
  id?: string;
  direction: "inbound" | "outbound" | "missed";
  from?: string | null;
  to?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  durationSeconds?: number | null;
  disposition?: string | null;
  agentName?: string | null;
  notes?: string | null;
  recordingUrl?: string | null;
  transcriptUrl?: string | null;
  transcriptText?: string | null;
  aiSummary?: string | null;
  contactExternalId?: string | null;
  subject?: string | null;
  customFields?: Record<string, unknown>;
};

export type CrmSmsActivity = {
  id?: string;
  direction: "inbound" | "outbound";
  from?: string | null;
  to?: string | null;
  body?: string | null;
  mediaUrls?: string[];
  status?: string | null;
  sentAt?: string | null;
  contactExternalId?: string | null;
  customFields?: Record<string, unknown>;
};

export type CrmUser = {
  id?: string;
  email?: string | null;
  name?: string | null;
  externalId: string;
};

export type CrmPipeline = {
  id: string;
  name: string;
  stages: Array<{ id: string; name: string; order?: number }>;
};

export type CrmDeletionPolicy =
  | "mark_deleted"
  | "archive_local"
  | "disconnect_mapping"
  | "ignore";

export type CrmConflictPolicy =
  | "transovo_wins"
  | "crm_wins"
  | "most_recent"
  | "manual_review";

export type CrmSyncPreferences = {
  autoCreateContacts: boolean;
  autoCreateLeads: boolean;
  autoCreateCompanies: boolean;
  syncRecordings: boolean;
  syncTranscripts: boolean;
  syncNotes: boolean;
  syncSms: boolean;
  syncCalls: boolean;
  syncTasks: boolean;
  syncOpportunities: boolean;
  /** Log voicemails as CRM activities/tasks. */
  syncVoicemail: boolean;
  /** Include AI call summary text when logging calls. */
  syncAiSummary: boolean;
  /** Generic activity logging preference (when supported). */
  syncActivities: boolean;
  /** Pause all sync / push for this connection. */
  syncPaused: boolean;
  /** Disable CRM→Transovo reads while allowing outbound writes. */
  disableReads: boolean;
  /** Disable Transovo→CRM writes while allowing inbound reads. */
  disableWrites: boolean;
  /** Include MMS media URLs when logging SMS activities. */
  syncMms: boolean;
  /** Optional historical CRM activity import (large; off by default). */
  importHistoricalActivities: boolean;
  /**
   * Zoho product profile. Bigin disables Leads and uses a pipeline-centric model.
   * Ignored for Salesforce / Pipedrive.
   */
  zohoProduct?: "crm" | "bigin";
  deletionPolicy: CrmDeletionPolicy;
  conflictPolicy: CrmConflictPolicy;
  defaultOwnerExternalId?: string | null;
  defaultPipelineId?: string | null;
  defaultStageId?: string | null;
  direction: SyncDirection;
  matchByPhone: boolean;
  matchByEmail: boolean;
  createTasksOnMissedCall: boolean;
  createTasksOnCallback: boolean;
  createTasksOnVoicemail: boolean;
  createTasksOnUnreadSms: boolean;
};

export const DEFAULT_SYNC_PREFERENCES: CrmSyncPreferences = {
  autoCreateContacts: true,
  autoCreateLeads: false,
  autoCreateCompanies: true,
  syncRecordings: true,
  syncTranscripts: true,
  syncNotes: true,
  syncSms: true,
  syncCalls: true,
  syncTasks: true,
  syncOpportunities: false,
  syncVoicemail: true,
  syncAiSummary: true,
  syncActivities: true,
  syncPaused: false,
  disableReads: false,
  disableWrites: false,
  syncMms: true,
  importHistoricalActivities: false,
  zohoProduct: "crm",
  deletionPolicy: "mark_deleted",
  conflictPolicy: "manual_review",
  defaultOwnerExternalId: null,
  defaultPipelineId: null,
  defaultStageId: null,
  direction: "bidirectional",
  matchByPhone: true,
  matchByEmail: true,
  createTasksOnMissedCall: true,
  createTasksOnCallback: true,
  createTasksOnVoicemail: true,
  createTasksOnUnreadSms: false,
};

/** Transovo platform events — all integrations subscribe via the runtime event bus. */
export type CrmPlatformEventType =
  | "call.incoming"
  | "call.outgoing"
  | "call.missed"
  | "call.completed"
  | "voicemail.received"
  | "recording.ready"
  | "transcript.ready"
  | "ai_summary.ready"
  | "sms.sent"
  | "sms.delivered"
  | "sms.failed"
  | "sms.received"
  | "contact.created"
  | "contact.updated"
  | "lead.created"
  | "task.created"
  | "task.completed"
  | "callback.scheduled"
  | "appointment.booked"
  | "user.created"
  | "user.updated";

export const ALL_CRM_PLATFORM_EVENT_TYPES: CrmPlatformEventType[] = [
  "call.incoming",
  "call.outgoing",
  "call.missed",
  "call.completed",
  "voicemail.received",
  "recording.ready",
  "transcript.ready",
  "ai_summary.ready",
  "sms.sent",
  "sms.delivered",
  "sms.failed",
  "sms.received",
  "contact.created",
  "contact.updated",
  "lead.created",
  "task.created",
  "task.completed",
  "callback.scheduled",
  "appointment.booked",
  "user.created",
  "user.updated",
];

export type CrmPlatformEvent = {
  type: CrmPlatformEventType;
  workspaceId: string;
  contactId?: string | null;
  occurredAt?: string;
  /** Stable id for dedupe across bus → jobs → webhooks. */
  eventId?: string;
  payload: Record<string, unknown>;
};

export type EventPriority = "high" | "medium" | "low";

export type OAuthProviderConfig = {
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientIdEnv: string;
  clientSecretEnv: string;
  /** Extra authorize query params (e.g. Salesforce prompt). */
  authorizeParams?: Record<string, string>;
  /** Zoho/other regional token hosts may vary — adapter can override. */
  refreshUsesSameTokenUrl?: boolean;
};

export type ConnectorHealth = {
  ok: boolean;
  state: CrmConnectionState;
  message?: string;
  externalAccountId?: string | null;
  externalAccountName?: string | null;
  tokenExpiresAt?: string | null;
};
