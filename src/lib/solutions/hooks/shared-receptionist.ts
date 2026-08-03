import type { CapabilityHookContext } from "./types";
import { runActivateHooks as runAfterHours } from "./after-hours";
import { runActivateHooks as runOverflow } from "./overflow";

/**
 * Shared receptionist activate path — runs specialized hooks that apply based on
 * answering behavior (answerWhen / ring overflow).
 */
export async function runSharedReceptionistHooks(
  ctx: CapabilityHookContext,
): Promise<{ ran: string[] }> {
  const ran: string[] = [];
  const answerWhen = (ctx.answerWhen || "").toLowerCase();

  const wantsAfterHours =
    answerWhen === "after_hours" ||
    answerWhen === "custom_schedule" ||
    ctx.meta?.ringBehavior === "after_hours";

  const wantsOverflow =
    answerWhen === "nobody_answers" ||
    answerWhen === "line_busy" ||
    ctx.meta?.ringBehavior === "ring_team_first";

  if (wantsAfterHours) {
    await runAfterHours(ctx);
    ran.push("after_hours");
  }

  if (wantsOverflow) {
    await runOverflow(ctx);
    ran.push("overflow");
  }

  if (ran.length) {
    console.info("[capability-hooks] shared receptionist hooks", {
      agentId: ctx.agentId,
      answerWhen: ctx.answerWhen,
      ran,
    });
  }

  return { ran };
}
