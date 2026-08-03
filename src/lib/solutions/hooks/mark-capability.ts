import { getPrisma } from "@/lib/db";
import type { CapabilityHookContext, CapabilityRegistration, CapabilityHookStatus } from "./types";

export type CapabilityDraftPatch = {
  /** Appended to instructions.system (idempotent if marker already present). */
  appendInstructions?: string;
  /** Marker string used to avoid double-appending (defaults to first line of append). */
  instructionMarker?: string;
  advanced?: Record<string, unknown>;
  enableTools?: string[];
  compliance?: Record<string, unknown>;
  /** Merged into conversationFlow booking/message section collectFields when present. */
  collectFields?: Array<{
    id: string;
    label: string;
    enabled: boolean;
    required?: boolean;
  }>;
  postCall?: Record<string, unknown>;
  messaging?: Record<string, unknown>;
};

/**
 * Mark a capability as activated on the agent draftConfig.advanced.capabilityHooks.
 */
export async function markCapabilityHook(
  ctx: CapabilityHookContext,
  id: string,
): Promise<void> {
  await applyCapabilityDraftPatch(ctx, id, {});
}

/**
 * Patch agent draftConfig for a capability activate hook and mark capabilityHooks[id].
 */
export async function applyCapabilityDraftPatch(
  ctx: CapabilityHookContext,
  id: string,
  patch: CapabilityDraftPatch,
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
  const prevHooks =
    advanced.capabilityHooks && typeof advanced.capabilityHooks === "object"
      ? (advanced.capabilityHooks as Record<string, unknown>)
      : {};

  const instructions = (draft.instructions || {}) as Record<string, unknown>;
  let system = typeof instructions.system === "string" ? instructions.system : "";
  if (patch.appendInstructions?.trim()) {
    const marker =
      patch.instructionMarker ||
      patch.appendInstructions.trim().split("\n").find((l) => l.trim()) ||
      patch.appendInstructions.trim().slice(0, 48);
    if (!system.includes(marker)) {
      system = `${system.trim()}\n\n${patch.appendInstructions.trim()}`.trim();
    }
  }

  const enabledBuiltinTools = Array.isArray(draft.enabledBuiltinTools)
    ? [...(draft.enabledBuiltinTools as string[])]
    : [];
  if (patch.enableTools?.length) {
    for (const tool of patch.enableTools) {
      if (!enabledBuiltinTools.includes(tool)) enabledBuiltinTools.push(tool);
    }
  }

  const compliance = {
    ...((draft.compliance as Record<string, unknown>) || {}),
    ...(patch.compliance || {}),
  };

  const postCall = {
    ...((draft.postCall as Record<string, unknown>) || {}),
    ...(patch.postCall || {}),
  };

  const messaging = {
    ...((draft.messaging as Record<string, unknown>) || {}),
    ...(patch.messaging || {}),
  };

  let conversationFlow = draft.conversationFlow as Record<string, unknown> | undefined;
  if (patch.collectFields?.length) {
    const flow = { ...(conversationFlow || {}) } as {
      sections?: Array<Record<string, unknown>>;
    };
    const sections = Array.isArray(flow.sections) ? [...flow.sections] : [];
    const idx = sections.findIndex(
      (s) => s.type === "booking" || s.type === "message_taking" || s.id === "intake",
    );
    const existingConfig =
      idx >= 0 && sections[idx].config && typeof sections[idx].config === "object"
        ? (sections[idx].config as Record<string, unknown>)
        : {};
    const prevFields = Array.isArray(existingConfig.collectFields)
      ? (existingConfig.collectFields as Array<Record<string, unknown>>)
      : [];
    const byId = new Map(prevFields.map((f) => [String(f.id), f]));
    for (const field of patch.collectFields) {
      byId.set(field.id, { ...byId.get(field.id), ...field });
    }
    const nextConfig = {
      ...existingConfig,
      collectFields: Array.from(byId.values()),
    };
    if (idx >= 0) {
      sections[idx] = { ...sections[idx], config: nextConfig };
    } else {
      sections.push({
        id: "intake",
        type: "qualification",
        label: "Intake fields",
        enabled: true,
        config: nextConfig,
      });
    }
    conversationFlow = { ...flow, sections };
  }

  const wizard =
    advanced.appointmentReceptionistWizard &&
    typeof advanced.appointmentReceptionistWizard === "object"
      ? (advanced.appointmentReceptionistWizard as Record<string, unknown>)
      : null;
  const nextWizard =
    wizard && patch.collectFields?.length
      ? {
          ...wizard,
          collectFields: (() => {
            const prev = Array.isArray(wizard.collectFields)
              ? (wizard.collectFields as Array<Record<string, unknown>>)
              : [];
            const byId = new Map(prev.map((f) => [String(f.id), f]));
            for (const field of patch.collectFields!) {
              byId.set(field.id, { ...byId.get(field.id), ...field });
            }
            return Array.from(byId.values());
          })(),
        }
      : wizard;

  await prisma.voiceAgent.update({
    where: { id: ctx.agentId },
    data: {
      draftConfig: {
        ...draft,
        ...(patch.appendInstructions
          ? {
              instructions: {
                ...instructions,
                system,
              },
            }
          : {}),
        ...(patch.enableTools?.length ? { enabledBuiltinTools } : {}),
        ...(patch.compliance ? { compliance } : {}),
        ...(patch.postCall ? { postCall } : {}),
        ...(patch.messaging ? { messaging } : {}),
        ...(conversationFlow ? { conversationFlow } : {}),
        advanced: {
          ...advanced,
          ...(patch.advanced || {}),
          ...(nextWizard ? { appointmentReceptionistWizard: nextWizard } : {}),
          capabilityHooks: {
            ...prevHooks,
            [id]: true,
          },
        },
      },
    },
  });

  console.info(`[capability-hooks] ${id} applied on agent`, {
    agentId: ctx.agentId,
    workspaceId: ctx.workspaceId,
    mode: ctx.mode || "activate",
    tools: patch.enableTools || [],
  });
}

export function defineCapabilityHook(opts: {
  id: string;
  status: CapabilityHookStatus;
  notes?: string;
  onActivate?: (ctx: CapabilityHookContext) => Promise<void>;
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
      if (opts.onActivate) {
        await opts.onActivate(ctx);
      } else {
        await markCapabilityHook(ctx, opts.id);
      }
    },
  };
}
