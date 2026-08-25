/**
 * Shared workspace business brain — facts many agents may use.
 * Distinct from appointment-agent profile (how the booking agent may book).
 */

import { getPrisma } from "@/lib/db";
import type { BusinessBrain } from "@/lib/agents/appointment-booking/types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Build brain from live workspace resources (calendars, services, staff,
 * knowledge, transfer destinations). Prefer approved knowledge facts when present.
 */
export async function loadBusinessBrain(
  workspaceId: string,
  opts?: { agentId?: string; draftConfig?: unknown },
): Promise<BusinessBrain> {
  const prisma = getPrisma();
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true, displayName: true, customFieldsConfig: true },
  });

  const stored = asRecord(asRecord(workspace?.customFieldsConfig).businessBrain);
  const draft = asRecord(opts?.draftConfig);
  const wizardKnowledge = Array.isArray(draft.knowledgeItems)
    ? draft.knowledgeItems
    : [];

  const [services, staff, calendars, transfers, knowledgeLinks] =
    await Promise.all([
      prisma.voiceService.findMany({
        where: { workspaceId },
        take: 50,
      }),
      prisma.voiceStaffMember.findMany({
        where: { workspaceId },
        take: 50,
      }),
      prisma.voiceCalendarConnection.findMany({
        where: { workspaceId },
        take: 20,
      }),
      opts?.agentId
        ? prisma.voiceTransferDestination.findMany({
            where: { workspaceId, agentId: opts.agentId },
            take: 20,
          })
        : prisma.voiceTransferDestination.findMany({
            where: { workspaceId },
            take: 20,
          }),
      opts?.agentId
        ? prisma.voiceAgentKnowledgeBase.findMany({
            where: { agentId: opts.agentId },
            take: 10,
          })
        : Promise.resolve([]),
    ]);

  const kbIds = knowledgeLinks.map((l: { knowledgeBaseId: string }) => l.knowledgeBaseId);
  const sources =
    kbIds.length > 0
      ? await prisma.voiceKnowledgeSource.findMany({
          where: { workspaceId, knowledgeBaseId: { in: kbIds } },
          take: 40,
        })
      : [];

  const knowledgeFacts: BusinessBrain["knowledgeFacts"] = [];

  // Canonical: persisted Company Brain facts (manual / approved imports)
  if (Array.isArray(stored.knowledgeFacts)) {
    for (const raw of stored.knowledgeFacts) {
      const row = asRecord(raw);
      const label = String(row.label || "").trim();
      const summary = String(row.summary || "").trim();
      if (!label || !summary) continue;
      knowledgeFacts.push({
        label,
        summary,
        status: String(row.status || "owner_approved"),
      });
    }
  }

  for (const item of wizardKnowledge) {
    const row = asRecord(item);
    const label = String(row.label || "").trim();
    const summary = String(row.summary || "").trim();
    if (!label || !summary) continue;
    const status = String(row.status || "complete");
    // Website imports start as extracted/pending_review — only approved facts enter the shared brain.
    if (
      status === "missing" ||
      status === "pending_review" ||
      status === "extracted" ||
      status === "rejected" ||
      status === "outdated"
    ) {
      continue;
    }
    if (knowledgeFacts.some((f) => f.label.toLowerCase() === label.toLowerCase())) {
      continue;
    }
    knowledgeFacts.push({
      label,
      summary,
      status,
    });
  }
  for (const src of sources) {
    const preview = String(src.extractedPreview || src.contentText || "").trim();
    if (!preview) continue;
    const label = String(src.name || "Knowledge");
    if (knowledgeFacts.some((f) => f.label.toLowerCase() === label.toLowerCase())) {
      continue;
    }
    knowledgeFacts.push({
      label,
      summary: preview.slice(0, 400),
      status: String(src.status || "extracted"),
    });
  }

  const businessName =
    String(stored.businessName || draft.businessName || workspace?.displayName || workspace?.name || "")
      .trim() || "Your business";

  const defaultTimezone = String(
    stored.defaultTimezone ||
      draft.timezone ||
      asRecord(draft.scheduling).timezone ||
      "America/New_York",
  );

  const locations: BusinessBrain["locations"] = Array.isArray(stored.locations)
    ? (stored.locations as BusinessBrain["locations"])
    : [
        {
          id: "location_primary",
          name: String(draft.locationName || "Primary location"),
          timezone: defaultTimezone,
          address: String(draft.businessAddress || draft.address || "") || undefined,
          phoneNumberId: draft.phoneNumberId ? String(draft.phoneNumberId) : null,
          calendarId: calendars[0]?.id || null,
        },
      ];

  return {
    businessName,
    legalName: stored.legalName ? String(stored.legalName) : undefined,
    website: String(stored.website || draft.websiteUrl || "") || undefined,
    defaultTimezone,
    locations,
    services: services.map((s: { id: string; name: string; durationMinutes: number }) => ({
      id: s.id,
      name: s.name,
      durationMinutes: s.durationMinutes,
    })),
    businessHoursSummary:
      String(stored.businessHoursSummary || draft.businessHours || "") || null,
    staff: staff.map((s: { id: string; name: string; email?: string | null }) => ({
      id: s.id,
      name: s.name,
      role: s.email || undefined,
    })),
    transferDestinations: transfers.map(
      (t: { id: string; name: string; destination: string }) => ({
        id: t.id,
        name: t.name,
        phone: t.destination || undefined,
      }),
    ),
    brandVoice: stored.brandVoice ? String(stored.brandVoice) : null,
    approvedPolicies: Array.isArray(stored.approvedPolicies)
      ? stored.approvedPolicies.map(String)
      : [],
    prohibitedClaims: Array.isArray(stored.prohibitedClaims)
      ? stored.prohibitedClaims.map(String)
      : [
          "Do not invent prices, guarantees, or medical/legal advice",
          "Do not claim an appointment is booked unless create_appointment succeeded",
        ],
    knowledgeFacts: knowledgeFacts.slice(0, 40),
  };
}

