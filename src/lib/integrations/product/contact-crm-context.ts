/**
 * CRM + Calendly product context for contact detail, inbox, and pipeline views.
 * Reads local DB only — no live provider HTTP on page load.
 */

import { getPrisma } from "@/lib/db";
import { getCatalogEntry } from "@/lib/integrations/framework/catalog";
import { isExternalProvider } from "@/lib/integrations/framework/registry";
import { listPendingConflicts } from "@/lib/crm/conflicts-ui";
import type { CrmProviderId } from "@/lib/crm/types";

const CRM_PROVIDERS = ["salesforce", "zoho", "pipedrive"] as const;
export const PRODUCT_PROVIDERS = [...CRM_PROVIDERS, "calendly"] as const;

type MappingRow = {
  id: string;
  workspaceId: string;
  provider: string;
  objectType: string;
  internalId: string;
  externalId: string;
  externalUrl: string | null;
  parentExternalId: string | null;
  syncStatus: string;
  lastSyncedAt: Date | null;
  lastCrmModifiedAt: Date | null;
  lastInternalModifiedAt: Date | null;
  syncDirection: string | null;
  metadataJson: unknown;
  updatedAt: Date;
};

export type CrmContextLink = {
  id: string;
  provider: string;
  displayName: string;
  objectType: string;
  name: string | null;
  externalId: string;
  externalUrl: string | null;
  owner: string | null;
  status: string | null;
  company: string | null;
  pipeline: string | null;
  stage: string | null;
  dealValue: number | null;
  currency: string | null;
  source: string | null;
  leadStatus: string | null;
  contactStatus: string | null;
  lastSyncedAt: string | null;
  lastCrmModifiedAt: string | null;
  syncStatus: string;
  pendingSync: boolean;
  syncFailure: boolean;
  conflict: boolean;
  parentExternalId: string | null;
  metadata: Record<string, unknown>;
};

export type CrmContextNote = {
  id: string;
  provider: string;
  displayName: string;
  externalId: string;
  externalUrl: string | null;
  body: string | null;
  author: string | null;
  createdAt: string | null;
  relatedType: string | null;
};

export type CrmContextConflict = {
  id: string;
  provider: string;
  displayName: string;
  externalId: string;
  message: string;
  phone: string | null;
  email: string | null;
  createdAt: string;
};

export type CrmContextEvent = {
  id: string;
  kind: "webhook" | "mapping" | "appointment";
  provider: string;
  sourceLabel: string;
  eventType: string;
  status: string | null;
  createdAt: string;
  lastError?: string | null;
  objectType?: string;
  name?: string | null;
  externalUrl?: string | null;
};

export function displayNameForProvider(provider: string) {
  if (isExternalProvider(provider)) return getCatalogEntry(provider).displayName;
  if (provider === "zoho") return "Zoho CRM";
  if (provider === "pipedrive") return "Pipedrive";
  if (provider === "salesforce") return "Salesforce";
  if (provider === "calendly") return "Calendly";
  return provider;
}

function metaOf(row: MappingRow): Record<string, unknown> {
  return (row.metadataJson || {}) as Record<string, unknown>;
}

function resolveOwnerName(
  ownerExternalId: string | null | undefined,
  userMap: Map<string, string>,
): string | null {
  if (!ownerExternalId) return null;
  return userMap.get(ownerExternalId) || ownerExternalId;
}

function resolvePipelineStageNames(
  meta: Record<string, unknown>,
  pipelineMap: Map<string, string>,
  stageMap: Map<string, string>,
) {
  const pipelineRaw = meta.pipeline as string | undefined;
  const stageRaw = meta.stage as string | undefined;
  const pipeline = pipelineRaw
    ? pipelineMap.get(pipelineRaw) || pipelineRaw
    : null;
  const stage = stageRaw
    ? stageMap.get(stageRaw) || stageRaw
    : (meta.stageName as string) || null;
  return { pipeline, stage, pipelineId: pipelineRaw || null, stageId: stageRaw || null };
}

async function buildLookupMaps(workspaceId: string, providers: string[]) {
  if (!providers.length) {
    return {
      userMap: new Map<string, string>(),
      pipelineMap: new Map<string, string>(),
      stageMap: new Map<string, string>(),
      companyMap: new Map<string, string>(),
    };
  }

  const metaRows = (await getPrisma().crmObjectMapping.findMany({
    where: {
      workspaceId,
      provider: { in: providers },
      objectType: { in: ["user", "pipeline", "pipeline_stage", "stage", "company"] },
    },
  })) as MappingRow[];

  const userMap = new Map<string, string>();
  const pipelineMap = new Map<string, string>();
  const stageMap = new Map<string, string>();
  const companyMap = new Map<string, string>();

  for (const r of metaRows) {
    const m = metaOf(r);
    if (r.objectType === "user") {
      userMap.set(r.externalId, String(m.name || m.email || r.externalId));
    } else if (r.objectType === "pipeline") {
      pipelineMap.set(r.externalId, String(m.name || r.externalId));
    } else if (r.objectType === "pipeline_stage" || r.objectType === "stage") {
      stageMap.set(r.externalId, String(m.name || r.externalId));
    } else if (r.objectType === "company") {
      companyMap.set(r.externalId, String(m.name || r.externalId));
    }
  }

  return { userMap, pipelineMap, stageMap, companyMap };
}

function linkDisplayName(row: MappingRow, meta: Record<string, unknown>): string | null {
  if (meta.name) return String(meta.name);
  if (meta.title) return String(meta.title);
  if (meta.subject) return String(meta.subject);
  if (row.objectType === "contact") return "Contact";
  return null;
}

