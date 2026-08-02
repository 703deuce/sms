import type {
  AdapterContext,
  AdapterHealth,
  AuthKind,
  CapabilityDefinition,
  CredentialField,
  ExternalProviderId,
  ListPage,
  NormalizedAppointment,
  NormalizedAudience,
  NormalizedContact,
  NormalizedDeal,
  NormalizedEvent,
  NormalizedForm,
  NormalizedFormSubmission,
  NormalizedOrder,
  NormalizedTag,
  NormalizedTicket,
  OAuthProviderConfig,
  UpsertResult,
} from "./types";

/**
 * Thin provider adapter contract for the External Integration Framework.
 * Not every method is required — capability definitions gate unsupported ops.
 */
export interface ExternalIntegrationAdapter {
  readonly id: ExternalProviderId;
  readonly displayName: string;
  readonly authKind: AuthKind;
  readonly oauth?: OAuthProviderConfig;
  readonly credentialFields?: CredentialField[];
  readonly capabilities: CapabilityDefinition;

  parseTokenResponse?(json: Record<string, unknown>): {
    accessToken: string;
    refreshToken?: string | null;
    expiresAt?: Date | null;
    externalId?: string | null;
    meta?: Record<string, unknown>;
  };

  /** Validate credentials / tokens before or after connect. */
  validateConnection(ctx: AdapterContext): Promise<AdapterHealth>;

  identifyAccount(ctx: AdapterContext): Promise<{
    accountId: string;
    accountName: string;
    details?: Record<string, unknown>;
  }>;

  discoverCapabilities?(ctx: AdapterContext): Promise<string[]>;

  listContacts?(
    ctx: AdapterContext,
    cursor?: string | null,
    opts?: { modifiedSince?: Date | null },
  ): Promise<ListPage<NormalizedContact>>;
  upsertContact?(ctx: AdapterContext, contact: NormalizedContact): Promise<UpsertResult>;

  listCompanies?(ctx: AdapterContext, cursor?: string | null): Promise<ListPage<Record<string, unknown>>>;
  listDeals?(ctx: AdapterContext, cursor?: string | null): Promise<ListPage<NormalizedDeal>>;
  upsertDeal?(ctx: AdapterContext, deal: NormalizedDeal): Promise<UpsertResult>;

  listAppointments?(
    ctx: AdapterContext,
    cursor?: string | null,
    opts?: { modifiedSince?: Date | null },
  ): Promise<ListPage<NormalizedAppointment>>;

  listForms?(ctx: AdapterContext, cursor?: string | null): Promise<ListPage<NormalizedForm>>;
  listFormSubmissions?(
    ctx: AdapterContext,
    formId: string,
    cursor?: string | null,
    opts?: { modifiedSince?: Date | null },
  ): Promise<ListPage<NormalizedFormSubmission>>;

  listAudiences?(ctx: AdapterContext, cursor?: string | null): Promise<ListPage<NormalizedAudience>>;
  listTags?(ctx: AdapterContext): Promise<NormalizedTag[]>;
  addTag?(ctx: AdapterContext, externalContactId: string, tag: string): Promise<void>;
  removeTag?(ctx: AdapterContext, externalContactId: string, tag: string): Promise<void>;
  addToList?(ctx: AdapterContext, externalContactId: string, listId: string): Promise<void>;
  removeFromList?(ctx: AdapterContext, externalContactId: string, listId: string): Promise<void>;

  listOrders?(
    ctx: AdapterContext,
    cursor?: string | null,
    opts?: { modifiedSince?: Date | null },
  ): Promise<ListPage<NormalizedOrder>>;
  upsertCustomer?(ctx: AdapterContext, contact: NormalizedContact): Promise<UpsertResult>;
  addOrderNote?(ctx: AdapterContext, orderId: string, note: string): Promise<UpsertResult>;

  listTickets?(
    ctx: AdapterContext,
    cursor?: string | null,
    opts?: { modifiedSince?: Date | null },
  ): Promise<ListPage<NormalizedTicket>>;
  upsertTicket?(ctx: AdapterContext, ticket: NormalizedTicket): Promise<UpsertResult>;
  addTicketComment?(
    ctx: AdapterContext,
    ticketId: string,
    body: string,
    opts?: { private?: boolean },
  ): Promise<UpsertResult>;

  createTask?(
    ctx: AdapterContext,
    task: { title: string; description?: string; dueAt?: string; contactId?: string },
  ): Promise<UpsertResult>;
  createNote?(
    ctx: AdapterContext,
    note: { body: string; contactId?: string; parentId?: string },
  ): Promise<UpsertResult>;

  registerWebhooks?(
    ctx: AdapterContext,
    callbackUrl: string,
  ): Promise<{
    ids: string[];
    signingKey?: string | null;
    /** Presence-only resource keys from provider create response (debug). */
    createResponseKeys?: string[];
  }>;
  removeWebhooks?(ctx: AdapterContext, ids?: string[]): Promise<void>;
  verifyWebhook?(
    headers: Headers,
    rawBody: string,
    secret?: string | null,
  ): Promise<boolean> | boolean;
  normalizeWebhook?(
    workspaceId: string,
    payload: unknown,
    headers?: Headers,
  ): Promise<NormalizedEvent[]> | NormalizedEvent[];

  /** Safe acceptance probe: create a clearly named test record. */
  createTestRecord?(ctx: AdapterContext): Promise<{
    objectType: string;
    externalId: string;
    label: string;
  }>;
  readTestRecord?(
    ctx: AdapterContext,
    objectType: string,
    externalId: string,
  ): Promise<Record<string, unknown> | null>;
  updateTestRecord?(
    ctx: AdapterContext,
    objectType: string,
    externalId: string,
  ): Promise<UpsertResult>;
  cleanupTestRecord?(
    ctx: AdapterContext,
    objectType: string,
    externalId: string,
  ): Promise<void>;

  refreshMetadata?(ctx: AdapterContext): Promise<Record<string, unknown>>;
}

export function unsupported(feature: string): never {
  const err = new Error(`UNSUPPORTED:${feature}`);
  (err as Error & { code: string }).code = "UNSUPPORTED";
  throw err;
}
