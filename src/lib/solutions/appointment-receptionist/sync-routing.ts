import type { AnswerWhen, AppointmentReceptionistWizardState } from "./types";

/** Soft-replace tag for wizard-owned VoiceRoutingRule rows. */
export const WIZARD_ROUTING_MANAGED = "wizardManaged" as const;

type RingBehavior = AppointmentReceptionistWizardState["ringBehavior"];

export type WizardRoutingMode =
  | "ai_answer"
  | "human_first"
  | "ai_after_hours"
  | "overflow"
  | "custom_schedule";

/**
 * Resolve routing mode from wizard answerWhen / ringBehavior.
 * Mirrors shapes used by syncRoutingRulesFromFlow in voice/flow/compile.ts.
 */
export function resolveWizardRoutingMode(input: {
  answerWhen: AnswerWhen;
  ringBehavior: RingBehavior;
}): WizardRoutingMode {
  const { answerWhen, ringBehavior } = input;

  if (answerWhen === "nobody_answers" || ringBehavior === "ring_team_first") {
    return "human_first";
  }
  if (answerWhen === "line_busy") {
    return "overflow";
  }
  if (answerWhen === "custom_schedule" || ringBehavior === "custom") {
    return "custom_schedule";
  }
  if (answerWhen === "after_hours" || ringBehavior === "after_hours") {
    return "ai_after_hours";
  }
  // every_call / ai_immediate — AI answers immediately
  return "ai_answer";
}

async function clearWizardManagedRules(workspaceId: string, agentId: string) {
  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();
  const existing = await prisma.voiceRoutingRule.findMany({
    where: { workspaceId, agentId },
  });
  for (const rule of existing) {
    const meta = (rule.conditions || {}) as Record<string, unknown>;
    if (meta[WIZARD_ROUTING_MANAGED] || meta.wizardManaged) {
      await prisma.voiceRoutingRule.delete({ where: { id: rule.id } });
    }
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

  await clearWizardManagedRules(input.workspaceId, input.agentId);

  const mode = resolveWizardRoutingMode({
    answerWhen: input.answerWhen,
    ringBehavior: input.ringBehavior,
  });
  const ringSeconds = Math.max(5, Math.min(120, Number(input.ringTeamSeconds) || 20));
  const timezone = (input.timezone || "America/New_York").trim() || "America/New_York";
  const agentId = input.agentId;
  const workspaceId = input.workspaceId;

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
        },
      },
    });
    return { mode, rulesCreated: 2 };
  }

  if (mode === "ai_after_hours") {
    // Single ai_after_hours rule: resolveEffectiveAction maps to human_first
    // in-hours and ai_answer after hours (workspace business hours).
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
}
