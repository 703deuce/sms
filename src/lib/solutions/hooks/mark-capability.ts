import { getPrisma } from "@/lib/db";
import type { CapabilityHookContext, CapabilityRegistration, CapabilityHookStatus } from "./types";

/**
 * Mark a capability as activated on the agent draftConfig.advanced.capabilityHooks.
 */
export async function markCapabilityHook(
  ctx: CapabilityHookContext,
  id: string,
): Promise<void> {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: ctx.agentId, workspaceId: ctx.workspaceId },
    select: { draftConfig: true },
  });
  if (!agent) {
    console.warn(`[capability-hooks] agent not found for ${id}`, ctx.agentId);
    return;
  }

  const draft = (agent.draftConfig || {}) as Record<string, unknown>;
  const advanced = (draft.advanced || {}) as Record<string, unknown>;
  const prev =
    advanced.capabilityHooks && typeof advanced.capabilityHooks === "object"
      ? (advanced.capabilityHooks as Record<string, unknown>)
      : {};

  await prisma.voiceAgent.update({
    where: { id: ctx.agentId },
    data: {
      draftConfig: {
        ...draft,
        advanced: {
          ...advanced,
          capabilityHooks: {
            ...prev,
            [id]: true,
          },
        },
      },
    },
  });

  console.info(`[capability-hooks] ${id} marked on agent`, {
    agentId: ctx.agentId,
    workspaceId: ctx.workspaceId,
    mode: ctx.mode || "activate",
  });
}

export function defineCapabilityHook(opts: {
  id: string;
  status: CapabilityHookStatus;
  notes?: string;
}): {
  registerCapability: () => CapabilityRegistration;
  runActivateHooks: (ctx: CapabilityHookContext) => Promise<void>;
} {
  return {
    registerCapability: () => ({
      id: opts.id,
      status: opts.status,
      notes: opts.notes,
    }),
    runActivateHooks: async (ctx) => {
      await markCapabilityHook(ctx, opts.id);
    },
  };
}
