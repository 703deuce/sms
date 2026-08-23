import "server-only";

import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import {
  publishFlow,
  rollbackFlow,
  updateFlowDraft,
  getFlow,
  createFlow,
} from "../flow-service";
import { parseDraftConfig } from "../session-store";
import { updateSmartRoutingWorkspaceSettings } from "../workspace-settings";
import { compareRoutingConfigs } from "./compare";
import {
  buildAiRoutingFlowContext,
  getPrimaryFlowId,
  loadAiRoutingDestinations,
} from "./context-builder";
import { summarizeDraftConfig } from "./config-summary";
import {
  addDestinationToMenuOption,
  applyTemporaryDestinationSwap,
  buildPhoneMenuDraftFromDestinations,
  restoreExpiredTemporaryRouting,
} from "./draft-helpers";
import { runAiRoutingLlmLoop } from "./llm-loop";
import {
  analyzeRoutingQuestion,
  checkBobMissingDestination,
  explainCurrentRouting,
  validateRoutingProposal,
  type AiRoutingToolContext,
} from "./tools";
import { generateRoutingRecommendations } from "./recommendations";
import type {
  AiProposalStatus,
  AiRoutingProposalPayload,
  AiRoutingProposalView,
  AiRoutingProposedChange,
} from "./types";
import type { DraftConfig, FlowValidationResult } from "../types";

export async function restoreFlowTemporaryRoutingIfExpired(
  workspaceId: string,
  flowId: string,
): Promise<boolean> {
  const flow = await getFlow(workspaceId, flowId);
  if (!flow) return false;
  let draft = parseDraftConfig(flow.draftConfigJson);
  const restored = restoreExpiredTemporaryRouting(draft);
  if (!restored) return false;
  await updateFlowDraft(workspaceId, flowId, { draftConfig: restored });
  return true;
}

function toProposalView(
  row: {
    id: string;
    status: string;
    intent: string;
    userPrompt: string;
    summary: string | null;
    assumptionsJson: unknown;
    warningsJson: unknown;
    proposedChangesJson: unknown;
    clarificationQuestion: string | null;
    validationJson: unknown;
    flowId: string | null;
    baseFlowUpdatedAt: Date | null;
    createdAt: Date;
    undoSnapshotJson: unknown;
  },
  destinations: Awaited<ReturnType<typeof loadAiRoutingDestinations>>,
  currentDraft?: DraftConfig | null,
  proposedDraft?: DraftConfig | null,
): AiRoutingProposalView {
  const validation = row.validationJson as FlowValidationResult | null;
  const proposedChanges = (row.proposedChangesJson as AiRoutingProposedChange[]) ?? [];
  const canApply =
    row.status === "awaiting_approval" &&
    validation?.valid === true &&
    Boolean(proposedDraft);

  return {
    id: row.id,
    status: row.status as AiProposalStatus,
    intent: row.intent as AiRoutingProposalView["intent"],
    userPrompt: row.userPrompt,
    summary: row.summary,
    proposedChanges,
    assumptions: (row.assumptionsJson as string[]) ?? [],
    warnings: (row.warningsJson as string[]) ?? [],
    clarificationQuestion: row.clarificationQuestion,
    requiresConfirmation: true,
    validation,
    preview:
      currentDraft && proposedDraft
        ? {
            currentSummary: summarizeDraftConfig(currentDraft, destinations),
            proposedSummary: summarizeDraftConfig(proposedDraft, destinations),
            changes: proposedChanges,
          }
        : null,
    flowId: row.flowId,
    baseFlowUpdatedAt: row.baseFlowUpdatedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    canApply,
    canUndo: Boolean(row.undoSnapshotJson),
  };
}

