import type { AnswerWhen, AppointmentReceptionistWizardState } from "./types";
import {
  resolveWizardRoutingMode,
  type WizardRoutingMode,
} from "./routing-mode";

export { resolveWizardRoutingMode, type WizardRoutingMode };

/** Soft-replace tag for wizard-owned VoiceRoutingRule rows. */
export const WIZARD_ROUTING_MANAGED = "wizardManaged" as const;

type RingBehavior = AppointmentReceptionistWizardState["ringBehavior"];

async function clearWizardManagedRules(workspaceId: string, agentId: string) {
  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();
  const existing = await prisma.voiceRoutingRule.findMany({
    where: { workspaceId, agentId },
  });
  const deleted: Array<{
    name: string;
    priority: number;
    isActive: boolean;
    conditions: unknown;
    actions: unknown;
  }> = [];
  for (const rule of existing) {
    const meta = (rule.conditions || {}) as Record<string, unknown>;
    if (meta[WIZARD_ROUTING_MANAGED] || meta.wizardManaged) {
      deleted.push({
        name: rule.name,
        priority: rule.priority,
        isActive: rule.isActive,
        conditions: rule.conditions,
        actions: rule.actions,
      });
      await prisma.voiceRoutingRule.delete({ where: { id: rule.id } });
    }
  }
  return deleted;
}

async function restoreWizardManagedRules(
  workspaceId: string,
  agentId: string,
  snapshot: Awaited<ReturnType<typeof clearWizardManagedRules>>,
) {
  if (!snapshot.length) return;
  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();
  for (const row of snapshot) {
    await prisma.voiceRoutingRule.create({
      data: {
        workspaceId,
        agentId,
        name: row.name,
        priority: row.priority,
        isActive: row.isActive,
        conditions: row.conditions as object,
        actions: row.actions as object,
      },
    });
  }
}

/**
 * Upsert agent VoiceRoutingRule rows from Appointment Receptionist wizard
 * answerWhen / ringBehavior / ringTeamSeconds / timezone.
 * Reuses the same actions/conditions shapes as syncRoutingRulesFromFlow.
 */
export async function syncWizardRoutingRules(input: {
  workspaceId: string;
  agentId: string;
  answerWhen: AnswerWhen;
  ringBehavior: RingBehavior;
  ringTeamSeconds: number;
  timezone?: string;
}) {
  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();

  const snapshot = await clearWizardManagedRules(input.workspaceId, input.agentId);

  const mode = resolveWizardRoutingMode({
    answerWhen: input.answerWhen,
    ringBehavior: input.ringBehavior,
  });
  const ringSeconds = Math.max(5, Math.min(120, Number(input.ringTeamSeconds) || 20));
  const timezone = (input.timezone || "America/New_York").trim() || "America/New_York";
  const agentId = input.agentId;
  const workspaceId = input.workspaceId;

  try {
    if (mode === "human_first") {
      await prisma.voiceRoutingRule.create({
        data: {
          workspaceId,
          agentId,
          name: "Wizard: human first then AI",
          priority: 10,
          isActive: true,
          conditions: {
            wizardManaged: true,
            businessHoursOnly: true,
            timezone,
          },
          actions: {
            type: "human_first",
            agentId,
            ringSeconds,
            timeoutSeconds: ringSeconds,
            timezone,
            fallback: "ai_answer",
          },
        },
      });
      await prisma.voiceRoutingRule.create({
        data: {
          workspaceId,
          agentId,
          name: "Wizard: after-hours AI",
          priority: 20,
          isActive: true,
          conditions: {
            wizardManaged: true,
            afterHoursOnly: true,
            timezone,
          },
          actions: {
            type: "ai_after_hours",
            agentId,
            timezone,
          },
        },
      });
      return { mode, rulesCreated: 2 };
    }

    if (mode === "ai_after_hours") {
      // Single ai_after_hours rule: resolveEffectiveAction maps to human_first
      // in-hours and ai_answer after hours using the wizard timezone when set.
      await prisma.voiceRoutingRule.create({
        data: {
          workspaceId,
          agentId,
          name: "Wizard: AI after hours",
          priority: 10,
          isActive: true,
          conditions: {
            wizardManaged: true,
            timezone,
          },
          actions: {
            type: "ai_after_hours",
            agentId,
            timezone,
          },
        },
      });
      return { mode, rulesCreated: 1 };
    }

    if (mode === "custom_schedule") {
      // After-hours-style with wizard timezone on conditions for matching.
      await prisma.voiceRoutingRule.create({
        data: {
          workspaceId,
          agentId,
          name: "Wizard: custom schedule after hours AI",
          priority: 10,
          isActive: true,
          conditions: {
            wizardManaged: true,
            afterHoursOnly: true,
            timezone,
          },
          actions: {
            type: "ai_after_hours",
            agentId,
            timezone,
          },
        },
      });
      await prisma.voiceRoutingRule.create({
        data: {
          workspaceId,
          agentId,
          name: "Wizard: custom schedule business hours",
          priority: 20,
          isActive: true,
          conditions: {
            wizardManaged: true,
            businessHoursOnly: true,
            timezone,
          },
          actions: {
            type: "human_first",
            agentId,
            ringSeconds,
            timeoutSeconds: ringSeconds,
            timezone,
            fallback: "ai_answer",
          },
        },
      });
      return { mode, rulesCreated: 2 };
    }

    if (mode === "overflow") {
      // line_busy → overflow to AI agent (existing overflow / ai_agent pattern).
      await prisma.voiceRoutingRule.create({
        data: {
          workspaceId,
          agentId,
          name: "Wizard: line busy overflow to AI",
          priority: 10,
          isActive: true,
          conditions: {
            wizardManaged: true,
            timezone,
          },
          actions: {
            type: "overflow",
            overflowType: "ai_agent",
            agentId,
            overflowAgentId: agentId,
          },
        },
      });
      return { mode, rulesCreated: 1 };
    }

    // every_call / ai_immediate — AI answers immediately (cleared human_first above).
    await prisma.voiceRoutingRule.create({
      data: {
        workspaceId,
        agentId,
        name: "Wizard: AI answer",
        priority: 10,
        isActive: true,
        conditions: {
          wizardManaged: true,
        },
        actions: {
          type: "ai_answer",
          agentId,
        },
      },
    });
    return { mode, rulesCreated: 1 };
  } catch (err) {
    // Clear any partially created rules before restoring the prior snapshot.
    await clearWizardManagedRules(workspaceId, agentId).catch(() => undefined);
    await restoreWizardManagedRules(workspaceId, agentId, snapshot).catch(() => undefined);
    throw err;
  }
}
