import { resolveBusinessAnswer } from "@/lib/voice/knowledge/resolve-business-answer";
import { guardToolInvocation } from "./guard";
import type { LiveKitCallContext } from "./session-bootstrap";
import type { DomainActionResult } from "./booking-actions";
import { structuredFailure, structuredSuccess } from "@/lib/voice/tool-policy/structured-result";

export async function domainGetBusinessAnswer(input: {
  ctx: LiveKitCallContext;
  topic: string;
}): Promise<DomainActionResult> {
  const blocked = guardToolInvocation(input.ctx, "get_business_answer");
  if (blocked) return blocked;

  const result = await resolveBusinessAnswer({
    workspaceId: input.ctx.workspaceId,
    agentId: input.ctx.agentId,
    topic: input.topic,
  });

  if (result.ok) {
    return structuredSuccess({
      speak: result.speak,
      data: result.data,
    });
  }

  return structuredFailure({
    speak: result.speak,
    code: "NOT_FOUND",
    workflowState: input.ctx.session.currentState,
    nextAllowedActions: ["take_message", "request_human"],
  });
}