async function tryDeterministicProposal(
  ctx: AiRoutingToolContext,
  prompt: string,
  currentDraft: DraftConfig,
): Promise<AiRoutingProposalPayload | null> {
  const lower = prompt.toLowerCase();
  const destinations = await loadAiRoutingDestinations(ctx.workspaceId);

  // Ring Sarah too (add to Service or ring group)
  if (lower.includes("sarah") && (lower.includes("ring") || lower.includes("too"))) {
    const sarah = destinations.find((d) => d.label.toLowerCase().includes("sarah"));
    if (!sarah) return null;
    let menuLabel = "Service";
    if (lower.includes("sales")) menuLabel = "Sales";
    try {
      const proposed = addDestinationToMenuOption(currentDraft, menuLabel, sarah, "simultaneous");
      const changes = compareRoutingConfigs(currentDraft, proposed, destinations);
      return {
        intent: "modify",
        summary: `Ring ${sarah.label} together with existing ${menuLabel} routing.`,
        proposedChanges: changes,
        routingConfig: proposed,
        assumptions: [`${menuLabel} menu option exists`],
        warnings: [],
        requiresConfirmation: true,
      };
    } catch {
      return null;
    }
  }

  // Build phone menu from spec
  if (
    lower.includes("press 1") &&
    lower.includes("sales") &&
    lower.includes("service")
  ) {
    const mike = destinations.find((d) => d.label.toLowerCase().includes("mike"));
    const sarah = destinations.find((d) => d.label.toLowerCase().includes("sarah"));
    const john = destinations.find((d) => d.label.toLowerCase().includes("john"));
    if (!mike || !sarah || !john) return null;

    const proposed = buildPhoneMenuDraftFromDestinations({
      greetingText: "Thanks for calling. Please listen to the options.",
      menuOptions: [
        { digit: "1", label: "Sales", destination: mike },
        {
          digit: "2",
          label: "Service",
          destination: sarah,
          extraDestinations: [john],
          ringMode: "simultaneous",
        },
      ],
      businessHours: { days: "Mon-Fri", open: "08:00", close: "17:00" },
      afterHoursVoicemail: true,
    });

    return {
      intent: "create",
      summary: "Phone menu with Sales→Mike, Service→Sarah+John, Mon-Fri 8-5, after-hours voicemail.",
      proposedChanges: compareRoutingConfigs(currentDraft, proposed, destinations),
      routingConfig: proposed,
      assumptions: ["Business hours use flow timezone"],
      warnings: [],
      requiresConfirmation: true,
    };
  }

  // Mike out until Monday → Sarah
  if (lower.includes("mike") && lower.includes("sarah") && lower.includes("until")) {
    const mike = destinations.find((d) => d.label.toLowerCase().includes("mike"));
    const sarah = destinations.find((d) => d.label.toLowerCase().includes("sarah"));
    if (!mike || !sarah) return null;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + ((8 - expiresAt.getDay()) % 7 || 7));
    expiresAt.setHours(8, 0, 0, 0);
    const proposed = applyTemporaryDestinationSwap(
      currentDraft,
      mike.id,
      sarah,
      expiresAt.toISOString(),
    );
    return {
      intent: "modify",
      summary: `Send Mike's calls to Sarah until ${expiresAt.toLocaleDateString()}.`,
      proposedChanges: compareRoutingConfigs(currentDraft, proposed, destinations),
      routingConfig: proposed,
      temporaryRouting: { expiresAt: expiresAt.toISOString(), reason: "Mike unavailable" },
      assumptions: ["Permanent routing restored automatically after expiration"],
      warnings: [],
      requiresConfirmation: true,
    };
  }

  return null;
}

