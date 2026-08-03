import "server-only";

import { getPrisma } from "@/lib/db";
import { processKnowledgeSource } from "@/lib/voice/knowledge-processor";
import {
  attachInsightGroupToAgent,
  seedDefaultInsights,
} from "@/lib/voice/platform/ai-platform";
import { runSharedReceptionistHooks } from "@/lib/solutions/hooks";
import type { AppointmentReceptionistWizardState } from "./types";
import { syncWizardTransferDestinations } from "./sync-transfer";
import { syncWizardRoutingRules } from "./sync-routing";
import {
  getWizardActivationIssues,
  hasBlockingActivationIssues,
  type ActivationIssue,
} from "./capability-checklist";
import { parseNoticeMinutes } from "./notice-utils";

export type ActivateHooksResult = {
  issues: ActivationIssue[];
  knowledgeBaseId: string | null;
  calendarConnectionId: string | null;
  serviceIds: string[];
  insightGroupId: string | null;
  transferSynced: boolean;
  transferE164: string | null;
  routingSynced: boolean;
  routingMode: string | null;
};

function buildBusinessProfileText(state: AppointmentReceptionistWizardState): string {
  const lines: string[] = [];
  lines.push(`Business name: ${state.businessName || state.solutionName}`);
  if (state.agentName) lines.push(`Receptionist: ${state.agentName} (${state.role || "front desk"})`);
  if (state.phoneNumberE164) lines.push(`Main phone: ${state.phoneNumberE164}`);
  lines.push(`Time zone: ${state.timezone || "America/New_York"}`);
  lines.push("");
  lines.push("Business knowledge:");
  for (const item of state.knowledgeItems) {
    if (!item.summary?.trim() && item.status === "missing") continue;
    lines.push(`- ${item.label}: ${item.summary || item.statusLabel}`);
  }
  if (state.websiteUrl?.trim()) {
    lines.push("");
    lines.push(`Website: ${state.websiteUrl.trim()}`);
  }
  lines.push("");
  lines.push("Services callers can book:");
  for (const t of state.appointmentTypes.filter((x) => x.enabled)) {
    lines.push(
      `- ${t.name}: ${t.durationMin} minutes${t.description ? ` — ${t.description}` : ""}`,
    );
  }
  if (state.transferDestinationName || state.transferDestinationPhone) {
    lines.push("");
    lines.push(
      `Transfer contact: ${state.transferDestinationName || "Staff"} ${state.transferDestinationPhone || ""}`.trim(),
    );
  }
  lines.push("");
  lines.push(
    "If information is not available, say you don't have that information and offer to take a message or connect someone.",
  );
  return lines.join("\n");
}

async function ensureWizardKnowledgeBase(input: {
  workspaceId: string;
  agentId: string;
  state: AppointmentReceptionistWizardState;
}): Promise<string | null> {
  const prisma = getPrisma();
  const kbName = `${input.state.solutionName || "Appointment Receptionist"} Knowledge`;

  let kb = await prisma.voiceKnowledgeBase.findFirst({
    where: {
      workspaceId: input.workspaceId,
      name: kbName,
    },
  });
  if (!kb) {
    kb = await prisma.voiceKnowledgeBase.create({
      data: {
        workspaceId: input.workspaceId,
        name: kbName,
        description: "Auto-built from Appointment Receptionist wizard",
        status: "active",
      },
    });
  }

  const profileText = buildBusinessProfileText(input.state);
  const sourceName = "Wizard business profile";
  let source = await prisma.voiceKnowledgeSource.findFirst({
    where: {
      workspaceId: input.workspaceId,
      knowledgeBaseId: kb.id,
      name: sourceName,
    },
  });
  if (!source) {
    source = await prisma.voiceKnowledgeSource.create({
      data: {
        workspaceId: input.workspaceId,
        knowledgeBaseId: kb.id,
        sourceType: "text",
        name: sourceName,
        status: "pending",
        contentText: profileText,
      },
    });
  } else {
    source = await prisma.voiceKnowledgeSource.update({
      where: { id: source.id },
      data: { contentText: profileText, status: "pending", errorMessage: null },
    });
  }

  if (input.state.websiteUrl?.trim()) {
    const url = input.state.websiteUrl.trim();
    const urlSourceName = "Wizard website";
    let urlSource = await prisma.voiceKnowledgeSource.findFirst({
      where: {
        workspaceId: input.workspaceId,
        knowledgeBaseId: kb.id,
        name: urlSourceName,
      },
    });
    if (!urlSource) {
      urlSource = await prisma.voiceKnowledgeSource.create({
        data: {
          workspaceId: input.workspaceId,
          knowledgeBaseId: kb.id,
          sourceType: "url",
          name: urlSourceName,
          status: "pending",
          crawlUrl: url,
        },
      });
    } else {
      urlSource = await prisma.voiceKnowledgeSource.update({
        where: { id: urlSource.id },
        data: { crawlUrl: url, status: "pending", errorMessage: null },
      });
    }
    await processKnowledgeSource(urlSource.id).catch((err) =>
      console.warn(
        "[appointment-receptionist] website knowledge sync failed",
        err instanceof Error ? err.message : err,
      ),
    );
  }

  await processKnowledgeSource(source.id).catch((err) =>
    console.warn(
      "[appointment-receptionist] profile knowledge sync failed",
      err instanceof Error ? err.message : err,
    ),
  );

  await prisma.voiceAgentKnowledgeBase.upsert({
    where: {
      agentId_knowledgeBaseId: {
        agentId: input.agentId,
        knowledgeBaseId: kb.id,
      },
    },
    create: {
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      knowledgeBaseId: kb.id,
    },
    update: {},
  });

  return kb.id;
}

