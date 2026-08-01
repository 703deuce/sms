import type {
  ConnectorHealth,
  CrmCallActivity,
  CrmCompany,
  CrmContact,
  CrmDeal,
  CrmLead,
  CrmNote,
  CrmPipeline,
  CrmProviderId,
  CrmSmsActivity,
  CrmSyncPreferences,
  CrmTask,
  CrmUser,
  OAuthProviderConfig,
} from "./types";

export type UpsertResult = {
  externalId: string;
  created: boolean;
  externalUrl?: string | null;
};

export type ListPage<T> = {
  items: T[];
  nextCursor?: string | null;
};

export type ConnectorContext = {
  workspaceId: string;
  accessToken: string;
  refreshToken?: string | null;
  /** Provider-specific: instance URL, API domain, company domain, etc. */
  meta: Record<string, unknown>;
  preferences: CrmSyncPreferences;
};

/**
 * Every CRM implements this interface.
 * Business code talks only to the framework → connector.
 */
export interface CrmConnector {
  readonly id: CrmProviderId;
  readonly displayName: string;
  readonly oauth: OAuthProviderConfig;

  /** After code exchange — parse tokens + account metadata. */
  parseTokenResponse(json: Record<string, unknown>): {
    accessToken: string;
    refreshToken?: string | null;
    expiresAt?: Date | null;
    externalId?: string | null;
    meta?: Record<string, unknown>;
  };

  validateConnection(ctx: ConnectorContext): Promise<ConnectorHealth>;

  listContacts(
    ctx: ConnectorContext,
    cursor?: string | null,
    opts?: { modifiedSince?: Date | null },
  ): Promise<ListPage<CrmContact>>;
  upsertContact(ctx: ConnectorContext, contact: CrmContact): Promise<UpsertResult>;
  findContactByPhone?(ctx: ConnectorContext, phone: string): Promise<CrmContact | null>;
  findContactByEmail?(ctx: ConnectorContext, email: string): Promise<CrmContact | null>;

  listCompanies?(
    ctx: ConnectorContext,
    cursor?: string | null,
    opts?: { modifiedSince?: Date | null },
  ): Promise<ListPage<CrmCompany>>;
  upsertCompany?(ctx: ConnectorContext, company: CrmCompany): Promise<UpsertResult>;

  listLeads?(
    ctx: ConnectorContext,
    cursor?: string | null,
    opts?: { modifiedSince?: Date | null },
  ): Promise<ListPage<CrmLead>>;
  upsertLead?(ctx: ConnectorContext, lead: CrmLead): Promise<UpsertResult>;

  listDeals?(
    ctx: ConnectorContext,
    cursor?: string | null,
    opts?: { modifiedSince?: Date | null },
  ): Promise<ListPage<CrmDeal>>;
  upsertDeal?(ctx: ConnectorContext, deal: CrmDeal): Promise<UpsertResult>;

  createTask?(ctx: ConnectorContext, task: CrmTask): Promise<UpsertResult>;
  updateTask?(ctx: ConnectorContext, task: CrmTask & { id: string }): Promise<UpsertResult>;
  createNote?(ctx: ConnectorContext, note: CrmNote): Promise<UpsertResult>;
  /** Create or update call activity — when call.id is set, must update that record. */
  logCall?(ctx: ConnectorContext, call: CrmCallActivity): Promise<UpsertResult>;
  logSms?(ctx: ConnectorContext, sms: CrmSmsActivity): Promise<UpsertResult>;

  listUsers?(ctx: ConnectorContext): Promise<CrmUser[]>;
  listPipelines?(ctx: ConnectorContext): Promise<CrmPipeline[]>;

  /** Optional field discovery for mapping UI (name = API field). */
  listFields?(
    ctx: ConnectorContext,
  ): Promise<Array<{ objectType: string; name: string; label: string }>>;

  /** Optional provider webhook verification / ingest. */
  handleWebhook?(
    ctx: ConnectorContext,
    headers: Record<string, string>,
    body: unknown,
  ): Promise<{ accepted: boolean; events?: Array<Record<string, unknown>> }>;
}