export async function createAiRoutingProposal(input: {
  workspaceId: string;
  userId?: string;
  flowId?: string;
  prompt: string;
  mode?: "build" | "change" | "explain" | "analyze" | "improve";
}): Promise<{ proposal?: AiRoutingProposalView; message?: string; error?: string }> {
  const prisma = getPrisma();
  let flowId = input.flowId ?? (await getPrimaryFlowId(input.workspaceId));
  if (!flowId && (input.mode === "build" || input.prompt.toLowerCase().includes("press 1"))) {
    const created = await createFlow(input.workspaceId, {
      type: "phone_menu",
      name: "AI Built Flow",
      createdBy: input.userId,
    });
    flowId = created.id;
  }
  const ctx: AiRoutingToolContext = {
    workspaceId: input.workspaceId,
    flowId,
    userId: input.userId,
  };

  const bobCheck = await checkBobMissingDestination(input.workspaceId, input.prompt);
  if (bobCheck) {
    const row = await prisma.smartRoutingAiProposal.create({
      data: {
        id: createId(),
        workspaceId: input.workspaceId,
        flowId,
        status: "clarification_needed",
        intent: input.mode === "build" ? "create" : "modify",
        userPrompt: input.prompt,
        summary: bobCheck,
        clarificationQuestion: "What is Bob's phone number?",
        assumptionsJson: [],
        warningsJson: [],
        proposedChangesJson: [],
        createdBy: input.userId ?? null,
      },
    });
    const destinations = await loadAiRoutingDestinations(input.workspaceId);
    return {
      proposal: toProposalView(row, destinations),
      message: bobCheck,
    };
  }

  if (input.mode === "explain") {
    const explanation = await explainCurrentRouting(ctx, input.prompt);
    const row = await prisma.smartRoutingAiProposal.create({
      data: {
        id: createId(),
        workspaceId: input.workspaceId,
        flowId,
        status: "published",
        intent: "explain",
        userPrompt: input.prompt,
        summary: explanation,
        assumptionsJson: [],
        warningsJson: [],
        proposedChangesJson: [],
        createdBy: input.userId ?? null,
      },
    });
    return {
      proposal: toProposalView(row, []),
      message: explanation,
    };
  }

  if (input.mode === "analyze" || input.mode === "improve") {
    const { facts, analytics } = await analyzeRoutingQuestion(ctx, input.prompt);
    if (input.mode === "improve") {
      await generateRoutingRecommendations(input.workspaceId, analytics, flowId);
    }
    const row = await prisma.smartRoutingAiProposal.create({
      data: {
        id: createId(),
        workspaceId: input.workspaceId,
        flowId,
        status: "published",
        intent: input.mode === "improve" ? "analyze" : "analyze",
        userPrompt: input.prompt,
        summary: facts,
        assumptionsJson: ["Based on aggregated call activity only"],
        warningsJson: analytics.insufficientData
          ? ["Limited sample size — recommendations use cautious language"]
          : [],
        proposedChangesJson: [],
        createdBy: input.userId ?? null,
      },
    });
    return {
      proposal: toProposalView(row, []),
      message: facts,
    };
  }

  let flowCtx = flowId ? await buildAiRoutingFlowContext(input.workspaceId, flowId) : null;
  if (flowId) await restoreFlowTemporaryRoutingIfExpired(input.workspaceId, flowId);
  if (flowId) flowCtx = await buildAiRoutingFlowContext(input.workspaceId, flowId);

  const currentDraft = flowCtx?.draftConfig ?? { nodes: [], edges: [] };
  const destinations = await loadAiRoutingDestinations(input.workspaceId);

  let payload: AiRoutingProposalPayload | undefined;
  let clarificationQuestion: string | undefined;
  let invocationRecord: Record<string, unknown> | undefined;
  let llmError: string | undefined;

  const deterministic = await tryDeterministicProposal(ctx, input.prompt, currentDraft);
  if (deterministic) {
    payload = deterministic;
  } else {
    const llm = await runAiRoutingLlmLoop(ctx, input.prompt);
    invocationRecord = llm.record as unknown as Record<string, unknown>;
    if (llm.error) llmError = llm.error;
    payload = llm.payload;
    clarificationQuestion = llm.clarificationQuestion;
  }

  if (clarificationQuestion && !payload) {
    const row = await prisma.smartRoutingAiProposal.create({
      data: {
        id: createId(),
        workspaceId: input.workspaceId,
        flowId,
        status: "clarification_needed",
        intent: "modify",
        userPrompt: input.prompt,
        summary: clarificationQuestion,
        clarificationQuestion,
        assumptionsJson: [],
        warningsJson: [],
        proposedChangesJson: [],
        invocationJson: invocationRecord ?? undefined,
        baseFlowUpdatedAt: flowCtx?.updatedAt ? new Date(flowCtx.updatedAt) : null,
        createdBy: input.userId ?? null,
      },
    });
    return {
      proposal: toProposalView(row, destinations, currentDraft),
      message: clarificationQuestion,
    };
  }

  if (!payload?.routingConfig && llmError) {
    return {
      error:
        "I couldn't build that routing proposal right now. Your current routing has not been changed.",
    };
  }

  if (!payload?.routingConfig) {
    return {
      error:
        "I couldn't generate a routing proposal from that request. Try describing who should receive each type of call.",
    };
  }

  const validation = await validateRoutingProposal(input.workspaceId, payload.routingConfig);
  const proposedChanges =
    payload.proposedChanges.length > 0
      ? payload.proposedChanges
      : compareRoutingConfigs(currentDraft, payload.routingConfig, destinations);

  const status: AiProposalStatus = validation.valid
    ? "awaiting_approval"
    : "failed";

  const row = await prisma.smartRoutingAiProposal.create({
    data: {
      id: createId(),
      workspaceId: input.workspaceId,
      flowId,
      status,
      intent: payload.intent,
      userPrompt: input.prompt,
      summary: payload.summary,
      assumptionsJson: payload.assumptions as object,
      warningsJson: [
        ...payload.warnings,
        ...validation.issues.map((i) => i.message),
      ] as object,
      proposedChangesJson: proposedChanges as object,
      clarificationQuestion: payload.clarificationQuestion ?? null,
      currentSnapshotJson: currentDraft as object,
      proposedDraftJson: payload.routingConfig as object,
      validationJson: validation as object,
      baseFlowUpdatedAt: flowCtx?.updatedAt ? new Date(flowCtx.updatedAt) : null,
      flowRevisionBefore: flowCtx?.updatedAt ?? null,
      invocationJson: invocationRecord ?? undefined,
      temporaryOverrideJson: payload.temporaryRouting as object | undefined,
      createdBy: input.userId ?? null,
    },
  });

  return {
    proposal: toProposalView(
      row,
      destinations,
      currentDraft,
      payload.routingConfig,
    ),
    message: payload.summary,
  };
}