async function ensureWizardCalendarServices(input: {
  workspaceId: string;
  state: AppointmentReceptionistWizardState;
}): Promise<{ calendarConnectionId: string | null; serviceIds: string[] }> {
  const prisma = getPrisma();
  const calendar = await prisma.voiceCalendarConnection.findFirst({
    where: {
      workspaceId: input.workspaceId,
      status: { in: ["connected", "active", "ok"] },
      provider: { in: ["google", "microsoft", "internal"] },
    },
    orderBy: { updatedAt: "desc" },
  });

  const serviceIds: string[] = [];
  const enabled = input.state.appointmentTypes.filter((t) => t.enabled);
  for (const t of enabled) {
    const existing = await prisma.voiceService.findFirst({
      where: {
        workspaceId: input.workspaceId,
        name: t.name,
      },
    });
    if (existing) {
      const updated = await prisma.voiceService.update({
        where: { id: existing.id },
        data: {
          durationMinutes: t.durationMin || 30,
          calendarId: calendar?.id || existing.calendarId,
          config: {
            wizardTypeId: t.id,
            description: t.description || null,
            location: t.location || null,
            locations: t.location ? [t.location] : [],
            modality: t.modality || null,
            bookingHours: t.bookingHours || null,
            minNotice: t.minNotice || null,
            minimumBookingNoticeMinutes: parseNoticeMinutes(t.minNotice),
            maxDaysAhead: t.maxDaysAhead || null,
            requiredFields: t.requiredFields || [],
            bookingPermission: t.bookingPermission,
          },
        },
      });
      serviceIds.push(updated.id);
    } else {
      const created = await prisma.voiceService.create({
        data: {
          workspaceId: input.workspaceId,
          name: t.name,
          durationMinutes: t.durationMin || 30,
          bufferMinutes: 0,
          calendarId: calendar?.id || null,
          config: {
            wizardTypeId: t.id,
            description: t.description || null,
            location: t.location || null,
            locations: t.location ? [t.location] : [],
            modality: t.modality || null,
            bookingHours: t.bookingHours || null,
            minNotice: t.minNotice || null,
            minimumBookingNoticeMinutes: parseNoticeMinutes(t.minNotice),
            maxDaysAhead: t.maxDaysAhead || null,
            requiredFields: t.requiredFields || [],
            bookingPermission: t.bookingPermission,
          },
        },
      });
      serviceIds.push(created.id);
    }
  }

  return {
    calendarConnectionId: calendar?.id || null,
    serviceIds,
  };
}

async function ensureInsightsAttached(input: {
  workspaceId: string;
  agentId: string;
}): Promise<string | null> {
  const { group } = await seedDefaultInsights(input.workspaceId);
  await attachInsightGroupToAgent(input.workspaceId, input.agentId, group.id);
  return group.id;
}

/**
 * Run on activate (and optionally save_draft): push wizard state into platform
 * records other agents can also reuse (KB, services, destinations, insights).
 */