/** Persist approved brain fields into workspace.customFieldsConfig.businessBrain */
export async function saveBusinessBrainPartial(
  workspaceId: string,
  partial: Partial<BusinessBrain>,
): Promise<BusinessBrain> {
  const prisma = getPrisma();
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true },
  });
  const existing = asRecord(workspace?.customFieldsConfig);
  const brain = {
    ...asRecord(existing.businessBrain),
    ...partial,
    updatedAt: new Date().toISOString(),
  };
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      customFieldsConfig: {
        ...existing,
        businessBrain: brain,
      },
    },
  });
  return loadBusinessBrain(workspaceId);
}

/**
 * Approve website-imported / pending knowledge facts into the shared brain
 * and mark matching wizard knowledgeItems as complete.
 */
export async function approveKnowledgeFacts(input: {
  workspaceId: string;
  agentId: string;
  userId: string;
  labels?: string[];
  approveAllPending?: boolean;
}): Promise<{
  approved: Array<{ label: string; summary: string }>;
  brain: BusinessBrain;
}> {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
  });
  if (!agent) throw new Error("Agent not found");

  const draft = asRecord(agent.draftConfig);
  const items = Array.isArray(draft.knowledgeItems) ? [...draft.knowledgeItems] : [];
  const approved: Array<{ label: string; summary: string }> = [];

  const nextItems = items.map((raw) => {
    const row = asRecord(raw);
    const label = String(row.label || "").trim();
    const summary = String(row.summary || "").trim();
    const status = String(row.status || "");
    const pending =
      status === "pending_review" ||
      status === "warning" ||
      status === "extracted";
    const labelMatch =
      !input.labels?.length ||
      input.labels.some((l) => l.toLowerCase() === label.toLowerCase());
    if (!summary || !labelMatch) return raw;
    if (!(input.approveAllPending ? pending || status === "complete" || status === "owner_approved" : pending)) {
      return raw;
    }
    if (!pending && status !== "complete" && status !== "owner_approved") return raw;
    if (pending) {
      approved.push({ label, summary });
      return {
        ...row,
        status: "owner_approved",
        statusLabel: "Approved",
        approvedAt: new Date().toISOString(),
        approvedBy: input.userId,
      };
    }
    if ((status === "complete" || status === "owner_approved") && input.approveAllPending) {
      approved.push({ label, summary });
    }
    return raw;
  });

  const { updateVoiceAgentDraft } = await import("@/lib/voice/agent-service");
  const { parseVoiceAgentConfig } = await import("@/lib/voice/types");
  const parsed = parseVoiceAgentConfig(agent.draftConfig);
  await updateVoiceAgentDraft(input.workspaceId, input.agentId, {
    draftConfig: {
      ...parsed,
      knowledgeItems: nextItems,
    } as typeof parsed & { knowledgeItems: unknown[] },
  });

  const brain = await saveBusinessBrainPartial(input.workspaceId, {
    knowledgeFacts: approved.map((a) => ({
      label: a.label,
      summary: a.summary,
      status: "complete",
    })),
  });

  await prisma.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      event: "agent.knowledge_facts_approved",
      detail: `agent=${input.agentId} count=${approved.length}`,
    },
  });

  return { approved, brain };
}
