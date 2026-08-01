import { getPrisma } from "@/lib/db";
import { NATIVE_PROVIDER_IDS } from "./catalog";
import { getCatalogEntry } from "./catalog";
import { isExternalProvider } from "./registry";

export type ContactExternalLink = {
  provider: string;
  displayName: string;
  objectType: string;
  externalId: string;
  externalUrl: string | null;
  lastSyncedAt: string | null;
  syncStatus: string | null;
  metadata: Record<string, unknown>;
  authKind?: "oauth" | "credentials" | "crm";
};

const CRM_PROVIDERS = ["zoho", "pipedrive", "salesforce"];

function displayNameFor(provider: string) {
  if (isExternalProvider(provider)) return getCatalogEntry(provider).displayName;
  if (provider === "zoho") return "Zoho CRM";
  if (provider === "pipedrive") return "Pipedrive";
  if (provider === "salesforce") return "Salesforce";
  return provider;
}

export async function listExternalLinksForContact(
  workspaceId: string,
  contactId: string,
): Promise<ContactExternalLink[]> {
  const rows = await getPrisma().crmObjectMapping.findMany({
    where: { workspaceId, internalId: contactId },
    orderBy: { lastSyncedAt: "desc" },
    take: 100,
  });

  return rows.map(
    (r: {
      provider: string;
      objectType: string;
      externalId: string;
      externalUrl: string | null;
      lastSyncedAt: Date | null;
      syncStatus: string | null;
      metadataJson: unknown;
    }) => ({
      provider: r.provider,
      displayName: displayNameFor(r.provider),
      objectType: r.objectType,
      externalId: r.externalId,
      externalUrl: r.externalUrl,
      lastSyncedAt: r.lastSyncedAt?.toISOString() || null,
      syncStatus: r.syncStatus,
      metadata: (r.metadataJson || {}) as Record<string, unknown>,
      authKind: CRM_PROVIDERS.includes(r.provider)
        ? "crm"
        : isExternalProvider(r.provider)
          ? getCatalogEntry(r.provider).authKind
          : undefined,
    }),
  );
}

export async function listRecentIntegrationContextForContact(
  workspaceId: string,
  contactId: string,
  limit = 20,
) {
  const prisma = getPrisma();
  const [links, events, appointments, formSubs] = await Promise.all([
    listExternalLinksForContact(workspaceId, contactId),
    prisma.crmWebhookEvent.findMany({
      where: {
        workspaceId,
        OR: [
          { payloadJson: { path: ["contactId"], equals: contactId } },
          // fallback: recent provider events — filtered client-side by contactId in payload
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.voiceAppointment.findMany({
      where: { workspaceId, contactId },
      orderBy: { startsAt: "desc" },
      take: 5,
    }),
    prisma.formSubmission.findMany({
      where: { workspaceId, contactId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { form: { select: { name: true, slug: true } } },
    }),
  ]);

  const filteredEvents = (
    events as Array<{
      id: string;
      provider: string | null;
      eventType: string;
      createdAt: Date;
      payloadJson: unknown;
    }>
  )
    .filter((e) => {
      const p = (e.payloadJson || {}) as Record<string, unknown>;
      return p.contactId === contactId;
    })
    .slice(0, limit)
    .map((e) => ({
      id: e.id,
      provider: e.provider,
      eventType: e.eventType,
      createdAt: e.createdAt.toISOString(),
      payload: e.payloadJson,
    }));

  return {
    links,
    events: filteredEvents,
    appointments: appointments.map(
      (a: {
        id: string;
        serviceName: string | null;
        startsAt: Date;
        endsAt: Date | null;
        status: string;
        externalId: string | null;
        metadata: unknown;
      }) => ({
        id: a.id,
        serviceName: a.serviceName,
        startsAt: a.startsAt.toISOString(),
        endsAt: a.endsAt?.toISOString() || null,
        status: a.status,
        externalId: a.externalId,
        metadata: a.metadata,
      }),
    ),
    formSubmissions: formSubs.map(
      (s: {
        id: string;
        phone: string;
        createdAt: Date;
        payload: unknown;
        form: { name: string; slug: string | null };
      }) => ({
        id: s.id,
        formName: s.form.name,
        formSlug: s.form.slug,
        phone: s.phone,
        createdAt: s.createdAt.toISOString(),
        payload: s.payload,
      }),
    ),
    providerBadges: Array.from(
      new Set([
        ...links.map((l) => l.provider),
        ...filteredEvents.map((e) => e.provider).filter(Boolean),
      ]),
    ).map((p) => ({
      provider: p as string,
      displayName: displayNameFor(p as string),
      native: NATIVE_PROVIDER_IDS.includes(p as (typeof NATIVE_PROVIDER_IDS)[number]),
    })),
  };
}
