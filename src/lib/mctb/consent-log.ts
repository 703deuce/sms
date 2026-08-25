import "server-only";

import { getPrisma } from "@/lib/db";
import {
  asConsentMetadata,
  buildConsentLogScopeFromMissedEvents,
  buildConsentLogWhereClause,
  missedCallIdempotencyKey,
} from "@/lib/mctb/consent-log-shared";

export type ConsentLogRow = {
  id: string;
  callerNumber: string;
  businessNumber: string;
  consentedAt: string;
  affirmativeInput: string;
  method: string;
  consentScope: string;
  callSessionId: string | null;
  promptAssetId: string | null;
  captureMode: string | null;
  consentMode: string | null;
  path: string | null;
  mediaBackend: string | null;
  missedCallEventId: string | null;
  missedCallStatus: string | null;
  smsSentAt: string | null;
};

export { missedCallIdempotencyKey };

export async function loadConsentLogRows(
  workspaceId: string,
  options?: { limit?: number; caller?: string },
): Promise<{ rows: ConsentLogRow[]; summary: { total: number; today: number; withSmsToday: number } }> {
  const prisma = getPrisma();
  const limit = Math.min(200, Math.max(1, options?.limit ?? 100));
  const callerFilter = options?.caller?.trim();

  const missedEvents = await prisma.missedCallEvent.findMany({
    where: { workspaceId },
    select: {
      id: true,
      status: true,
      smsSentAt: true,
      idempotencyKey: true,
      metadata: true,
      callerE164: true,
      businessE164: true,
    },
    orderBy: { detectedAt: "desc" },
    take: 500,
  });

  const { sessionIds, missedBySession } = buildConsentLogScopeFromMissedEvents(
    workspaceId,
    missedEvents,
  );

  const where = buildConsentLogWhereClause(workspaceId, sessionIds, callerFilter);

  for (const evt of missedEvents.slice(0, 100)) {
    const caller = evt.callerE164?.trim();
    if (!caller) continue;
    const meta = asConsentMetadata(evt.metadata);
    const businessRaw =
      typeof meta.transovoNumberE164 === "string" && meta.transovoNumberE164.trim()
        ? meta.transovoNumberE164.trim()
        : evt.businessE164?.trim() || "";
    const digits = businessRaw.replace(/\D/g, "");
    const businessVariants = new Set<string>();
    if (businessRaw) businessVariants.add(businessRaw);
    if (digits) {
      businessVariants.add(digits);
      businessVariants.add(`+${digits}`);
    }
    for (const businessNumber of businessVariants) {
      (where.OR as Array<Record<string, unknown>>).push({
        callerNumber: caller,
        businessNumber,
      });
    }
  }

  const consents = await prisma.smartRoutingSmsConsentEvent.findMany({
    where: where as never,
    orderBy: { consentedAt: "desc" },
    take: limit,
  });

  const rows: ConsentLogRow[] = consents.map((c: (typeof consents)[number]) => {
    const meta = asConsentMetadata(c.metadataJson);
    const linked = c.callSessionId ? missedBySession.get(c.callSessionId) : undefined;
    return {
      id: c.id,
      callerNumber: c.callerNumber,
      businessNumber: c.businessNumber,
      consentedAt: c.consentedAt.toISOString(),
      affirmativeInput: c.affirmativeInput,
      method: c.method,
      consentScope: c.consentScope,
      callSessionId: c.callSessionId,
      promptAssetId: c.promptAssetId,
      captureMode: typeof meta.captureMode === "string" ? meta.captureMode : null,
      consentMode: typeof meta.consentMode === "string" ? meta.consentMode : null,
      path: typeof meta.path === "string" ? meta.path : null,
      mediaBackend: typeof meta.mediaBackend === "string" ? meta.mediaBackend : null,
      missedCallEventId: linked?.id ?? null,
      missedCallStatus: linked?.status ?? null,
      smsSentAt: linked?.smsSentAt?.toISOString() ?? null,
    };
  });

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const todayWhere = {
    ...where,
    consentedAt: { gte: start },
  };

  const [total, today, withSmsToday] = await Promise.all([
    prisma.smartRoutingSmsConsentEvent.count({ where: where as never }),
    prisma.smartRoutingSmsConsentEvent.count({ where: todayWhere as never }),
    prisma.missedCallEvent.count({
      where: {
        workspaceId,
        smsSentAt: { gte: start },
        idempotencyKey: { startsWith: `missed-call-text:${workspaceId}:` },
      },
    }),
  ]);

  return {
    rows,
    summary: { total, today, withSmsToday },
  };
}

export async function loadConsentForMissedCallEvent(input: {
  workspaceId: string;
  missedCallEventId: string;
}): Promise<ConsentLogRow | null> {
  const prisma = getPrisma();
  const event = await prisma.missedCallEvent.findFirst({
    where: { id: input.missedCallEventId, workspaceId: input.workspaceId },
    select: { metadata: true, status: true, smsSentAt: true, idempotencyKey: true },
  });
  if (!event) return null;

  const meta = asConsentMetadata(event.metadata);
  const callSessionId =
    typeof meta.providerCallId === "string" ? meta.providerCallId.trim() : "";
  const fromIdempotency = event.idempotencyKey?.startsWith(
    `missed-call-text:${input.workspaceId}:`,
  )
    ? event.idempotencyKey.slice(`missed-call-text:${input.workspaceId}:`.length)
    : "";

  const sessionId = callSessionId || fromIdempotency;
  if (!sessionId) return null;

  const consent = await prisma.smartRoutingSmsConsentEvent.findFirst({
    where: {
      OR: [
        { workspaceId: input.workspaceId, callSessionId: sessionId },
        { callSessionId: sessionId },
      ],
    },
    orderBy: { consentedAt: "desc" },
  });
  if (!consent) return null;

  const consentMeta = asConsentMetadata(consent.metadataJson);
  return {
    id: consent.id,
    callerNumber: consent.callerNumber,
    businessNumber: consent.businessNumber,
    consentedAt: consent.consentedAt.toISOString(),
    affirmativeInput: consent.affirmativeInput,
    method: consent.method,
    consentScope: consent.consentScope,
    callSessionId: consent.callSessionId,
    promptAssetId: consent.promptAssetId,
    captureMode: typeof consentMeta.captureMode === "string" ? consentMeta.captureMode : null,
    consentMode: typeof consentMeta.consentMode === "string" ? consentMeta.consentMode : null,
    path: typeof consentMeta.path === "string" ? consentMeta.path : null,
    mediaBackend: typeof consentMeta.mediaBackend === "string" ? consentMeta.mediaBackend : null,
    missedCallEventId: input.missedCallEventId,
    missedCallStatus: event.status,
    smsSentAt: event.smsSentAt?.toISOString() ?? null,
  };
}
