import type { Prisma } from "@/lib/domain";
import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import { triggerFromBlockType } from "@/lib/automations/catalog";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { buildMissedCallTextBackDefinition } from "@/lib/solutions/missed-call-text-back/graph";
import {
  applyWizardConfigToDefinition,
  configFromDefinition,
} from "@/lib/solutions/missed-call-text-back/sync";
import {
  DEFAULT_MISSED_CALL_TEXT_BACK_CONFIG,
  EXTERNAL_KEY,
  SOLUTION_TYPE,
  type MissedCallTextBackConfig,
} from "@/lib/solutions/missed-call-text-back/types";
import { emitPlatformEvent } from "@/lib/platform/events";

export type SaveMissedCallTextBackResult = {
  setupId: string;
  flowId: string;
  advancedCustomized: boolean;
  created: boolean;
};

function mergeConfig(
  partial: Partial<MissedCallTextBackConfig>,
  base: MissedCallTextBackConfig = DEFAULT_MISSED_CALL_TEXT_BACK_CONFIG,
): MissedCallTextBackConfig {
  return {
    ...base,
    ...partial,
    name: (partial.name || base.name).trim() || base.name,
    firstMessage: (partial.firstMessage || base.firstMessage).trim(),
    followUpMessage: (partial.followUpMessage || base.followUpMessage).trim(),
    initialDelayMinutes: Math.max(0, Number(partial.initialDelayMinutes ?? base.initialDelayMinutes)),
    replyWindowMinutes: Math.max(1, Number(partial.replyWindowMinutes ?? base.replyWindowMinutes)),
    followUpDelayMinutes: Math.max(
      0,
      Number(partial.followUpDelayMinutes ?? base.followUpDelayMinutes),
    ),
  };
}

/**
 * Idempotent create-or-update for Missed Call Text Back.
 * One SolutionSetup + one linked AutomationFlow per workspace default key.
 */
