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
import { agentTypeFromOutcomeSlug } from "@/lib/agents/types";

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
    name: (partial.name ?? base.name).toString().trim() || base.name,
    firstMessage:
      (partial.firstMessage ?? base.firstMessage).toString().trim() ||
      base.firstMessage,
    followUpMessage:
      (partial.followUpMessage ?? base.followUpMessage).toString().trim() ||
      base.followUpMessage,
    initialDelayMinutes: Math.max(
      0,
      Number(partial.initialDelayMinutes ?? base.initialDelayMinutes),
    ),
    replyWindowMinutes: Math.max(
      1,
      Number(partial.replyWindowMinutes ?? base.replyWindowMinutes),
    ),
    followUpDelayMinutes: Math.max(
      0,
      Number(partial.followUpDelayMinutes ?? base.followUpDelayMinutes),
    ),
  };
}

function isUniqueViolation(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code?: string }).code || "")
      : "";
  return code === "P2002" || /duplicate|unique/i.test(message);
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

  let existingSetup = input.setupId
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

  let existingFlow = flowId
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
    advancedCustomized =
      existingFlow.advancedCustomized || patched.advancedCustomized;
  } else {
    definition = buildMissedCallTextBackDefinition(config);
    advancedCustomized = false;
  }

  const triggerLabel = triggerFromBlockType("call_missed") || "Missed call";

  // "Save draft" must not deactivate an already-live automation. Pause/resume
  // stays on the Automations page. Activate=true always goes live.
  const wasActive =
    existingFlow?.status === "ACTIVE" || existingSetup?.status === "ACTIVE";
  const status = config.activate || wasActive ? "ACTIVE" : "DRAFT";
  const setupStatus = status;
  const setupConfigJson = {
    ...config,
    outcomeSlug: SOLUTION_TYPE,
    agentType: agentTypeFromOutcomeSlug(SOLUTION_TYPE),
  } as unknown as Prisma.InputJsonValue;

  if (!setupId) {
    created = true;
    setupId = createId();
    try {
      await prisma.solutionSetup.create({
        data: {
          id: setupId,
          workspaceId,
          solutionType: SOLUTION_TYPE,
          name: config.name,
          status: setupStatus,
          configJson: setupConfigJson,
          linkedAutomationIds: [],
          linkedPhoneNumberIds: config.phoneNumberId ? [config.phoneNumberId] : [],
          externalKey: EXTERNAL_KEY,
          createdAt: now,
          updatedAt: now,
        },
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Concurrent first-save race — reload and continue as update.
      existingSetup = await prisma.solutionSetup.findFirst({
        where: {
          workspaceId,
          solutionType: SOLUTION_TYPE,
          externalKey: EXTERNAL_KEY,
        },
      });
      if (!existingSetup) throw err;
      setupId = existingSetup.id;
      created = false;
      flowId = (existingSetup.linkedAutomationIds as string[] | undefined)?.[0];
      existingFlow = flowId
        ? await prisma.automationFlow.findFirst({
            where: { id: flowId, workspaceId },
          })
        : await prisma.automationFlow.findFirst({
            where: { workspaceId, sourceSolutionSetupId: setupId },
          });
      if (existingFlow) flowId = existingFlow.id;
    }
  }

  // Always persist latest wizard config onto the setup (covers update + race paths).
  await prisma.solutionSetup.update({
    where: { id: setupId },
    data: {
      name: config.name,
      status: setupStatus,
      configJson: setupConfigJson,
      linkedPhoneNumberIds: config.phoneNumberId ? [config.phoneNumberId] : [],
      updatedAt: now,
    },
  });

  if (!flowId) {
    // Another concurrent save may have linked a flow already.
    const racedFlow = await prisma.automationFlow.findFirst({
      where: { workspaceId, sourceSolutionSetupId: setupId },
    });
    if (racedFlow) {
      flowId = racedFlow.id;
      existingFlow = racedFlow;
      advancedCustomized =
        Boolean(racedFlow.advancedCustomized) || advancedCustomized;
      if (racedFlow.advancedCustomized) {
        const patched = applyWizardConfigToDefinition(
          racedFlow.definition,
          config,
        );
        definition = patched.definition;
        advancedCustomized = true;
      }
    }
  }

  // Keep enrollment keys stable while live. Only bump when first activating.
  const nextVersion =
    status === "ACTIVE"
      ? existingFlow?.status === "ACTIVE"
        ? Math.max(1, Number(existingFlow.version || 1))
        : Math.max(1, Number(existingFlow?.version || 0) + 1)
      : Number(existingFlow?.version || 0);

  if (!flowId) {
    created = true;
    flowId = createId();
    const createData: Record<string, unknown> = {
      id: flowId,
      workspaceId,
      name: config.name,
      description: "Generated from Missed Call Text Back",
      trigger: triggerLabel,
      definition: definition as unknown as Prisma.InputJsonValue,
      version: nextVersion,
      status,
      sourceSolutionSetupId: setupId,
      linkedPhoneNumberIds: config.phoneNumberId ? [config.phoneNumberId] : [],
      advancedCustomized: false,
      createdAt: now,
      updatedAt: now,
    };
    if (status === "ACTIVE") {
      createData.publishedDefinition =
        definition as unknown as Prisma.InputJsonValue;
      createData.publishedAt = now;
    }
    await prisma.automationFlow.create({ data: createData });
  } else {
    const updateData: Record<string, unknown> = {
      name: config.name,
      description: "Generated from Missed Call Text Back",
      trigger: triggerLabel,
      definition: definition as unknown as Prisma.InputJsonValue,
      version: nextVersion,
      status,
      sourceSolutionSetupId: setupId,
      linkedPhoneNumberIds: config.phoneNumberId ? [config.phoneNumberId] : [],
      advancedCustomized,
      updatedAt: now,
    };
    if (status === "ACTIVE") {
      updateData.publishedDefinition =
        definition as unknown as Prisma.InputJsonValue;
      updateData.publishedAt = now;
    }
    await prisma.automationFlow.update({
      where: { id: flowId },
      data: updateData,
    });
  }

  await prisma.solutionSetup.update({
    where: { id: setupId! },
    data: {
      linkedAutomationIds: [flowId!],
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
    solutionSetupId: setupId!,
    automationId: flowId!,
    payload: { solutionType: SOLUTION_TYPE, name: config.name },
    idempotencyKey: `mctb-save:${setupId}:${status}:${nextVersion}:${Date.now()}`,
  }).catch(() => undefined);

  return {
    setupId: setupId!,
    flowId: flowId!,
    advancedCustomized,
    created,
  };
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

  const linkedFlowId = (setup.linkedAutomationIds as string[])?.[0];
  const flow = linkedFlowId
    ? await prisma.automationFlow.findFirst({
        where: { id: linkedFlowId, workspaceId },
      })
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