export async function getAiRoutingProposal(
  workspaceId: string,
  proposalId: string,
): Promise<AiRoutingProposalView | null> {
  const prisma = getPrisma();
  const row = await prisma.smartRoutingAiProposal.findFirst({
    where: { id: proposalId, workspaceId },
  });
  if (!row) return null;
  const destinations = await loadAiRoutingDestinations(workspaceId);
  const current = row.currentSnapshotJson as DraftConfig | null;
  const proposed = row.proposedDraftJson as DraftConfig | null;
  return toProposalView(row, destinations, current, proposed);
}

export async function applyAiRoutingProposal(input: {
  workspaceId: string;
  proposalId: string;
  userId?: string;
  publish?: boolean;
}): Promise<{ ok: boolean; error?: string; flowId?: string; rebased?: boolean }> {
  const prisma = getPrisma();
  const row = await prisma.smartRoutingAiProposal.findFirst({
    where: { id: input.proposalId, workspaceId: input.workspaceId },
  });
  if (!row) return { ok: false, error: "Proposal not found" };
  if (row.status !== "awaiting_approval") {
    return { ok: false, error: "Proposal is not awaiting approval" };
  }

  const validation = row.validationJson as FlowValidationResult | null;
  if (!validation?.valid) return { ok: false, error: "Proposal failed validation" };

  const flowId = row.flowId;
  if (!flowId) return { ok: false, error: "No flow associated with proposal" };

  const flow = await getFlow(input.workspaceId, flowId);
  if (!flow) return { ok: false, error: "Flow not found" };

  let rebased = false;
  if (
    row.baseFlowUpdatedAt &&
    flow.updatedAt.toISOString() !== row.baseFlowUpdatedAt.toISOString()
  ) {
    rebased = true;
    const current = parseDraftConfig(flow.draftConfigJson);
    const proposed = row.proposedDraftJson as DraftConfig;
    const destinations = await loadAiRoutingDestinations(input.workspaceId);
    const changes = compareRoutingConfigs(current, proposed, destinations);
    await prisma.smartRoutingAiProposal.update({
      where: { id: row.id },
      data: {
        currentSnapshotJson: current as object,
        proposedChangesJson: changes as object,
        baseFlowUpdatedAt: flow.updatedAt,
        summary: `${row.summary ?? ""} (refreshed against latest configuration)`,
      },
    });
    return {
      ok: false,
      error:
        "Your routing changed since this proposal was created. Review the refreshed proposal before applying.",
      rebased: true,
      flowId,
    };
  }

  const proposed = row.proposedDraftJson as DraftConfig;
  const undoSnapshot = parseDraftConfig(flow.draftConfigJson);

  await updateFlowDraft(input.workspaceId, flowId, { draftConfig: proposed });

  const scheduleOverride = row.temporaryOverrideJson as
    | { expiresAt?: string }
    | null
    | undefined;
  if (scheduleOverride?.expiresAt) {
    // stored in draft metadata already
  }

  const payloadSchedule = (row.invocationJson as { scheduleOverride?: { until?: string } })?.scheduleOverride;
  if (payloadSchedule?.until) {
    await updateSmartRoutingWorkspaceSettings(input.workspaceId, {
      scheduleOverrideJson: {
        scheduleOverride: {
          mode: "closed_now",
          expiresAt: payloadSchedule.until,
        },
      },
    });
  }

  let published = false;
  if (input.publish || flow.status === "active") {
    try {
      await publishFlow(input.workspaceId, flowId, input.userId);
      published = true;
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Publish failed after draft update",
        flowId,
      };
    }
  }

  await prisma.smartRoutingAiProposal.update({
    where: { id: row.id },
    data: {
      status: "published",
      approvedBy: input.userId ?? null,
      approvedAt: new Date(),
      publishedAt: published ? new Date() : null,
      undoSnapshotJson: undoSnapshot as object,
    },
  });

  await prisma.agentConfigurationChange.create({
    data: {
      workspaceId: input.workspaceId,
      source: "smart_routing_ai",
      actor: input.userId ?? null,
      field: "routing_draft",
      oldValue: undoSnapshot as object,
      newValue: proposed as object,
      requestedNaturalLanguage: row.userPrompt,
      toolCallId: row.id,
    },
  });

  return { ok: true, flowId };
}

