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
  | "call"
  | "sms"
  | "recording"
  | "transcript"
  | "note"
  | "activity"
  | "callback"
  | "pipeline"
  | "pipeline_stage";

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
};

export type CrmCompany = {
  id?: string;
  name: string;
  phone?: string | null;
  website?: string | null;
  ownerExternalId?: string | null;
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
};

export type CrmNote = {
  id?: string;
  body: string;
  contactExternalId?: string | null;
  relatedType?: string | null;
  relatedExternalId?: string | null;
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

/** Transovo → CRM publishable events. */
export type CrmPlatformEventType =
  | "call.incoming"
  | "call.outgoing"
  | "call.missed"
  | "call.completed"
  | "voicemail.received"
  | "recording.ready"
  | "transcript.ready"
  | "sms.sent"
  | "sms.received"
  | "contact.created"
  | "contact.updated"
  | "task.created"
  | "callback.scheduled";

export type CrmPlatformEvent = {
  type: CrmPlatformEventType;
  workspaceId: string;
  contactId?: string | null;
  occurredAt?: string;
  payload: Record<string, unknown>;
};

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
