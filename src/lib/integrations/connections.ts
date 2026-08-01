import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export type ConnectionProvider =
  | "stripe"
  | "google_contacts"
  | "google_sheets"
  | "calendly"
  | "hubspot"
  | "salesforce"
  | "shopify"
  | "zoho"
  | "pipedrive";

export type ConnectionStatus =
  | "connected"
  | "disconnected"
  | "pending_oauth"
  | "needs_reauth"
  | "syncing"
  | "error";

export type ConnectionView = {
  provider: string;
  status: ConnectionStatus;
  externalId: string | null;
  config: Record<string, unknown>;
  lastSyncAt: string | null;
  updatedAt: string | null;
};

/** Providers that authenticate through Google OAuth. */
export const GOOGLE_OAUTH_PROVIDERS = ["google_contacts", "google_sheets"];

export function isStripeEnvConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export async function listConnections(workspaceId: string): Promise<ConnectionView[]> {
  const rows = await getPrisma().integrationConnection.findMany({
    where: { workspaceId },
  });
  type Row = {
    provider: string;
    status: string;
    externalId: string | null;
    configJson: unknown;
    lastSyncAt: Date | null;
    updatedAt: Date | null;
  };
  return (rows as Row[]).map((r) => ({
    provider: r.provider,
    status: r.status as ConnectionStatus,
    externalId: r.externalId,
    // Never leak secret tokens to the client — only expose non-secret config.
    config: sanitizeConfig((r.configJson || {}) as Record<string, unknown>),
    lastSyncAt: r.lastSyncAt?.toISOString() ?? null,
    updatedAt: r.updatedAt?.toISOString() ?? null,
  }));
}

const SECRET_KEYS = ["accessToken", "refreshToken", "apiKey", "signingKey", "secret", "password"];