function mapLinkRow(
  r: MappingRow,
  maps: {
    userMap: Map<string, string>;
    pipelineMap: Map<string, string>;
    stageMap: Map<string, string>;
    companyMap: Map<string, string>;
  },
): CrmContextLink {
  const meta = metaOf(r);
  const { pipeline, stage } = resolvePipelineStageNames(
    meta,
    maps.pipelineMap,
    maps.stageMap,
  );
  const ownerExternalId = meta.ownerExternalId as string | undefined;
  const companyExtId = meta.companyExternalId as string | undefined;
  const statusValue = (meta.status as string) || null;

  return {
    id: r.id,
    provider: r.provider,
    displayName: displayNameForProvider(r.provider),
    objectType: r.objectType,
    name: linkDisplayName(r, meta),
    externalId: r.externalId,
    externalUrl: r.externalUrl,
    owner: resolveOwnerName(ownerExternalId, maps.userMap),
    status: statusValue || r.syncStatus || null,
    company: companyExtId
      ? maps.companyMap.get(companyExtId) || companyExtId
      : null,
    pipeline,
    stage,
    dealValue: meta.amount != null ? Number(meta.amount) : null,
    currency: (meta.currency as string) || null,
    source: (meta.source as string) || null,
    leadStatus: r.objectType === "lead" ? statusValue : null,
    contactStatus: r.objectType === "contact" ? statusValue : null,
    lastSyncedAt: r.lastSyncedAt?.toISOString() || null,
    lastCrmModifiedAt: r.lastCrmModifiedAt?.toISOString() || null,
    syncStatus: r.syncStatus,
    pendingSync: r.syncStatus === "pending",
    syncFailure: r.syncStatus === "error",
    conflict: r.syncStatus === "conflict",
    parentExternalId: r.parentExternalId,
    metadata: meta,
  };
}