export async function saveMissedCallTextBack(
  workspaceId: string,
  input: Partial<MissedCallTextBackConfig> & { setupId?: string },
): Promise<SaveMissedCallTextBackResult> {
  const prisma = getPrisma();
  const now = new Date().toISOString();

  const existingSetup = input.setupId
    ? await prisma.solutionSetup.findFirst({
        where: { id: input.setupId, workspaceId, solutionType: SOLUTION_TYPE },
      })
    : await prisma.solutionSetup.findFirst({
        where: {
          workspaceId,
          solutionType: SOLUTION_TYPE,
          externalKey: EXTERNAL_KEY,
        },
      });

  let created = false;
  let setupId = existingSetup?.id as string | undefined;
  let flowId = (existingSetup?.linkedAutomationIds as string[] | undefined)?.[0];

  const existingFlow = flowId
    ? await prisma.automationFlow.findFirst({
        where: { id: flowId, workspaceId },
      })
    : setupId
      ? await prisma.automationFlow.findFirst({
          where: { workspaceId, sourceSolutionSetupId: setupId },
        })
      : null;

  if (existingFlow) flowId = existingFlow.id;

  const baseConfig = existingFlow
    ? configFromDefinition(
        existingFlow.definition,
        mergeConfig(
          (existingSetup?.configJson as Partial<MissedCallTextBackConfig>) || {},
        ),
      )
    : mergeConfig(
        (existingSetup?.configJson as Partial<MissedCallTextBackConfig>) || {},
      );

  const config = mergeConfig(input, baseConfig);

  let definition;
  let advancedCustomized = Boolean(existingFlow?.advancedCustomized);

  if (existingFlow) {
    const patched = applyWizardConfigToDefinition(existingFlow.definition, config);
    definition = patched.definition;
    advancedCustomized = existingFlow.advancedCustomized || patched.advancedCustomized;
  } else {
    definition = buildMissedCallTextBackDefinition(config);
    advancedCustomized = false;
  }

  const triggerLabel = triggerFromBlockType("call_missed") || "Missed call";
  const status = config.activate ? "ACTIVE" : "DRAFT";
  const setupStatus = config.activate ? "ACTIVE" : "DRAFT";

  if (!setupId) {
    created = true;
    setupId = createId();
    await prisma.solutionSetup.create({
      data: {
        id: setupId,
        workspaceId,
        solutionType: SOLUTION_TYPE,
        name: config.name,
        status: setupStatus,
        configJson: config as unknown as Prisma.InputJsonValue,
        linkedAutomationIds: [],
        linkedPhoneNumberIds: config.phoneNumberId ? [config.phoneNumberId] : [],
        externalKey: EXTERNAL_KEY,
        createdAt: now,
        updatedAt: now,
      },
    });
  } else {
    await prisma.solutionSetup.update({
      where: { id: setupId },
      data: {
        name: config.name,
        status: setupStatus,
        configJson: config as unknown as Prisma.InputJsonValue,
        linkedPhoneNumberIds: config.phoneNumberId ? [config.phoneNumberId] : [],
        updatedAt: now,
      },
    });
  }

  if (!flowId) {
    created = true;
    flowId = createId();
    await prisma.automationFlow.create({
      data: {
        id: flowId,
        workspaceId,
        name: config.name,
        description: "Generated from Missed Call Text Back",
        trigger: triggerLabel,
        definition: definition as unknown as Prisma.InputJsonValue,
        publishedDefinition:
          status === "ACTIVE"
            ? (definition as unknown as Prisma.InputJsonValue)
            : undefined,
        version: status === "ACTIVE" ? 1 : 0,
        status,
        sourceSolutionSetupId: setupId,
        linkedPhoneNumberIds: config.phoneNumberId ? [config.phoneNumberId] : [],
        advancedCustomized: false,
        publishedAt: status === "ACTIVE" ? now : undefined,
        createdAt: now,
        updatedAt: now,
      },
    });
  } else {
    const nextVersion =
      status === "ACTIVE" ? Number(existingFlow?.version || 0) + 1 : existingFlow?.version;
    await prisma.automationFlow.update({
      where: { id: flowId },
      data: {
        name: config.name,
        trigger: triggerLabel,
        definition: definition as unknown as Prisma.InputJsonValue,
        publishedDefinition:
          status === "ACTIVE"
            ? (definition as unknown as Prisma.InputJsonValue)
            : undefined,
        version: nextVersion,
        status,
        sourceSolutionSetupId: setupId,
        linkedPhoneNumberIds: config.phoneNumberId ? [config.phoneNumberId] : [],
        advancedCustomized,
        publishedAt: status === "ACTIVE" ? now : existingFlow?.publishedAt,
        updatedAt: now,
      },
    });
  }

  await prisma.solutionSetup.update({
    where: { id: setupId },
    data: {
      linkedAutomationIds: [flowId],
      updatedAt: now,
    },
  });

  if (status === "ACTIVE") {
    await enqueueJob({
      jobType: "automation_tick",
      queueName: "automations",
      workspaceId,
      payload: { flowId, workspaceId },
      idempotencyKey: `automation-tick:${flowId}:${new Date().toISOString().slice(0, 16)}`,
    }).catch(() => undefined);
  }

  await emitPlatformEvent({
    workspaceId,
    type: created ? "SOLUTION_SETUP_CREATED" : "SOLUTION_SETUP_UPDATED",
    solutionSetupId: setupId,
    automationId: flowId,
    payload: { solutionType: SOLUTION_TYPE, name: config.name },
    idempotencyKey: `mctb-save:${setupId}:${Date.now()}`,
  }).catch(() => undefined);

  return { setupId, flowId, advancedCustomized, created };
}

export async function loadMissedCallTextBack(
  workspaceId: string,
  setupId?: string,
): Promise<{
  setupId: string | null;
  flowId: string | null;
  config: MissedCallTextBackConfig;
  advancedCustomized: boolean;
  status: string;
} | null> {
  const prisma = getPrisma();
  const setup = setupId
    ? await prisma.solutionSetup.findFirst({
        where: { id: setupId, workspaceId, solutionType: SOLUTION_TYPE },
      })
    : await prisma.solutionSetup.findFirst({
        where: {
          workspaceId,
          solutionType: SOLUTION_TYPE,
          externalKey: EXTERNAL_KEY,
        },
      });

  if (!setup) {
    return {
      setupId: null,
      flowId: null,
      config: DEFAULT_MISSED_CALL_TEXT_BACK_CONFIG,
      advancedCustomized: false,
      status: "DRAFT",
    };
  }

  const flowId = (setup.linkedAutomationIds as string[])?.[0];
  const flow = flowId
    ? await prisma.automationFlow.findFirst({ where: { id: flowId, workspaceId } })
    : await prisma.automationFlow.findFirst({
        where: { workspaceId, sourceSolutionSetupId: setup.id },
      });

  const stored = (setup.configJson || {}) as Partial<MissedCallTextBackConfig>;
  const config = flow
    ? configFromDefinition(flow.definition, mergeConfig(stored))
    : mergeConfig(stored);

  return {
    setupId: setup.id,
    flowId: flow?.id || null,
    config: {
      ...config,
      name: setup.name || config.name,
      activate: setup.status === "ACTIVE",
    },
    advancedCustomized: Boolean(flow?.advancedCustomized),
    status: setup.status,
  };
}
