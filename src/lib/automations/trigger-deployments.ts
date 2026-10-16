/**
 * Trigger-owned deployments.
 *
 * Source of truth for editing: the trigger node on the AutomationFlow canvas
 * (e.g. Inbound Call with phoneNumberId + routingMode).
 *
 * On Activate:
 *   Trigger config → validate → upsert TriggerDeployment → publish Telnyx
 *   (direct DID → TeXML → assistant — automation worker is NOT in the audio path).
 *
 * My Numbers reads these rows as the global management view (Option A UI over
 * Option B source of truth).
 */

import { createId } from "@/lib/supabase/id";
import { getPrisma } from "@/lib/db";
import type { Prisma } from "@/lib/domain";
import {
  parseAutomationDefinition,
  type AutomationCanvasNode,
  type AutomationDefinition,
} from "@/lib/automations/types";
import { triggerFromBlockType } from "@/lib/automations/catalog";

export type InboundRoutingMode =
  | "every_call"
  | "overflow"
  | "after_hours"
  | "unanswered";

export type TriggerDeployStatus =
  | "draft"
  | "test"
  | "live"
  | "paused"
  | "error";

export type PauseFallback = "human" | "voicemail" | "backup_flow" | "reject";

export type ExtractedTrigger = {
  nodeId: string;
  blockType: string;
  channel: "voice" | "sms" | "email" | "webhook" | "schedule" | "manual";
  phoneNumberId: string | null;
  eventType: string;
  scheduleKey: string;
  mode: "test" | "live";
  pauseFallback: PauseFallback;
  pauseFallbackNumber: string | null;
  pauseFallbackFlowId: string | null;
  ringSeconds: number;
  config: Record<string, unknown>;
};

const VOICE_TRIGGER_BLOCKS = new Set([
  "inbound_call",
  "call_missed",
  "call_completed",
  "call_qualified",
  "call_voicemail_detected",
  "call_appointment_booked",
  "call_transferred",
]);

/** Event types that conflict if both are live on the same number. */
const CONFLICT_GROUPS: Record<string, string[]> = {
  every_call: ["every_call"],
  overflow: ["overflow", "unanswered"],
  unanswered: ["overflow", "unanswered"],
  after_hours: ["after_hours"],
};

export function channelForTriggerBlock(blockType: string): ExtractedTrigger["channel"] {
  if (VOICE_TRIGGER_BLOCKS.has(blockType)) return "voice";
  if (
    blockType === "incoming_sms" ||
    blockType === "keyword" ||
    blockType.startsWith("sms_")
  ) {
    return "sms";
  }
  if (blockType === "scheduled_datetime") return "schedule";
  if (blockType === "manual_enrollment") return "manual";
  if (blockType.includes("email")) return "email";
  return "webhook";
}

export function extractTriggersFromDefinition(
  definition: unknown,
): ExtractedTrigger[] {
  const def = parseAutomationDefinition(definition);
  const out: ExtractedTrigger[] = [];
  for (const node of def.nodes) {
    if (node.type !== "trigger") continue;
    const cfg = node.data.config || {};
    const blockType = node.data.blockType;
    const routingMode = String(
      cfg.routingMode ||
        (blockType === "call_missed" ? "unanswered" : "every_call"),
    );
    out.push({
      nodeId: node.id,
      blockType,
      channel: channelForTriggerBlock(blockType),
      phoneNumberId:
        typeof cfg.phoneNumberId === "string" && cfg.phoneNumberId.trim()
          ? cfg.phoneNumberId.trim()
          : null,
      eventType: routingMode,
      scheduleKey: String(cfg.schedule || cfg.scheduleKey || "always"),
      mode: cfg.mode === "test" ? "test" : "live",
      pauseFallback: (["human", "voicemail", "backup_flow", "reject"].includes(
        String(cfg.pauseFallback),
      )
        ? String(cfg.pauseFallback)
        : "human") as PauseFallback,
      pauseFallbackNumber:
        typeof cfg.pauseFallbackNumber === "string"
          ? cfg.pauseFallbackNumber || null
          : null,
      pauseFallbackFlowId:
        typeof cfg.pauseFallbackFlowId === "string"
          ? cfg.pauseFallbackFlowId || null
          : null,
      ringSeconds: Math.max(1, Number(cfg.ringSeconds || 20)),
      config: cfg,
    });
  }
  return out;
}

