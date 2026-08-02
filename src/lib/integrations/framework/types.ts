/**
 * External Integration Framework — shared normalized types.
 * Zoho/Pipedrive stay on the CRM framework; these providers use this layer.
 */

export type ExternalProviderId =
  | "calendly"
  | "mailchimp"
  | "typeform"
  | "activecampaign"
  | "woocommerce"
  | "jotform"
  | "close"
  | "freshdesk"
  | "klaviyo"
  | "highlevel";

export type AuthKind = "oauth" | "credentials";

export type ConnectionHealthStatus =
  | "disconnected"
  | "pending_oauth"
  | "connected"
  | "needs_reauth"
  | "syncing"
  | "paused"
  | "error";

export type FeatureSupport =
  | "read_write"
  | "read_only"
  | "write_only"
  | "unsupported"
  | "subscription_dependent"
  | "scope_dependent";

export type ExternalObjectType =
  | "contact"
  | "company"
  | "lead"
  | "deal"
  | "appointment"
  | "form"
  | "form_submission"
  | "ecommerce_customer"
  | "order"
  | "product"
  | "audience"
  | "segment"
  | "tag"
  | "campaign"
  | "support_contact"
  | "support_ticket"
  | "task"
  | "note"
  | "call_activity"
  | "sms_activity"
  | "external_event"
  | "webhook_subscription"
  | "user"
  | "pipeline"
  | "pipeline_stage"
  | "custom_field";

export type NormalizedEventType =
  | "contact.created"
  | "contact.updated"
  | "contact.deleted"
  | "appointment.scheduled"
  | "appointment.canceled"
  | "appointment.rescheduled"
  | "form.submitted"
  | "lead.submitted"
  | "audience.member_added"
  | "audience.member_updated"
  | "tag.added"
  | "tag.removed"
  | "order.created"
  | "order.paid"
  | "order.status_changed"
  | "order.fulfilled"
  | "customer.updated"
  | "deal.created"
  | "deal.stage_changed"
  | "task.created"
  | "support_ticket.created"
  | "support_ticket.updated"
  | "support_ticket.solved"
  | "profile.updated"
  | "consent.changed";

export type NormalizedActionId =
  | "upsert_contact"
  | "add_tag"
  | "remove_tag"
  | "add_to_list"
  | "remove_from_list"
  | "upsert_deal"
  | "create_task"
  | "create_note"
  | "upsert_ticket"
  | "add_ticket_comment"
  | "upsert_customer"
  | "add_order_note"
  | "update_order_metadata"
  | "create_scheduling_link"
  | "subscribe_marketing"
  | "unsubscribe_marketing";

export type ProviderCategory =
  | "crm_sales"
  | "scheduling_forms"
  | "marketing"
  | "ecommerce"
  | "customer_support";

export type OAuthProviderConfig = {
  authorizationUrl: string;
  tokenUrl: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  scopes: string[];
  authorizeParams?: Record<string, string>;
  /** Optional sandbox authorize/token URLs when separate apps exist. */
  sandboxAuthorizationUrl?: string;
  sandboxTokenUrl?: string;
  sandboxClientIdEnv?: string;
  sandboxClientSecretEnv?: string;
};

export type CredentialField = {
  key: string;
  label: string;
  placeholder?: string;
  type?: "text" | "password" | "url";
  required?: boolean;
  help?: string;
};

export type CapabilityDefinition = {
  objects: Partial<Record<ExternalObjectType, FeatureSupport>>;
  events: Partial<Record<NormalizedEventType, FeatureSupport>>;
  actions: Partial<Record<NormalizedActionId, FeatureSupport>>;
  webhooks: FeatureSupport;
  incrementalSync: FeatureSupport;
  historicalImport: FeatureSupport;
};

export type AdapterHealth = {
  ok: boolean;
  accountId?: string | null;
  accountName?: string | null;
  scopes?: string[];
  capabilities?: string[];
  message?: string;
  details?: Record<string, unknown>;
};

export type ListPage<T> = {
  items: T[];
  nextCursor?: string | null;
};

export type UpsertResult = {
  externalId: string;
  created: boolean;
  externalUrl?: string | null;
};

export type NormalizedContact = {
  id?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  tags?: string[];
  customFields?: Record<string, unknown>;
  updatedAt?: string | null;
  raw?: Record<string, unknown>;
};