export async function runAppointmentReceptionistActivateHooks(input: {
  workspaceId: string;
  agentId: string;
  state: AppointmentReceptionistWizardState;
  mode: "save_draft" | "activate";
}): Promise<ActivateHooksResult> {
  const prisma = getPrisma();
  const calendar = await prisma.voiceCalendarConnection.findFirst({
    where: {
      workspaceId: input.workspaceId,
      status: { in: ["connected", "active", "ok"] },
      provider: { in: ["google", "microsoft", "internal"] },
    },
    select: { id: true },
  });

  const issues = getWizardActivationIssues(input.state, {
    hasCalendarConnection: Boolean(calendar),
    hasKnowledgeText: Boolean(input.state.businessName?.trim()),
  });

  if (input.mode === "activate" && hasBlockingActivationIssues(issues)) {
    return {
      issues,
      knowledgeBaseId: null,
      calendarConnectionId: calendar?.id || null,
      serviceIds: [],
      insightGroupId: null,
      transferSynced: false,
      transferE164: null,
      routingSynced: false,
      routingMode: null,
    };
  }

  const knowledgeBaseId = await ensureWizardKnowledgeBase({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    state: input.state,
  }).catch((err) => {
    console.warn(
      "[appointment-receptionist] knowledge hook failed",
      err instanceof Error ? err.message : err,
    );
    return null;
  });

  const { calendarConnectionId, serviceIds } = await ensureWizardCalendarServices({
    workspaceId: input.workspaceId,
    state: input.state,
  }).catch((err) => {
    console.warn(
      "[appointment-receptionist] calendar services hook failed",
      err instanceof Error ? err.message : err,
    );
    return { calendarConnectionId: null as string | null, serviceIds: [] as string[] };
  });

  let transferSynced = false;
  let transferE164: string | null = null;
  if (input.state.transferDestinationPhone?.trim()) {
    const result = await syncWizardTransferDestinations({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      destinationName: input.state.transferDestinationName,
      destinationPhone: input.state.transferDestinationPhone,
      returnToAiOnFail: input.state.transferFallback === "return_to_ai",
    }).catch((err) => {
      console.warn(
        "[appointment-receptionist] transfer hook failed",
        err instanceof Error ? err.message : err,
      );
      return { synced: false as const, e164: null };
    });
    transferSynced = result.synced;
    transferE164 = result.e164;
  }

  let insightGroupId: string | null = null;
  let routingSynced = false;
  let routingMode: string | null = null;
  if (input.mode === "activate") {
    insightGroupId = await ensureInsightsAttached({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
    }).catch((err) => {
      console.warn(
        "[appointment-receptionist] insights hook failed",
        err instanceof Error ? err.message : err,
      );
      return null;
    });

    const routing = await syncWizardRoutingRules({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      answerWhen: input.state.answerWhen,
      ringBehavior: input.state.ringBehavior,
      ringTeamSeconds: input.state.ringTeamSeconds,
      timezone: input.state.timezone,
    }).catch((err) => {
      console.warn(
        "[appointment-receptionist] routing hook failed",
        err instanceof Error ? err.message : err,
      );
      return null;
    });
    if (routing) {
      routingSynced = true;
      routingMode = routing.mode;
    }
  }

  // Persist KB id onto draft config for Telnyx retrieval attach.
  if (knowledgeBaseId) {
    const agent = await prisma.voiceAgent.findFirst({
      where: { id: input.agentId, workspaceId: input.workspaceId },
      select: { draftConfig: true },
    });
    const draft = (agent?.draftConfig || {}) as Record<string, unknown>;
    await prisma.voiceAgent.update({
      where: { id: input.agentId },
      data: {
        draftConfig: {
          ...draft,
          knowledgeBaseIds: [knowledgeBaseId],
        },
      },
    });
  }

  await runSharedReceptionistHooks({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    mode: input.mode,
    answerWhen: input.state.answerWhen,
    meta: {
      ringBehavior: input.state.ringBehavior,
      solutionSlug: "appointment-assistant",
    },
  }).catch((err) => {
    console.warn(
      "[appointment-receptionist] shared receptionist hooks failed",
      err instanceof Error ? err.message : err,
    );
  });

  // Post-hook gates: transfer/routing must actually sync before go-live.
  if (input.mode === "activate") {
    if (
      input.state.capabilities.includes("transfer_calls") &&
      input.state.transferDestinationPhone?.trim() &&
      !transferSynced
    ) {
      issues.push({
        id: "transfer_sync",
        severity: "blocking",
        message:
          "Could not sync the transfer destination — check the phone number and try again.",
      });
    }
    if (!routingSynced) {
      issues.push({
        id: "routing_sync",
        severity: "blocking",
        message: "Could not sync call routing rules — activation blocked.",
      });
    }
    if (!knowledgeBaseId) {
      issues.push({
        id: "knowledge_sync",
        severity: "warning",
        message:
          "Knowledge base sync did not complete — the agent will still use the system prompt knowledge.",
      });
    }
  }

  return {
    issues,
    knowledgeBaseId,
    calendarConnectionId,
    serviceIds,
    insightGroupId,
    transferSynced,
    transferE164,
    routingSynced,
    routingMode,
  };
}
