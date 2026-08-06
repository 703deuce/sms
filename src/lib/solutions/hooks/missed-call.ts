/**
 * Capability hook: when appointment receptionist activates,
 * attach Missed Call Text-Back as a structured companion automation.
 */
import { defineCapabilityHook } from "./mark-capability";
import type { CapabilityHookContext } from "./types";
import { attachMissedCallTextBackForAgent } from "@/lib/agents/appointment-booking/missed-call-handoff";
import { getPrisma } from "@/lib/db";

const hook = defineCapabilityHook({
  id: "missed_call",
  status: "wizard_wired",
  notes:
    "Missed-call text-back companion — attaches MCTB automation on appointment agent activate",
  onActivate: async (ctx: CapabilityHookContext) => {
    const { markCapabilityHook } = await import("./mark-capability");
    await markCapabilityHook(ctx, "missed_call");

    const prisma = getPrisma();
    const agent = await prisma.voiceAgent.findFirst({
      where: { id: ctx.agentId, workspaceId: ctx.workspaceId },
      select: { phoneNumberId: true, linkedPhoneNumberIds: true },
    });
    const fromMeta = ctx.meta?.phoneNumberId
      ? String(ctx.meta.phoneNumberId)
      : "";
    const phoneNumberId =
      fromMeta ||
      agent?.phoneNumberId ||
      (Array.isArray(agent?.linkedPhoneNumberIds)
        ? agent!.linkedPhoneNumberIds[0]
        : "") ||
      "";

    if (!phoneNumberId) {
      console.info(
        "[capability-hooks] missed_call skipped — no phone on agent",
        { agentId: ctx.agentId },
      );
      return;
    }

    await attachMissedCallTextBackForAgent({
      workspaceId: ctx.workspaceId,
      agentId: ctx.agentId,
      phoneNumberId: String(phoneNumberId),
      activate: ctx.mode !== "save_draft",
    });
  },
});

export const registerCapability = hook.registerCapability;
export const runActivateHooks = hook.runActivateHooks;
