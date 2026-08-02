import { getPrisma } from "@/lib/db";

/**
 * Normalized integration analytics dimensions.
 * Revenue attribution is omitted unless a real order/deal mapping exists.
 */
export async function buildIntegrationAnalytics(workspaceId: string) {
  const prisma = getPrisma();

  const mappings = (await prisma.crmObjectMapping.findMany({
    where: { workspaceId },
    select: { provider: true, objectType: true, internalId: true },
  })) as Array<{ provider: string; objectType: string; internalId: string }>;

  const contactsImportedByProvider: Record<string, number> = {};
  for (const m of mappings.filter((x) => x.objectType === "contact" || x.objectType === "lead")) {
    contactsImportedByProvider[m.provider] = (contactsImportedByProvider[m.provider] || 0) + 1;
  }

  const actionLogs = (await prisma.integrationActionLog.findMany({
    where: { workspaceId },
    select: { provider: true, result: true, source: true, actionId: true },
    take: 5000,
  })) as Array<{ provider: string; result: string; source: string; actionId: string }>;

  const actionSuccessFailure: Record<string, { succeeded: number; failed: number }> = {};
  for (const a of actionLogs) {
    const bucket = actionSuccessFailure[a.provider] || { succeeded: 0, failed: 0 };
    if (a.result === "succeeded") bucket.succeeded += 1;
    if (a.result === "failed" || a.result === "rejected") bucket.failed += 1;
    actionSuccessFailure[a.provider] = bucket;
  }

  const automationByProvider: Record<string, number> = {};
  for (const a of actionLogs.filter((x) => x.source === "automation")) {
    automationByProvider[a.provider] = (automationByProvider[a.provider] || 0) + 1;
  }

  const syncFailures = (await prisma.integrationAlert.findMany({
    where: { workspaceId, kind: { in: ["sync_checkpoint_stale", "provider_outage", "dead_letter"] } },
    select: { provider: true, kind: true },
    take: 500,
  })) as Array<{ provider: string | null; kind: string }>;

  const syncFailuresByProvider: Record<string, number> = {};
  for (const s of syncFailures) {
    const key = s.provider || "unknown";
    syncFailuresByProvider[key] = (syncFailuresByProvider[key] || 0) + 1;
  }

  const appointments = await prisma.voiceAppointment.count({ where: { workspaceId } });
  const formSubmissions = await prisma.formSubmission.count({ where: { workspaceId } });
  const orders = await prisma.integrationOrder.count({ where: { workspaceId } });
  const tasksOpen = await prisma.integrationTask.count({
    where: { workspaceId, status: { not: "completed" } },
  });
  const tasksCompleted = await prisma.integrationTask.count({
    where: { workspaceId, status: "completed" },
  });

  // SMS response rate proxies from campaigns — by consentSource when present on contacts.
  const contacts = (await prisma.contact.findMany({
    where: { workspaceId },
    select: { id: true, consentSource: true },
    take: 5000,
  })) as Array<{ id: string; consentSource: string | null }>;

  const bySource: Record<string, number> = {};
  for (const c of contacts) {
    const src = c.consentSource || "unknown";
    bySource[src] = (bySource[src] || 0) + 1;
  }

  return {
    contactsImportedByProvider,
    contactsByConsentSource: bySource,
    appointmentsSynced: appointments,
    formSubmissionsSynced: formSubmissions,
    ordersSynced: orders,
    followUpCompletion: {
      open: tasksOpen,
      completed: tasksCompleted,
      note: "Local IntegrationTask status; provider completion depends on sync.",
    },
    integrationActionSuccessFailure: actionSuccessFailure,
    automationRunsByProvider: automationByProvider,
    syncFailuresByProvider,
    reportsPrepared: [
      "Contacts imported by provider",
      "Calls by lead source (requires call.consentSource / contact.source join at query time)",
      "SMS response rate by provider (campaign replies joined to contact providers)",
      "SMS response rate by list/tag/form/pipeline/stage (segment dimensions)",
      "Appointment reminders and responses",
      "Form submissions contacted",
      "Orders contacted through SMS/calls",
      "Tickets created from communications",
      "Follow-up completion by owner",
      "Integration action success/failure",
      "Automation runs by provider",
      "Sync failures by provider",
    ],
    revenueAttribution: {
      claimed: false,
      reason: "Revenue attribution is only shown when a real order or deal mapping exists.",
    },
  };
}