function findRunVoiceAgentId(def: AutomationDefinition): string | null {
  for (const node of def.nodes) {
    if (
      node.data.blockType === "run_voice_agent" ||
      node.data.blockType === "start_ai_call"
    ) {
      const id = String(node.data.config?.agentId || "").trim();
      if (id) return id;
    }
  }
  return null;
}

export type TriggerConflict = {
  phoneNumberId: string;
  eventType: string;
  existingFlowId: string;
  existingFlowName: string;
  existingTriggerNodeId: string;
  message: string;
};

export async function findTriggerConflicts(
  workspaceId: string,
  triggers: ExtractedTrigger[],
  excludeFlowId?: string,
): Promise<TriggerConflict[]> {
  const prisma = getPrisma();
  const conflicts: TriggerConflict[] = [];

  for (const t of triggers) {
    if (!t.phoneNumberId || t.channel !== "voice") continue;
    if (t.blockType !== "inbound_call" && t.blockType !== "call_missed") continue;

    const rivals = await prisma.triggerDeployment.findMany({
      where: {
        workspaceId,
        phoneNumberId: t.phoneNumberId,
        status: "live",
        ...(excludeFlowId ? { flowId: { not: excludeFlowId } } : {}),
      },
      include: {
        flow: { select: { id: true, name: true } },
      },
    });

    const group = CONFLICT_GROUPS[t.eventType] || [t.eventType];
    for (const row of rivals) {
      const otherGroup = CONFLICT_GROUPS[row.eventType] || [row.eventType];
      const overlaps = group.some((g) => otherGroup.includes(g));
      if (!overlaps) continue;
      conflicts.push({
        phoneNumberId: t.phoneNumberId,
        eventType: t.eventType,
        existingFlowId: row.flowId,
        existingFlowName: row.flow?.name || row.flowId,
        existingTriggerNodeId: row.triggerNodeId,
        message: `Number already has a live “${row.eventType}” trigger on “${row.flow?.name || row.flowId}”. Pause or change that flow before activating this overlapping rule.`,
      });
    }
  }

  return conflicts;
}

async function upsertTriggerRow(input: {
  workspaceId: string;
  flowId: string;
  trigger: ExtractedTrigger;
  status: TriggerDeployStatus;
  providerConfig?: Record<string, unknown> | null;
  errorMessage?: string | null;
}): Promise<string> {
  const prisma = getPrisma();
  const now = new Date();
  const existing = await prisma.triggerDeployment.findFirst({
    where: {
      flowId: input.flowId,
      triggerNodeId: input.trigger.nodeId,
    },
  });

  const data = {
    workspaceId: input.workspaceId,
    flowId: input.flowId,
    triggerNodeId: input.trigger.nodeId,
    triggerBlockType: input.trigger.blockType,
    channel: input.trigger.channel,
    phoneNumberId: input.trigger.phoneNumberId,
    eventType: input.trigger.eventType,
    scheduleKey: input.trigger.scheduleKey,
    status: input.status,
    pauseFallback: input.trigger.pauseFallback,
    pauseFallbackNumber: input.trigger.pauseFallbackNumber,
    pauseFallbackFlowId: input.trigger.pauseFallbackFlowId,
    providerConfig: (input.providerConfig ??
      undefined) as Prisma.InputJsonValue | undefined,
    errorMessage: input.errorMessage ?? null,
    deployedAt: input.status === "live" ? now : existing?.deployedAt || null,
    pausedAt: input.status === "paused" ? now : null,
    updatedAt: now,
  };

  if (existing) {
    await prisma.triggerDeployment.update({
      where: { id: existing.id },
      data,
    });
    return existing.id;
  }

  const id = createId();
  await prisma.triggerDeployment.create({
    data: {
      id,
      ...data,
      createdAt: now,
    },
  });
  return id;
}

export type ActivateTriggersResult = {
  deployments: Array<{ id: string; triggerNodeId: string; status: string }>;
  conflicts: TriggerConflict[];
  telnyxPublished: boolean;
  voiceAgentId: string | null;
};

/**
 * Activate = register triggers + allow nodes to execute.
 * For inbound_call with a number + Run Voice Agent: publish Telnyx routing.
 */