export type NormalizedCompany = {
  id?: string | null;
  name?: string | null;
  domain?: string | null;
  phone?: string | null;
  updatedAt?: string | null;
  raw?: Record<string, unknown>;
};

export type NormalizedDeal = {
  id?: string | null;
  title?: string | null;
  amount?: number | null;
  currency?: string | null;
  stageId?: string | null;
  pipelineId?: string | null;
  contactId?: string | null;
  companyId?: string | null;
  status?: string | null;
  updatedAt?: string | null;
  raw?: Record<string, unknown>;
};

export type NormalizedAppointment = {
  id?: string | null;
  title?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  status?: string | null;
  location?: string | null;
  inviteeEmail?: string | null;
  inviteePhone?: string | null;
  inviteeName?: string | null;
  eventTypeId?: string | null;
  cancelUrl?: string | null;
  rescheduleUrl?: string | null;
  updatedAt?: string | null;
  raw?: Record<string, unknown>;
};

export type NormalizedForm = {
  id?: string | null;
  name?: string | null;
  status?: string | null;
  updatedAt?: string | null;
  raw?: Record<string, unknown>;
};

export type NormalizedFormSubmission = {
  id?: string | null;
  formId?: string | null;
  formName?: string | null;
  email?: string | null;
  phone?: string | null;
  answers?: Record<string, unknown>;
  submittedAt?: string | null;
  raw?: Record<string, unknown>;
};

export type NormalizedOrder = {
  id?: string | null;
  number?: string | null;
  status?: string | null;
  total?: string | null;
  currency?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerName?: string | null;
  paidAt?: string | null;
  updatedAt?: string | null;
  raw?: Record<string, unknown>;
};

export type NormalizedTicket = {
  id?: string | null;
  subject?: string | null;
  status?: string | null;
  priority?: string | null;
  requesterEmail?: string | null;
  requesterPhone?: string | null;
  assigneeId?: string | null;
  updatedAt?: string | null;
  raw?: Record<string, unknown>;
};

export type NormalizedAudience = {
  id?: string | null;
  name?: string | null;
  memberCount?: number | null;
  raw?: Record<string, unknown>;
};

export type NormalizedTag = {
  id?: string | null;
  name: string;
  raw?: Record<string, unknown>;
};

export type NormalizedEvent = {
  workspaceId: string;
  provider: ExternalProviderId;
  connectionId?: string | null;
  externalEventId: string;
  eventType: NormalizedEventType;
  occurredAt: string;
  externalObjectType: ExternalObjectType;
  externalObjectId: string;
  contactId?: string | null;
  phone?: string | null;
  email?: string | null;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  rawMeta?: Record<string, unknown>;
};

export type IntegrationPreferences = {
  enableReads: boolean;
  enableWrites: boolean;
  paused: boolean;
  historicalImport: boolean;
  incrementalSync: boolean;
  webhooks: boolean;
  autoCreateContacts: boolean;
  matchByPhone: boolean;
  matchByEmail: boolean;
  duplicatePolicy: "skip" | "update" | "create_always";
  fieldMappings: Record<string, string>;
  includedIds: string[];
  eventSubscriptions: string[];
  deletionBehavior: "ignore" | "mark_deleted" | "disconnect_mapping";
  providerSettings: Record<string, unknown>;
};

export const DEFAULT_INTEGRATION_PREFERENCES: IntegrationPreferences = {
  enableReads: true,
  enableWrites: true,
  paused: false,
  historicalImport: true,
  incrementalSync: true,
  webhooks: true,
  autoCreateContacts: true,
  matchByPhone: true,
  matchByEmail: true,
  duplicatePolicy: "update",
  fieldMappings: {},
  includedIds: [],
  eventSubscriptions: [],
  deletionBehavior: "mark_deleted",
  providerSettings: {},
};

export type AdapterContext = {
  workspaceId: string;
  accessToken: string;
  refreshToken?: string | null;
  meta: Record<string, unknown>;
  preferences: IntegrationPreferences;
};

export type AcceptanceStatus =
  | "Live tested and passed"
  | "Failed and fixed"
  | "Code implemented but not live tested"
  | "Blocked by provider plan/permissions"
  | "Intentionally unsupported";

export type ProviderCatalogEntry = {
  id: ExternalProviderId;
  displayName: string;
  category: ProviderCategory;
  authKind: AuthKind;
  description: string;
  credentialHelp?: string;
  credentialFields?: CredentialField[];
  oauthEnv?: { clientId: string; clientSecret: string; scopes: string[] };
};