function sanitizeConfig(config: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    if (SECRET_KEYS.includes(k)) {
      out[`${k}Set`] = Boolean(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export async function getConnection(workspaceId: string, provider: string) {
  return getPrisma().integrationConnection.findUnique({
    where: { workspaceId_provider: { workspaceId, provider } },
  });
}

/** Find a connection by the webhook token stored in its config (inbound routing). */
export async function findConnectionByWebhookToken(provider: string, token: string) {
  if (!token) return null;
  const rows = (await getPrisma().integrationConnection.findMany({
    where: { provider },
  })) as Array<{ id: string; workspaceId: string; configJson: unknown }>;
  return (
    rows.find(
      (r) => (r.configJson as Record<string, unknown> | null)?.webhookToken === token,
    ) || null
  );
}

export async function upsertConnection(input: {
  workspaceId: string;
  provider: string;
  status?: ConnectionStatus;
  externalId?: string | null;
  config?: Record<string, unknown>;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  mergeConfig?: boolean;
  connectedUserId?: string | null;
  connectedAccountName?: string | null;
  lastFailedSyncAt?: Date | null;
  lastError?: string | null;
  syncStatus?: string | null;
  lastSyncAt?: Date | null;
}) {
  const prisma = getPrisma();
  const existing = await getConnection(input.workspaceId, input.provider);
  const config =
    input.mergeConfig && existing?.configJson
      ? { ...(existing.configJson as Record<string, unknown>), ...(input.config || {}) }
      : input.config ?? (existing?.configJson as Record<string, unknown> | undefined);

  return prisma.integrationConnection.upsert({
    where: { workspaceId_provider: { workspaceId: input.workspaceId, provider: input.provider } },
    create: {
      workspaceId: input.workspaceId,
      provider: input.provider,
      status: input.status ?? "connected",
      externalId: input.externalId ?? null,
      accessToken: input.accessToken ?? null,
      refreshToken: input.refreshToken ?? null,
      expiresAt: input.expiresAt ?? null,
      connectedUserId: input.connectedUserId ?? null,
      connectedAccountName: input.connectedAccountName ?? null,
      lastError: input.lastError ?? null,
      syncStatus: input.syncStatus ?? "idle",
      lastSyncAt: input.lastSyncAt ?? null,
      lastFailedSyncAt: input.lastFailedSyncAt ?? null,
      configJson: (config || {}) as object,
    },
    update: {
      ...(input.status ? { status: input.status } : {}),
      ...(input.externalId !== undefined ? { externalId: input.externalId } : {}),
      ...(input.accessToken !== undefined ? { accessToken: input.accessToken } : {}),
      ...(input.refreshToken !== undefined ? { refreshToken: input.refreshToken } : {}),
      ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
      ...(input.connectedUserId !== undefined
        ? { connectedUserId: input.connectedUserId }
        : {}),
      ...(input.connectedAccountName !== undefined
        ? { connectedAccountName: input.connectedAccountName }
        : {}),
      ...(input.lastError !== undefined ? { lastError: input.lastError } : {}),
      ...(input.syncStatus !== undefined ? { syncStatus: input.syncStatus } : {}),
      ...(input.lastSyncAt !== undefined ? { lastSyncAt: input.lastSyncAt } : {}),
      ...(input.lastFailedSyncAt !== undefined
        ? { lastFailedSyncAt: input.lastFailedSyncAt }
        : {}),
      ...(config !== undefined ? { configJson: config as object } : {}),
    },
  });
}

export async function disconnectConnection(workspaceId: string, provider: string) {
  const existing = await getConnection(workspaceId, provider);
  if (!existing) return { ok: true };
  await getPrisma().integrationConnection.update({
    where: { id: existing.id },
    data: {
      status: "disconnected",
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
    },
  });
  return { ok: true };
}

export async function markSynced(workspaceId: string, provider: string, count: number) {
  const existing = await getConnection(workspaceId, provider);
  if (!existing) return;
  const config = { ...((existing.configJson || {}) as Record<string, unknown>), lastSyncCount: count };
  await getPrisma().integrationConnection.update({
    where: { id: existing.id },
    data: { lastSyncAt: new Date(), configJson: config as object },
  });
}

/**
 * Create or update a contact from an external system. Requires a phone number
 * (the Contact model keys on workspaceId+phone). Returns the contact id, or
 * null when there is no usable phone.
 */
export async function upsertExternalContact(input: {
  workspaceId: string;
  phone?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  source?: string;
}): Promise<{ contactId: string; created: boolean } | null> {
  const prisma = getPrisma();
  const phone = input.phone ? normalizeE164(input.phone) : null;

  // Try to match an existing contact by email when there's no phone.
  if (!phone) {
    if (!input.email) return null;
    const byEmail = await prisma.contact.findFirst({
      where: { workspaceId: input.workspaceId, email: input.email },
    });
    if (!byEmail) return null;
    await prisma.contact.update({
      where: { id: byEmail.id },
      data: {
        firstName: byEmail.firstName ?? input.firstName ?? null,
        lastName: byEmail.lastName ?? input.lastName ?? null,
        company: byEmail.company ?? input.company ?? null,
      },
    });
    return { contactId: byEmail.id, created: false };
  }

  const existing = await prisma.contact.findUnique({
    where: { workspaceId_phone: { workspaceId: input.workspaceId, phone } },
  });

  if (existing) {
    await prisma.contact.update({
      where: { id: existing.id },
      data: {
        firstName: existing.firstName ?? input.firstName ?? null,
        lastName: existing.lastName ?? input.lastName ?? null,
        email: existing.email ?? input.email ?? null,
        company: existing.company ?? input.company ?? null,
      },
    });
    return { contactId: existing.id, created: false };
  }

  const created = await prisma.contact.create({
    data: {
      workspaceId: input.workspaceId,
      phone,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      email: input.email ?? null,
      company: input.company ?? null,
      consentSource: input.source || "integration",
    },
  });
  return { contactId: created.id, created: true };
}