export async function getContactCrmContext(workspaceId: string, contactId: string) {
  const prisma = getPrisma();

  const contactMappings = (await prisma.crmObjectMapping.findMany({
    where: { workspaceId, internalId: contactId, objectType: "contact" },
  })) as MappingRow[];

  const contactExternalIds = contactMappings.map((m) => m.externalId);

  const directRelated = (await prisma.crmObjectMapping.findMany({
    where: {
      workspaceId,
      OR: [
        { internalId: contactId },
        ...(contactExternalIds.length
          ? [{ parentExternalId: { in: contactExternalIds } }]
          : []),
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 250,
  })) as MappingRow[];

  let metaLinked: MappingRow[] = [];
  if (contactExternalIds.length) {
    const candidates = (await prisma.crmObjectMapping.findMany({
      where: {
        workspaceId,
        objectType: { in: ["deal", "lead", "task", "note", "activity", "company"] },
      },
      orderBy: { updatedAt: "desc" },
      take: 800,
    })) as MappingRow[];
    metaLinked = candidates.filter((r) => {
      const m = metaOf(r);
      const cExt = m.contactExternalId as string | undefined;
      return cExt && contactExternalIds.includes(cExt);
    });
  }

  const merged = new Map<string, MappingRow>();
  for (const r of [...directRelated, ...metaLinked]) {
    merged.set(r.id, r);
  }
  const linkRows = Array.from(merged.values());

  const providersOnLinks = [...new Set(linkRows.map((r) => r.provider))];
  const lookupMaps = await buildLookupMaps(workspaceId, providersOnLinks);
  const links = linkRows.map((r) => mapLinkRow(r, lookupMaps));

  const connections = (await prisma.integrationConnection.findMany({
    where: { workspaceId, provider: { in: [...PRODUCT_PROVIDERS] } },
  })) as Array<{
    provider: string;
    status: string;
    syncStatus: string | null;
    lastSyncAt: Date | null;
    lastFailedSyncAt: Date | null;
    lastError: string | null;
    connectedAccountName: string | null;
    configJson: unknown;
  }>;

  const providers = PRODUCT_PROVIDERS.map((p) => {
    const conn = connections.find((c) => c.provider === p);
    const cfg = (conn?.configJson || {}) as Record<string, unknown>;
    return {
      provider: p,
      displayName: displayNameForProvider(p),
      status: conn?.status || "disconnected",
      syncStatus: conn?.syncStatus || "idle",
      lastSyncAt: conn?.lastSyncAt?.toISOString() || null,
      lastFailedSyncAt: conn?.lastFailedSyncAt?.toISOString() || null,
      lastError: conn?.lastError || null,
      connectedAccountName: conn?.connectedAccountName || null,
      schedulingUrl: p === "calendly" ? (cfg.schedulingUrl as string) || null : null,
    };
  });

  const apptRows = (await prisma.voiceAppointment.findMany({
    where: { workspaceId, contactId },
    orderBy: { startsAt: "desc" },
    take: 50,
  })) as Array<{
    id: string;
    serviceName: string | null;
    staffName: string | null;
    startsAt: Date;
    endsAt: Date | null;
    status: string;
    externalId: string | null;
    metadata: unknown;
  }>;

  const now = Date.now();
  const appointments = apptRows.map((a) => {
    const meta = (a.metadata || {}) as Record<string, unknown>;
    const startsMs = new Date(a.startsAt).getTime();
    const canceled = /cancel/i.test(a.status);
    return {
      id: a.id,
      serviceName: a.serviceName,
      staffName: a.staffName,
      startsAt: a.startsAt.toISOString(),
      endsAt: a.endsAt?.toISOString() || null,
      status: a.status,
      externalId: a.externalId,
      provider:
        (meta.provider as string) ||
        (a.externalId?.startsWith("calendly:") ? "calendly" : null),
      inviteeName: (meta.inviteeName as string) || null,
      inviteeEmail: (meta.inviteeEmail as string) || null,
      cancelUrl: (meta.cancelUrl as string) || null,
      rescheduleUrl: (meta.rescheduleUrl as string) || null,
      meetingUrl:
        (meta.location as string) ||
        (meta.meetingUrl as string) ||
        (meta.joinUrl as string) ||
        (meta.eventUrl as string) ||
        null,
      eventTypeId: (meta.eventTypeId as string) || null,
      eventTypeName: (meta.eventTypeName as string) || null,
      hostName: (meta.hostName as string) || a.staffName || null,
      isPast: startsMs < now,
      isUpcoming: startsMs >= now && !canceled,
    };
  });

  const upcomingAppointments = appointments.filter((a: { isUpcoming: boolean }) => a.isUpcoming);
  const pastAppointments = appointments.filter(
    (a: { isPast: boolean; status: string }) =>
      a.isPast || /cancel|complete/i.test(a.status),
  );

  const taskRows = (await prisma.integrationTask.findMany({
    where: {
      workspaceId,
      contactId,
      status: {
        in: ["open", "pending", "not_started", "in_progress", "Open", "Not Started"],
      },
    },
    orderBy: { dueAt: "asc" },
    take: 50,
  })) as Array<{
    id: string;
    provider: string;
    externalId: string;
    title: string;
    status: string;
    dueAt: Date | null;
    ownerName: string | null;
    priority: string | null;
    externalUrl: string | null;
    syncStatus: string;
    lastSyncedAt: Date | null;
  }>;

  const openTasks = taskRows.map((t) => ({
    id: t.id,
    provider: t.provider,
    externalId: t.externalId,
    title: t.title,
    status: t.status,
    dueAt: t.dueAt?.toISOString() || null,
    ownerName: t.ownerName || null,
    priority: t.priority || null,
    externalUrl: t.externalUrl || null,
    syncStatus: t.syncStatus,
    lastSyncedAt: t.lastSyncedAt?.toISOString() || null,
  }));

  const deals = links.filter((l) => l.objectType === "deal");
  const leads = links.filter((l) => l.objectType === "lead");
  const companies = links.filter((l) => l.objectType === "company");

  const notes: CrmContextNote[] = links
    .filter((l) => l.objectType === "note")
    .map((l) => {
      const m = l.metadata;
      return {
        id: l.id,
        provider: l.provider,
        displayName: l.displayName,
        externalId: l.externalId,
        externalUrl: l.externalUrl,
        body:
          (m.body as string) ||
          (m.content as string) ||
          (m.note as string) ||
          l.name ||
          null,
        author: (m.author as string) || (m.createdBy as string) || l.owner || null,
        createdAt:
          (m.createdAt as string) || (m.created as string) || l.lastSyncedAt,
        relatedType: (m.relatedType as string) || null,
      };
    })
    .slice(0, 25);

  // Pending duplicate/merge conflicts scoped to this contact (connection config).
  const connectedCrmProviders = providers.filter(
    (p) =>
      (p.status === "connected" || p.status === "syncing") &&
      ["salesforce", "zoho", "pipedrive"].includes(p.provider),
  );
  const conflicts: CrmContextConflict[] = [];
  for (const p of connectedCrmProviders) {
    try {
      const pending = await listPendingConflicts(
        workspaceId,
        p.provider as CrmProviderId,
      );
      for (const c of pending) {
        if (c.contactId !== contactId) continue;
        conflicts.push({
          id: c.id,
          provider: p.provider,
          displayName: p.displayName,
          externalId: c.externalId,
          message: c.message,
          phone: c.phone || null,
          email: c.email || null,
          createdAt: c.createdAt,
        });
      }
    } catch {
      // non-fatal — conflict listing is best-effort
    }
  }

  const webhookEvents = await prisma.crmWebhookEvent.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const webhookEventRows: CrmContextEvent[] = (
    webhookEvents as Array<{
      id: string;
      provider: string;
      eventType: string | null;
      status: string;
      createdAt: Date;
      payloadJson: unknown;
      lastError: string | null;
    }>
  )
    .filter((e) => {
      const p = (e.payloadJson || {}) as Record<string, unknown>;
      return p.contactId === contactId;
    })
    .slice(0, 25)
    .map((e) => ({
      id: e.id,
      kind: "webhook" as const,
      provider: e.provider,
      sourceLabel: displayNameForProvider(e.provider),
      eventType: e.eventType || "webhook.received",
      status: e.status,
      createdAt: e.createdAt.toISOString(),
      lastError: e.lastError || null,
    }));

  const mappingEvents: CrmContextEvent[] = links
    .filter((l) => l.lastSyncedAt)
    .slice(0, 20)
    .map((l) => ({
      id: `mapping-${l.id}`,
      kind: "mapping" as const,
      provider: l.provider,
      sourceLabel: l.displayName,
      eventType: `${l.objectType}.synced`,
      status: l.syncStatus,
      createdAt: l.lastSyncedAt!,
      objectType: l.objectType,
      name: l.name,
      externalUrl: l.externalUrl,
    }));

  const appointmentEvents: CrmContextEvent[] = appointments
    .slice(0, 20)
    .map((a) => ({
      id: `appt-${a.id}`,
      kind: "appointment" as const,
      provider: a.provider || "calendly",
      sourceLabel: displayNameForProvider(a.provider || "calendly"),
      eventType: /cancel/i.test(a.status)
        ? "appointment.canceled"
        : a.isUpcoming
          ? "appointment.scheduled"
          : "appointment.completed",
      status: a.status,
      createdAt: a.startsAt,
      objectType: "appointment",
      name: a.eventTypeName || a.serviceName || "Appointment",
    }));

  const events = [...webhookEventRows, ...mappingEvents, ...appointmentEvents]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 60);

  const externalUrls = links
    .filter((l) => l.externalUrl)
    .map((l) => ({
      provider: l.provider,
      displayName: l.displayName,
      objectType: l.objectType,
      name: l.name,
      url: l.externalUrl!,
    }));

  const connectedProviders = providers.filter(
    (p) => p.status === "connected" || p.status === "syncing",
  );
  const syncStatus = connectedProviders.some((p) => p.syncStatus === "error")
    ? "error"
    : connectedProviders.some((p) => p.syncStatus === "degraded")
      ? "degraded"
      : connectedProviders.length
        ? "healthy"
        : "disconnected";

  const lastSyncErrors = providers
    .filter((p) => p.lastError)
    .map((p) => ({
      provider: p.provider,
      displayName: p.displayName,
      error: p.lastError!,
    }));

  return {
    contactId,
    providers,
    links,
    deals,
    leads,
    companies,
    notes,
    conflicts,
    appointments,
    upcomingAppointments,
    pastAppointments,
    openTasks,
    events,
    syncStatus,
    lastSyncErrors,
    externalUrls,
  };
}

export type PipelineDeal = {
  id: string;
  provider: string;
  displayName: string;
  externalId: string;
  externalUrl: string | null;
  name: string;
  owner: string | null;
  status: string | null;
  company: string | null;
  pipelineId: string | null;
  pipeline: string | null;
  stageId: string | null;
  stage: string | null;
  dealValue: number | null;
  currency: string | null;
  contactExternalId: string | null;
  contactId: string | null;
  contactName: string | null;
  lastActivityAt: string | null;
  nextTask: { title: string; dueAt: string | null } | null;
  upcomingAppointmentAt: string | null;
  upcomingAppointmentName: string | null;
  lastSyncedAt: string | null;
  syncStatus: string;
};

export async function getWorkspacePipelineDeals(workspaceId: string, provider?: string) {
  const prisma = getPrisma();
  const dealRows = (await prisma.crmObjectMapping.findMany({
    where: {
      workspaceId,
      objectType: "deal",
      ...(provider ? { provider } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 500,
  })) as MappingRow[];

  const providers = [...new Set(dealRows.map((r) => r.provider))];
  const lookupMaps = await buildLookupMaps(workspaceId, providers);

  const deals: PipelineDeal[] = dealRows.map((r) => {
    const meta = metaOf(r);
    const { pipeline, stage, pipelineId, stageId } = resolvePipelineStageNames(
      meta,
      lookupMaps.pipelineMap,
      lookupMaps.stageMap,
    );
    const ownerExternalId = meta.ownerExternalId as string | undefined;
    const companyExtId = meta.companyExternalId as string | undefined;

    return {
      id: r.id,
      provider: r.provider,
      displayName: displayNameForProvider(r.provider),
      externalId: r.externalId,
      externalUrl: r.externalUrl,
      name: linkDisplayName(r, meta) || "Deal",
      owner: resolveOwnerName(ownerExternalId, lookupMaps.userMap),
      status: (meta.status as string) || null,
      company: companyExtId
        ? lookupMaps.companyMap.get(companyExtId) || companyExtId
        : null,
      pipelineId,
      pipeline,
      stageId,
      stage,
      dealValue: meta.amount != null ? Number(meta.amount) : null,
      currency: (meta.currency as string) || null,
      contactExternalId:
        (meta.contactExternalId as string) || r.parentExternalId || null,
      contactId: null,
      contactName: null,
      lastActivityAt:
        r.lastSyncedAt?.toISOString() ||
        (r.lastCrmModifiedAt ? r.lastCrmModifiedAt.toISOString() : null) ||
        r.updatedAt.toISOString(),
      nextTask: null,
      upcomingAppointmentAt: null,
      upcomingAppointmentName: null,
      lastSyncedAt: r.lastSyncedAt?.toISOString() || null,
      syncStatus: r.syncStatus,
    };
  });

  // --- Enrich cards with contact / next task / upcoming appointment (batched) ---
  const dealContactExtIds = [
    ...new Set(deals.map((d) => d.contactExternalId).filter(Boolean) as string[]),
  ];
  if (dealContactExtIds.length) {
    const contactMappings = (await prisma.crmObjectMapping.findMany({
      where: {
        workspaceId,
        objectType: "contact",
        ...(provider ? { provider } : { provider: { in: providers } }),
        externalId: { in: dealContactExtIds },
      },
    })) as MappingRow[];

    const extToInternal = new Map<string, string>();
    for (const cm of contactMappings) extToInternal.set(cm.externalId, cm.internalId);
    const internalIds = [...new Set(contactMappings.map((c) => c.internalId))];

    const contactRows = internalIds.length
      ? ((await prisma.contact.findMany({
          where: { id: { in: internalIds }, workspaceId },
          select: { id: true, firstName: true, lastName: true },
        })) as Array<{ id: string; firstName: string | null; lastName: string | null }>)
      : [];
    const nameById = new Map<string, string>();
    for (const c of contactRows) {
      nameById.set(
        c.id,
        `${c.firstName || ""} ${c.lastName || ""}`.trim() || "Contact",
      );
    }

    const now = new Date();
    const [taskRows, apptRows] = internalIds.length
      ? await Promise.all([
          prisma.integrationTask.findMany({
            where: {
              workspaceId,
              contactId: { in: internalIds },
              status: { in: ["open", "pending", "not_started", "in_progress"] },
            },
            orderBy: { dueAt: "asc" },
          }),
          prisma.voiceAppointment.findMany({
            where: {
              workspaceId,
              contactId: { in: internalIds },
              startsAt: { gte: now },
            },
            orderBy: { startsAt: "asc" },
          }),
        ])
      : [[], []];

    const nextTaskByContact = new Map<string, { title: string; dueAt: string | null }>();
    for (const t of taskRows as Array<{
      contactId: string | null;
      title: string;
      dueAt: Date | null;
    }>) {
      if (!t.contactId || nextTaskByContact.has(t.contactId)) continue;
      nextTaskByContact.set(t.contactId, {
        title: t.title,
        dueAt: t.dueAt?.toISOString() || null,
      });
    }
    const apptByContact = new Map<string, { startsAt: string; name: string | null }>();
    for (const a of apptRows as Array<{
      contactId: string | null;
      startsAt: Date;
      serviceName: string | null;
      status: string;
    }>) {
      if (!a.contactId || apptByContact.has(a.contactId)) continue;
      if (/cancel/i.test(a.status)) continue;
      apptByContact.set(a.contactId, {
        startsAt: a.startsAt.toISOString(),
        name: a.serviceName,
      });
    }

    for (const deal of deals) {
      if (!deal.contactExternalId) continue;
      const internalId = extToInternal.get(deal.contactExternalId);
      if (!internalId) continue;
      deal.contactId = internalId;
      deal.contactName = nameById.get(internalId) || null;
      deal.nextTask = nextTaskByContact.get(internalId) || null;
      const appt = apptByContact.get(internalId);
      if (appt) {
        deal.upcomingAppointmentAt = appt.startsAt;
        deal.upcomingAppointmentName = appt.name;
      }
    }
  }

  type StageBucket = {
    stageId: string | null;
    stageName: string;
    deals: PipelineDeal[];
  };

  type PipelineBucket = {
    pipelineId: string | null;
    pipelineName: string;
    provider: string | null;
    stages: Record<string, StageBucket>;
  };

  const pipelineBuckets: Record<string, PipelineBucket> = {};

  for (const deal of deals) {
    const pipelineKey = deal.pipelineId || deal.pipeline || "__unassigned__";
    const pipelineName = deal.pipeline || "Unassigned pipeline";

    if (!pipelineBuckets[pipelineKey]) {
      pipelineBuckets[pipelineKey] = {
        pipelineId: deal.pipelineId,
        pipelineName,
        provider: deal.provider,
        stages: {},
      };
    }

    const stageKey = deal.stageId || deal.stage || "__unassigned__";
    const stageName = deal.stage || "Unassigned stage";
    if (!pipelineBuckets[pipelineKey].stages[stageKey]) {
      pipelineBuckets[pipelineKey].stages[stageKey] = {
        stageId: deal.stageId,
        stageName,
        deals: [],
      };
    }
    pipelineBuckets[pipelineKey].stages[stageKey].deals.push(deal);
  }

  const pipelines = Object.values(pipelineBuckets).map((pg) => ({
    pipelineId: pg.pipelineId,
    pipelineName: pg.pipelineName,
    provider: pg.provider,
    stages: Object.values(pg.stages).sort((a, b) =>
      a.stageName.localeCompare(b.stageName),
    ),
    dealCount: Object.values(pg.stages).reduce((n, s) => n + s.deals.length, 0),
  }));

  const stagesByProvider: Record<
    string,
    Array<{ id: string; name: string; pipelineId?: string }>
  > = {};

  for (const p of providers) {
    const stageRows = (await prisma.crmObjectMapping.findMany({
      where: {
        workspaceId,
        provider: p,
        objectType: { in: ["pipeline_stage", "stage"] },
      },
    })) as MappingRow[];
    stagesByProvider[p] = stageRows.map((r) => ({
      id: r.externalId,
      name: String(metaOf(r).name || r.externalId),
      pipelineId: metaOf(r).pipelineId as string | undefined,
    }));
  }

  // Whether each provider's connection + preferences permit outbound deal
  // writes. The API route ANDs this with the caller's RBAC permission.
  const { getCrmSyncPreferences } = await import("@/lib/crm/settings");
  const { isFeatureSupported } = await import("@/lib/crm/feature-matrix");
  const { CRM_PROVIDER_IDS } = await import("@/lib/crm/registry");
  const writePrefsByProvider: Record<string, boolean> = {};
  for (const p of providers) {
    if (!(CRM_PROVIDER_IDS as readonly string[]).includes(p)) {
      writePrefsByProvider[p] = false;
      continue;
    }
    try {
      const prefs = await getCrmSyncPreferences(workspaceId, p as never);
      writePrefsByProvider[p] =
        isFeatureSupported(p as never, "deals") &&
        !prefs.disableWrites &&
        !prefs.syncPaused &&
        prefs.direction !== "inbound";
    } catch {
      writePrefsByProvider[p] = false;
    }
  }

  return {
    pipelines,
    deals,
    stagesByProvider,
    writePrefsByProvider,
    totalDeals: deals.length,
  };
}

export type ContactCrmSummary = {
  contactId: string;
  crmConnected: boolean;
  provider: string | null;
  providerDisplay: string | null;
  objectType: string | null;
  owner: string | null;
  leadStatus: string | null;
  dealStage: string | null;
  dealValue: number | null;
  dealCurrency: string | null;
  lastCrmSyncAt: string | null;
  syncStatus: string | null;
  syncError: boolean;
  upcomingAppointmentAt: string | null;
  upcomingAppointmentName: string | null;
};

function emptyContactCrmSummary(contactId: string): ContactCrmSummary {
  return {
    contactId,
    crmConnected: false,
    provider: null,
    providerDisplay: null,
    objectType: null,
    owner: null,
    leadStatus: null,
    dealStage: null,
    dealValue: null,
    dealCurrency: null,
    lastCrmSyncAt: null,
    syncStatus: null,
    syncError: false,
    upcomingAppointmentAt: null,
    upcomingAppointmentName: null,
  };
}

/**
 * Batch-load CRM + appointment summary rows for a list of contacts.
 * Uses a handful of `findMany where internalId in ids` queries — never an N+1
 * per-contact loop — so it is safe to call for the full contacts list page.
 */
export async function loadContactCrmSummaries(
  workspaceId: string,
  contactIds: string[],
): Promise<Map<string, ContactCrmSummary>> {
  const result = new Map<string, ContactCrmSummary>();
  const ids = [...new Set(contactIds.filter(Boolean))];
  if (!ids.length) return result;
  for (const id of ids) result.set(id, emptyContactCrmSummary(id));

  const prisma = getPrisma();

  // 1) Contact + lead mappings keyed to our internal contact ids.
  const directMappings = (await prisma.crmObjectMapping.findMany({
    where: {
      workspaceId,
      objectType: { in: ["contact", "lead"] },
      internalId: { in: ids },
    },
    orderBy: { updatedAt: "desc" },
  })) as MappingRow[];

  const byContact = new Map<string, MappingRow[]>();
  const contactExternalIds: string[] = [];
  const externalToInternal = new Map<string, string>();
  for (const row of directMappings) {
    const list = byContact.get(row.internalId) || [];
    list.push(row);
    byContact.set(row.internalId, list);
    if (row.objectType === "contact") {
      contactExternalIds.push(row.externalId);
      externalToInternal.set(`${row.provider}:${row.externalId}`, row.internalId);
    }
  }

  // 2) Deals linked to those contacts (by parentExternalId — set at sync time).
  const dealByContactExt = new Map<string, MappingRow>();
  if (contactExternalIds.length) {
    const extSet = new Set(contactExternalIds);
    const dealRows = (await prisma.crmObjectMapping.findMany({
      where: {
        workspaceId,
        objectType: "deal",
        parentExternalId: { in: contactExternalIds },
      },
      orderBy: { updatedAt: "desc" },
      take: 2000,
    })) as MappingRow[];
    for (const row of dealRows) {
      const m = metaOf(row);
      const cExt =
        (m.contactExternalId as string | undefined) ||
        row.parentExternalId ||
        undefined;
      if (cExt && extSet.has(cExt) && !dealByContactExt.has(cExt)) {
        dealByContactExt.set(cExt, row);
      }
    }
  }

  // 3) Lookup maps (owner / pipeline / stage) for the providers involved.
  const providers = [
    ...new Set([
      ...directMappings.map((r) => r.provider),
      ...Array.from(dealByContactExt.values()).map((r) => r.provider),
    ]),
  ];
  const lookupMaps = await buildLookupMaps(workspaceId, providers);

  // 4) Upcoming appointments for these contacts.
  const now = new Date();
  const apptRows = (await prisma.voiceAppointment.findMany({
    where: {
      workspaceId,
      contactId: { in: ids },
      startsAt: { gte: now },
    },
    orderBy: { startsAt: "asc" },
  })) as Array<{
    contactId: string | null;
    serviceName: string | null;
    startsAt: Date;
    status: string;
  }>;
  const upcomingByContact = new Map<string, { startsAt: Date; name: string | null }>();
  for (const a of apptRows) {
    if (!a.contactId) continue;
    if (/cancel/i.test(a.status)) continue;
    if (upcomingByContact.has(a.contactId)) continue;
    upcomingByContact.set(a.contactId, { startsAt: a.startsAt, name: a.serviceName });
  }

  for (const id of ids) {
    const summary = result.get(id)!;
    const mappings = byContact.get(id) || [];

    const contactMapping = mappings.find((m) => m.objectType === "contact") || null;
    const leadMapping = mappings.find((m) => m.objectType === "lead") || null;
    const primary = contactMapping || leadMapping;

    if (primary) {
      summary.crmConnected = true;
      summary.provider = primary.provider;
      summary.providerDisplay = displayNameForProvider(primary.provider);
      summary.objectType = leadMapping ? "lead" : "contact";
      const meta = metaOf(primary);
      summary.owner = resolveOwnerName(
        meta.ownerExternalId as string | undefined,
        lookupMaps.userMap,
      );
      summary.lastCrmSyncAt = primary.lastSyncedAt?.toISOString() || null;
      summary.syncStatus = primary.syncStatus;
      summary.syncError =
        primary.syncStatus === "error" || primary.syncStatus === "conflict";
    }

    if (leadMapping) {
      const leadMeta = metaOf(leadMapping);
      summary.leadStatus = (leadMeta.status as string) || null;
      if (!summary.lastCrmSyncAt) {
        summary.lastCrmSyncAt = leadMapping.lastSyncedAt?.toISOString() || null;
      }
      if (leadMapping.syncStatus === "error" || leadMapping.syncStatus === "conflict") {
        summary.syncError = true;
      }
    }

    // Deal linkage — check every contact-mapping external id for a matching deal.
    for (const cm of mappings.filter((m) => m.objectType === "contact")) {
      const deal = dealByContactExt.get(cm.externalId);
      if (deal) {
        const dm = metaOf(deal);
        const { stage } = resolvePipelineStageNames(
          dm,
          lookupMaps.pipelineMap,
          lookupMaps.stageMap,
        );
        summary.dealStage = stage;
        summary.dealValue = dm.amount != null ? Number(dm.amount) : null;
        summary.dealCurrency = (dm.currency as string) || null;
        if (deal.syncStatus === "error" || deal.syncStatus === "conflict") {
          summary.syncError = true;
        }
        break;
      }
    }

    const appt = upcomingByContact.get(id);
    if (appt) {
      summary.upcomingAppointmentAt = appt.startsAt.toISOString();
      summary.upcomingAppointmentName = appt.name;
    }
  }

  return result;
}

export type ContactCrmDealLink = {
  provider: string;
  externalId: string;
  externalUrl: string | null;
  name: string | null;
  stage: string | null;
  stageId: string | null;
  pipelineId: string | null;
  value: number | null;
  currency: string | null;
};

export type ContactCrmLinks = {
  contactId: string;
  provider: string | null;
  providerDisplay: string | null;
  objectType: string | null;
  crmRecordUrl: string | null;
  leadUrl: string | null;
  company: string | null;
  companyUrl: string | null;
  deal: ContactCrmDealLink | null;
};

function emptyContactCrmLinks(contactId: string): ContactCrmLinks {
  return {
    contactId,
    provider: null,
    providerDisplay: null,
    objectType: null,
    crmRecordUrl: null,
    leadUrl: null,
    company: null,
    companyUrl: null,
    deal: null,
  };
}

/**
 * Batch-load CRM record + deal linkage for a set of contacts (for the
 * appointments view). Uses `where internalId in ids` — never per-contact loops.
 */
export async function loadContactCrmLinks(
  workspaceId: string,
  contactIds: string[],
): Promise<Map<string, ContactCrmLinks>> {
  const result = new Map<string, ContactCrmLinks>();
  const ids = [...new Set(contactIds.filter(Boolean))];
  if (!ids.length) return result;
  for (const id of ids) result.set(id, emptyContactCrmLinks(id));

  const prisma = getPrisma();
  const directMappings = (await prisma.crmObjectMapping.findMany({
    where: {
      workspaceId,
      objectType: { in: ["contact", "lead"] },
      internalId: { in: ids },
    },
    orderBy: { updatedAt: "desc" },
  })) as MappingRow[];

  const byContact = new Map<string, MappingRow[]>();
  const contactExternalIds: string[] = [];
  for (const row of directMappings) {
    const list = byContact.get(row.internalId) || [];
    list.push(row);
    byContact.set(row.internalId, list);
    if (row.objectType === "contact") contactExternalIds.push(row.externalId);
  }

  const dealByContactExt = new Map<string, MappingRow>();
  if (contactExternalIds.length) {
    const extSet = new Set(contactExternalIds);
    const dealRows = (await prisma.crmObjectMapping.findMany({
      where: {
        workspaceId,
        objectType: "deal",
        parentExternalId: { in: contactExternalIds },
      },
      orderBy: { updatedAt: "desc" },
      take: 2000,
    })) as MappingRow[];
    for (const row of dealRows) {
      const m = metaOf(row);
      const cExt =
        (m.contactExternalId as string | undefined) || row.parentExternalId || undefined;
      if (cExt && extSet.has(cExt) && !dealByContactExt.has(cExt)) {
        dealByContactExt.set(cExt, row);
      }
    }
  }

  const providers = [
    ...new Set([
      ...directMappings.map((r) => r.provider),
      ...Array.from(dealByContactExt.values()).map((r) => r.provider),
    ]),
  ];
  const lookupMaps = await buildLookupMaps(workspaceId, providers);

  for (const id of ids) {
    const links = result.get(id)!;
    const mappings = byContact.get(id) || [];
    const contactMapping = mappings.find((m) => m.objectType === "contact") || null;
    const leadMapping = mappings.find((m) => m.objectType === "lead") || null;
    const primary = contactMapping || leadMapping;

    if (primary) {
      links.provider = primary.provider;
      links.providerDisplay = displayNameForProvider(primary.provider);
      links.objectType = contactMapping ? "contact" : "lead";
      links.crmRecordUrl = primary.externalUrl;
      const meta = metaOf(primary);
      const companyExtId = meta.companyExternalId as string | undefined;
      if (companyExtId) {
        links.company = lookupMaps.companyMap.get(companyExtId) || companyExtId;
      }
    }
    if (leadMapping) {
      links.leadUrl = leadMapping.externalUrl;
    }

    for (const cm of mappings.filter((m) => m.objectType === "contact")) {
      const deal = dealByContactExt.get(cm.externalId);
      if (deal) {
        const dm = metaOf(deal);
        const { stage, stageId, pipelineId } = resolvePipelineStageNames(
          dm,
          lookupMaps.pipelineMap,
          lookupMaps.stageMap,
        );
        links.deal = {
          provider: deal.provider,
          externalId: deal.externalId,
          externalUrl: deal.externalUrl,
          name: linkDisplayName(deal, dm) || "Deal",
          stage,
          stageId,
          pipelineId,
          value: dm.amount != null ? Number(dm.amount) : null,
          currency: (dm.currency as string) || null,
        };
        break;
      }
    }
  }

  return result;
}

export type StageOption = { id: string; name: string; pipelineId?: string };

/** Available deal stages per provider (for read-only + inline stage moves). */
export async function loadStagesByProvider(
  workspaceId: string,
  providers: string[],
): Promise<Record<string, StageOption[]>> {
  const out: Record<string, StageOption[]> = {};
  const list = [...new Set(providers.filter(Boolean))];
  if (!list.length) return out;
  const rows = (await getPrisma().crmObjectMapping.findMany({
    where: {
      workspaceId,
      provider: { in: list },
      objectType: { in: ["pipeline_stage", "stage"] },
    },
  })) as MappingRow[];
  for (const r of rows) {
    const m = metaOf(r);
    (out[r.provider] ||= []).push({
      id: r.externalId,
      name: String(m.name || r.externalId),
      pipelineId: (m.pipelineId as string) || undefined,
    });
  }
  return out;
}

export async function getIntegrationMetadata(
  workspaceId: string,
  provider: string,
) {
  const prisma = getPrisma();
  const conn = await prisma.integrationConnection.findUnique({
    where: { workspaceId_provider: { workspaceId, provider } },
  });

  const cfg = (conn?.configJson || {}) as Record<string, unknown>;
  const secretsPresence = {
    accessTokenSet: Boolean(conn?.accessToken),
    refreshTokenSet: Boolean(conn?.refreshToken),
    signingKeySet: Boolean(cfg.signingKey),
    apiKeySet: Boolean(cfg.apiKey),
  };

  if (provider === "calendly") {
    let eventTypes: Array<{ id: string; name: string; schedulingUrl?: string }> = [];

    const meta = cfg.metadata as Record<string, unknown> | undefined;
    const fromMeta = meta?.eventTypes;
    if (Array.isArray(fromMeta)) {
      eventTypes = fromMeta.map((et) => {
        const row = et as Record<string, unknown>;
        return {
          id: String(row.uri || row.id || ""),
          name: String(row.name || "Event type"),
          schedulingUrl:
            typeof row.scheduling_url === "string" ? row.scheduling_url : undefined,
        };
      });
    }

    if (
      !eventTypes.length &&
      conn?.accessToken &&
      conn.status === "connected"
    ) {
      try {
        const { getAdapter } = await import("@/lib/integrations/framework/registry");
        const { buildAdapterContext } = await import("@/lib/integrations/framework/context");
        const adapter = getAdapter("calendly");
        if (adapter.refreshMetadata) {
          const ctx = await buildAdapterContext(workspaceId, "calendly");
          const refreshed = await adapter.refreshMetadata(ctx);
          const collection = (refreshed.eventTypes as Array<Record<string, unknown>>) || [];
          eventTypes = collection.map((row) => ({
            id: String(row.uri || ""),
            name: String(row.name || "Event type"),
            schedulingUrl:
              typeof row.scheduling_url === "string" ? row.scheduling_url : undefined,
          }));
        }
      } catch {
        // non-fatal — return cached config only
      }
    }

    return {
      provider,
      displayName: displayNameForProvider(provider),
      status: conn?.status || "disconnected",
      schedulingUrl: (cfg.schedulingUrl as string) || null,
      timezone: (cfg.timezone as string) || null,
      eventTypes,
      secretsPresence,
    };
  }

  if (!CRM_PROVIDERS.includes(provider as (typeof CRM_PROVIDERS)[number])) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  const [owners, pipelines, stages] = await Promise.all([
    prisma.crmObjectMapping.findMany({
      where: { workspaceId, provider, objectType: "user" },
      orderBy: { externalId: "asc" },
    }),
    prisma.crmObjectMapping.findMany({
      where: { workspaceId, provider, objectType: "pipeline" },
      orderBy: { externalId: "asc" },
    }),
    prisma.crmObjectMapping.findMany({
      where: {
        workspaceId,
        provider,
        objectType: { in: ["pipeline_stage", "stage"] },
      },
      orderBy: { externalId: "asc" },
    }),
  ]);

  return {
    provider,
    displayName: displayNameForProvider(provider),
    status: conn?.status || "disconnected",
    syncStatus: conn?.syncStatus || "idle",
    lastSyncAt: conn?.lastSyncAt?.toISOString() || null,
    lastError: conn?.lastError || null,
    owners: (owners as MappingRow[]).map((r) => ({
      id: r.externalId,
      name: String(metaOf(r).name || metaOf(r).email || r.externalId),
      email: (metaOf(r).email as string) || null,
    })),
    pipelines: (pipelines as MappingRow[]).map((r) => ({
      id: r.externalId,
      name: String(metaOf(r).name || r.externalId),
    })),
    stages: (stages as MappingRow[]).map((r) => ({
      id: r.externalId,
      name: String(metaOf(r).name || r.externalId),
      pipelineId: (metaOf(r).pipelineId as string) || null,
      order: metaOf(r).order as number | undefined,
    })),
    config: {
      metadataRefresh: cfg.metadataRefresh || null,
      metadataRefreshedAt: cfg.metadataRefreshedAt || null,
    },
    secretsPresence,
  };
}
