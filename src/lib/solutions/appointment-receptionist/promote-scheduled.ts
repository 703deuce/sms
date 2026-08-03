/**
 * Promote appointment / receptionist agents whose activation was scheduled
 * and whose scheduledAt is now in the past.
 *
 * Wizard stores `advanced.activationMode === "schedule"` + `advanced.scheduledAt`
 * and keeps the agent as DRAFT until this publisher runs.
 */

import { getPrisma } from "@/lib/db";
import { publishVoiceAgent } from "@/lib/voice/agent-service";

export type PromoteScheduledResult = {
  scanned: number;
  promoted: number;
  failed: number;
  skipped: number;
  results: Array<{
    agentId: string;
    workspaceId: string;
    ok: boolean;
    error?: string;
    scheduledAt?: string | null;
  }>;
};

function readScheduleMeta(draftConfig: unknown): {
  activationMode: string | null;
  scheduledAt: string | null;
} {
  if (!draftConfig || typeof draftConfig !== "object") {
    return { activationMode: null, scheduledAt: null };
  }
  const draft = draftConfig as Record<string, unknown>;
  const advanced =
    draft.advanced && typeof draft.advanced === "object"
      ? (draft.advanced as Record<string, unknown>)
      : {};
  const wizard =
    advanced.appointmentReceptionistWizard &&
    typeof advanced.appointmentReceptionistWizard === "object"
      ? (advanced.appointmentReceptionistWizard as Record<string, unknown>)
      : {};

  const activationMode =
    (typeof advanced.activationMode === "string" && advanced.activationMode) ||
    (typeof wizard.activationMode === "string" && wizard.activationMode) ||
    null;
  const scheduledAtRaw =
    (typeof advanced.scheduledAt === "string" && advanced.scheduledAt) ||
    (typeof wizard.scheduledAt === "string" && wizard.scheduledAt) ||
    null;

  return { activationMode, scheduledAt: scheduledAtRaw };
}

/**
 * Find DRAFT agents with schedule activation due and publish them.
 */
export async function promoteScheduledReceptionists(opts?: {
  now?: Date;
  limit?: number;
  workspaceId?: string;
}): Promise<PromoteScheduledResult> {
  const prisma = getPrisma();
  const now = opts?.now || new Date();
  const limit = Math.min(Math.max(opts?.limit || 50, 1), 200);

  const candidates = await prisma.voiceAgent.findMany({
    where: {
      status: "DRAFT",
      ...(opts?.workspaceId ? { workspaceId: opts.workspaceId } : {}),
      OR: [
        { draftConfig: { path: ["advanced", "activationMode"], equals: "schedule" } },
        {
          draftConfig: {
            path: ["advanced", "appointmentReceptionistWizard", "activationMode"],
            equals: "schedule",
          },
        },
      ],
    },
    select: {
      id: true,
      workspaceId: true,
      draftConfig: true,
      name: true,
    },
    take: limit * 3,
    orderBy: { updatedAt: "asc" },
  });

  const results: PromoteScheduledResult["results"] = [];
  let promoted = 0;
  let failed = 0;
  let skipped = 0;
  let scanned = 0;

  for (const agent of candidates) {
    if (promoted + failed + skipped >= limit) break;
    scanned += 1;

    const meta = readScheduleMeta(agent.draftConfig);
    if (meta.activationMode !== "schedule" || !meta.scheduledAt) {
      skipped += 1;
      results.push({
        agentId: agent.id,
        workspaceId: agent.workspaceId,
        ok: false,
        error: "missing_schedule_meta",
        scheduledAt: meta.scheduledAt,
      });
      continue;
    }

    const when = new Date(meta.scheduledAt);
    if (Number.isNaN(when.getTime()) || when.getTime() > now.getTime()) {
      skipped += 1;
      continue;
    }

    try {
      await publishVoiceAgent(agent.workspaceId, agent.id, "scheduled_activation");

      const draft = (agent.draftConfig || {}) as Record<string, unknown>;
      const advanced = (draft.advanced || {}) as Record<string, unknown>;
      const wizard =
        advanced.appointmentReceptionistWizard &&
        typeof advanced.appointmentReceptionistWizard === "object"
          ? (advanced.appointmentReceptionistWizard as Record<string, unknown>)
          : {};

      await prisma.voiceAgent.update({
        where: { id: agent.id },
        data: {
          draftConfig: {
            ...draft,
            advanced: {
              ...advanced,
              activationMode: "activate_now",
              scheduledAt: meta.scheduledAt,
              scheduledActivatedAt: now.toISOString(),
              appointmentReceptionistWizard: {
                ...wizard,
                activationMode: "activate_now",
                scheduledAt: meta.scheduledAt,
                scheduledActivatedAt: now.toISOString(),
              },
            },
          },
        },
      });

      promoted += 1;
      results.push({
        agentId: agent.id,
        workspaceId: agent.workspaceId,
        ok: true,
        scheduledAt: meta.scheduledAt,
      });
      console.info("[promote-scheduled] published receptionist", {
        agentId: agent.id,
        workspaceId: agent.workspaceId,
        scheduledAt: meta.scheduledAt,
      });
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      results.push({
        agentId: agent.id,
        workspaceId: agent.workspaceId,
        ok: false,
        error: message,
        scheduledAt: meta.scheduledAt,
      });
      console.warn("[promote-scheduled] publish failed", {
        agentId: agent.id,
        error: message,
      });
    }
  }

  return { scanned, promoted, failed, skipped, results };
}