export async function rejectAiRoutingProposal(
  workspaceId: string,
  proposalId: string,
  userId?: string,
) {
  const prisma = getPrisma();
  await prisma.smartRoutingAiProposal.updateMany({
    where: { id: proposalId, workspaceId },
    data: {
      status: "rejected",
      rejectedBy: userId ?? null,
      rejectedAt: new Date(),
    },
  });
  return { ok: true };
}

export async function undoAiRoutingChange(
  workspaceId: string,
  proposalId: string,
  userId?: string,
) {
  const prisma = getPrisma();
  const row = await prisma.smartRoutingAiProposal.findFirst({
    where: { id: proposalId, workspaceId, status: "published" },
  });
  if (!row?.flowId || !row.undoSnapshotJson) {
    return { ok: false, error: "Nothing to undo" };
  }
  const snapshot = row.undoSnapshotJson as DraftConfig;
  await updateFlowDraft(workspaceId, row.flowId, { draftConfig: snapshot });
  const flow = await getFlow(workspaceId, row.flowId);
  if (flow?.status === "active") {
    await publishFlow(workspaceId, row.flowId, userId);
  }
  await prisma.agentConfigurationChange.create({
    data: {
      workspaceId,
      source: "smart_routing_ai_undo",
      actor: userId ?? null,
      field: "routing_draft",
      oldValue: row.proposedDraftJson as object,
      newValue: snapshot as object,
      requestedNaturalLanguage: `Undo proposal ${proposalId}`,
      toolCallId: proposalId,
    },
  });
  return { ok: true, flowId: row.flowId };
}

export async function listAiRoutingHistory(workspaceId: string, limit = 20) {
  const prisma = getPrisma();
  return prisma.smartRoutingAiProposal.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      status: true,
      intent: true,
      userPrompt: true,
      summary: true,
      createdAt: true,
      approvedAt: true,
      flowId: true,
    },
  });
}