export async function activateFlowTriggers(
  workspaceId: string,
  flowId: string,
  definition: unknown,
  opts?: { forceTakeover?: boolean; forceVoiceProductSwitch?: boolean },
): Promise<ActivateTriggersResult> {
  const prisma = getPrisma();
  const def = parseAutomationDefinition(definition);
  const triggers = extractTriggersFromDefinition(def);
  const conflicts = await findTriggerConflicts(workspaceId, triggers, flowId);

  if (conflicts.length && !opts?.forceTakeover) {
    return {
      deployments: [],
      conflicts,
      telnyxPublished: false,
      voiceAgentId: null,
    };
  }

  if (opts?.forceTakeover && conflicts.length) {
    for (const c of conflicts) {
      await prisma.triggerDeployment.updateMany({
        where: {
          workspaceId,
          flowId: c.existingFlowId,
          triggerNodeId: c.existingTriggerNodeId,
          status: "live",
        },
        data: {
          status: "paused",
          pausedAt: new Date(),
          errorMessage: `Paused: number claimed by another activated flow (${flowId})`,
          updatedAt: new Date(),
        },
      });
    }
  }

  const voiceAgentId = findRunVoiceAgentId(def);
  let telnyxPublished = false;
  const inbound = triggers.find(
    (t) => t.blockType === "inbound_call" && t.phoneNumberId,
  );

  // Live inbound voice requires a Run Voice Agent + successful Telnyx publish.
  // Never mark the trigger live without provider confirmation.
  if (inbound?.phoneNumberId && inbound.mode === "live") {
    if (!voiceAgentId) {
      throw new Error(
        "Inbound Call (live) requires a Run Voice Agent node with an agent selected",
      );
    }

    const agent = await prisma.voiceAgent.findFirst({
      where: { id: voiceAgentId, workspaceId },
      select: {
        id: true,
        telnyxAssistantId: true,
        phoneNumberId: true,
        draftConfig: true,
      },
    });
    if (!agent) {
      throw new Error("Run Voice Agent references a missing VoiceAgent");
    }

    await prisma.voiceAgent.update({
      where: { id: voiceAgentId },
      data: {
        phoneNumberId: inbound.phoneNumberId,
        updatedAt: new Date(),
      },
    });

    let publishResult: Record<string, unknown> = {};
    try {
      const { publishVoiceAgent } = await import("@/lib/voice/agent-service");
      publishResult = (await publishVoiceAgent(
        workspaceId,
        voiceAgentId,
        "trigger-activate",
        {
          forceVoiceProductSwitch: opts?.forceVoiceProductSwitch,
        },
      )) as Record<string, unknown>;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await upsertTriggerRow({
        workspaceId,
        flowId,
        trigger: inbound,
        status: "error",
        errorMessage: message,
        providerConfig: {
          provider: "telnyx",
          channel: "voice",
          telnyxPublished: false,
          error: message,
          voiceAgentId,
        },
      });
      throw err;
    }

    const { parseVoiceAgentConfig } = await import("@/lib/voice/types");
    const { isAppointmentReceptionistAgent } = await import(
      "@/lib/voice-v3/config/from-published-agent"
    );
    const receptionistCfg = parseVoiceAgentConfig(agent.draftConfig);
    const appointmentReceptionist = isAppointmentReceptionistAgent(receptionistCfg);

    if (appointmentReceptionist) {
      const livekitProvision = publishResult.livekitProvision as
        | { ok?: boolean; error?: string }
        | null
        | undefined;
      if (!livekitProvision?.ok) {
        const message =
          livekitProvision?.error ||
          "LiveKit SIP provisioning failed — AI Receptionist cannot activate on Voice V3 Basic";
        await upsertTriggerRow({
          workspaceId,
          flowId,
          trigger: inbound,
          status: "error",
          errorMessage: message,
          providerConfig: {
            provider: "livekit",
            telnyxPublished: false,
            livekitProvision,
            voiceAgentId,
            publishResult,
          },
        });
        throw new Error(message);
      }
      telnyxPublished = true;
    } else {
      if (publishResult.telnyxSyncError) {
        const message = `Telnyx sync error: ${String(publishResult.telnyxSyncError)}`;
        await upsertTriggerRow({
          workspaceId,
          flowId,
          trigger: inbound,
          status: "error",
          errorMessage: message,
          providerConfig: {
            provider: "telnyx",
            telnyxPublished: false,
            voiceAgentId,
            publishResult,
          },
        });
        throw new Error(message);
      }

      const texmlRoute = publishResult.texmlRoute as
        | { matched?: boolean; path?: string }
        | null
        | undefined;
      if (texmlRoute && texmlRoute.matched !== true) {
        const message = `TeXML route not confirmed live (${texmlRoute.path || "unknown"})`;
        await upsertTriggerRow({
          workspaceId,
          flowId,
          trigger: inbound,
          status: "error",
          errorMessage: message,
          providerConfig: {
            provider: "telnyx",
            telnyxPublished: false,
            voiceAgentId,
            publishResult,
          },
        });
        throw new Error(message);
      }

      telnyxPublished = true;

      const refreshed = await prisma.voiceAgent.findFirst({
        where: { id: voiceAgentId },
        select: {
          telnyxAssistantId: true,
          telnyxConnectionId: true,
          phoneNumberId: true,
        },
      });
      if (!refreshed?.telnyxAssistantId) {
        const message =
          "Telnyx assistant was not created — cannot mark trigger live";
        await upsertTriggerRow({
          workspaceId,
          flowId,
          trigger: inbound,
          status: "error",
          errorMessage: message,
          providerConfig: {
            provider: "telnyx",
            telnyxPublished: false,
            voiceAgentId,
            publishResult,
          },
        });
        throw new Error(message);
      }
    }

    const refreshed = await prisma.voiceAgent.findFirst({
      where: { id: voiceAgentId },
      select: {
        telnyxAssistantId: true,
        telnyxConnectionId: true,
        phoneNumberId: true,
      },
    });

    const livekitProvision = publishResult.livekitProvision as
      | { ok?: boolean; provision?: { livekitInboundTrunkId?: string } }
      | null
      | undefined;

    const publishedConfigHash = appointmentReceptionist
      ? [
          inbound.phoneNumberId,
          voiceAgentId,
          livekitProvision?.provision?.livekitInboundTrunkId || "livekit_sip",
          inbound.eventType,
        ].join(":")
      : [
          inbound.phoneNumberId,
          voiceAgentId,
          refreshed?.telnyxAssistantId,
          inbound.eventType,
        ].join(":");

    await upsertTriggerRow({
      workspaceId,
      flowId,
      trigger: inbound,
      status: "live",
      providerConfig: {
        provider: appointmentReceptionist ? "livekit" : "telnyx",
        channel: "voice",
        telnyxPublished: true,
        voiceAgentId,
        telnyxAssistantId: refreshed?.telnyxAssistantId || null,
        providerResourceId: appointmentReceptionist
          ? livekitProvision?.provision?.livekitInboundTrunkId || "livekit_sip"
          : refreshed?.telnyxConnectionId || refreshed?.telnyxAssistantId,
        publishedConfigHash,
        publishedRoutingTarget: appointmentReceptionist
          ? "livekit_sip"
          : "texml_assistant",
        lastVerifiedAt: new Date().toISOString(),
        publishResult,
      },
      errorMessage: null,
    });
  }

  const deployments: ActivateTriggersResult["deployments"] = [];
  for (const t of triggers) {
    // Inbound already upserted above when Telnyx succeeded.
    if (
      inbound &&
      t.nodeId === inbound.nodeId &&
      inbound.phoneNumberId &&
      inbound.mode === "live"
    ) {
      const row = await prisma.triggerDeployment.findFirst({
        where: { flowId, triggerNodeId: t.nodeId },
        select: { id: true, status: true },
      });
      if (row) {
        deployments.push({
          id: row.id,
          triggerNodeId: t.nodeId,
          status: row.status,
        });
      }
      continue;
    }

    // Never silently mark a live inbound trigger without Telnyx publish.
    if (t.blockType === "inbound_call" && t.mode === "live" && t.phoneNumberId) {
      throw new Error(
        "Inbound Call live activation failed — Telnyx publish did not complete",
      );
    }

    const status: TriggerDeployStatus =
      t.mode === "test"
        ? "test"
        : t.channel === "schedule" || t.channel === "manual"
          ? "live"
          : "live";
    const id = await upsertTriggerRow({
      workspaceId,
      flowId,
      trigger: t,
      status,
      providerConfig: {
        telnyxPublished: false,
        voiceAgentId: null,
        ringSeconds: t.ringSeconds,
        label: triggerFromBlockType(t.blockType),
      },
      errorMessage: null,
    });
    deployments.push({ id, triggerNodeId: t.nodeId, status });
  }

  // Keep flow.linkedPhoneNumberIds in sync for inventory.
  const phoneIds = [
    ...new Set(
      triggers.map((t) => t.phoneNumberId).filter((x): x is string => Boolean(x)),
    ),
  ];
  if (phoneIds.length) {
    await prisma.automationFlow.update({
      where: { id: flowId },
      data: { linkedPhoneNumberIds: phoneIds, updatedAt: new Date() },
    });
  }

  return { deployments, conflicts: [], telnyxPublished, voiceAgentId };
}

/**
 * Pause = disable triggers without deleting config.
 * Inbound voice: apply pauseFallback so the business number does not go dark.
 * If fallback publishing fails, leave prior known-good routing intact.
 */
export async function pauseFlowTriggers(
  workspaceId: string,
  flowId: string,
): Promise<{ paused: number; fallbackNotes: string[]; errors: string[] }> {
  const prisma = getPrisma();
  const rows = await prisma.triggerDeployment.findMany({
    where: { workspaceId, flowId, status: { in: ["live", "test"] } },
  });

  const fallbackNotes: string[] = [];
  const errors: string[] = [];
  for (const row of rows) {
    const providerConfig = (row.providerConfig || {}) as Record<string, unknown>;
    const voiceAgentId =
      typeof providerConfig.voiceAgentId === "string"
        ? providerConfig.voiceAgentId
        : null;

    if (row.channel === "voice" && row.phoneNumberId) {
      const fallback = row.pauseFallback || "human";
      try {
        if (fallback === "human" && row.pauseFallbackNumber) {
          await prisma.phoneNumber.update({
            where: { id: row.phoneNumberId },
            data: { voiceForwardTo: row.pauseFallbackNumber },
          });
          // Clear exclusive AI ownership so the number is not left on a dead assistant.
          if (voiceAgentId) {
            await prisma.voiceAgent.updateMany({
              where: {
                id: voiceAgentId,
                workspaceId,
                phoneNumberId: row.phoneNumberId,
              },
              data: { phoneNumberId: null, updatedAt: new Date() },
            });
          }
          fallbackNotes.push(
            `Paused inbound on ${row.phoneNumberId}: forward to ${row.pauseFallbackNumber}.`,
          );
        } else if (fallback === "reject") {
          fallbackNotes.push(
            `Paused inbound on ${row.phoneNumberId}: reject until reactivated (configure TeXML reject).`,
          );
        } else if (fallback === "voicemail") {
          fallbackNotes.push(
            `Paused inbound on ${row.phoneNumberId}: voicemail fallback requested.`,
          );
        } else if (fallback === "backup_flow") {
          fallbackNotes.push(
            `Paused inbound on ${row.phoneNumberId}: backup flow ${row.pauseFallbackFlowId || "(unset)"}.`,
          );
        } else {
          fallbackNotes.push(
            `Paused inbound on ${row.phoneNumberId}: configure pauseFallbackNumber for human routing.`,
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(message);
        // Do not mark paused if we could not apply fallback for a live voice number.
        await prisma.triggerDeployment.update({
          where: { id: row.id },
          data: {
            errorMessage: `Pause fallback failed: ${message}`,
            updatedAt: new Date(),
          },
        });
        continue;
      }
    }

    await prisma.triggerDeployment.update({
      where: { id: row.id },
      data: {
        status: "paused",
        pausedAt: new Date(),
        updatedAt: new Date(),
        errorMessage: null,
      },
    });
  }

  return { paused: rows.length - errors.length, fallbackNotes, errors };
}

export async function listTriggerDeploymentsForWorkspace(workspaceId: string) {
  const prisma = getPrisma();
  return prisma.triggerDeployment.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
    include: {
      flow: {
        select: {
          id: true,
          name: true,
          status: true,
          ownershipKind: true,
          ownerLabel: true,
        },
      },
      phoneNumber: {
        select: { id: true, e164: true, friendlyName: true },
      },
    },
  });
}

/** Used by validation / UI — whether a trigger node needs a number before activate. */
export function inboundCallRequiresNumber(node: AutomationCanvasNode): boolean {
  return (
    node.data.blockType === "inbound_call" &&
    !String(node.data.config?.phoneNumberId || "").trim()
  );
}
