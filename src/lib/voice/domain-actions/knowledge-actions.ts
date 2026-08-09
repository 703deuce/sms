import { loadVoiceAgentRuntimeConfigRecord } from "@/lib/voice/load-agent-config";
import { guardToolInvocation } from "./guard";
import type { LiveKitCallContext } from "./session-bootstrap";
import type { DomainActionResult } from "./booking-actions";
import { structuredFailure, structuredSuccess } from "@/lib/voice/tool-policy/structured-result";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function domainGetBusinessAnswer(input: {
  ctx: LiveKitCallContext;
  topic: string;
}): Promise<DomainActionResult> {
  const blocked = guardToolInvocation(input.ctx, "get_business_answer");
  if (blocked) return blocked;

  const config = await loadVoiceAgentRuntimeConfigRecord(input.ctx.workspaceId, input.ctx.agentId);
  const cfg = asRecord(config);
  const knowledge = asRecord(cfg.knowledgeBase || cfg.knowledge);
  const workflowMeta = asRecord(input.ctx.workflowDefinition?.metadata);
  const workflowPricing = asRecord(workflowMeta.pricing);
  const pricing = { ...workflowPricing, ...asRecord(knowledge.pricing || cfg.pricing) };
  const topic = input.topic.toLowerCase();

  if (/price|cost|fee|charge|how much/.test(topic)) {
    const serviceCallFee = pricing.serviceCallFee || pricing.diagnosticFee || pricing.defaultServiceCall;
    if (serviceCallFee) {
      return structuredSuccess({
        speak: String(pricing.serviceCallScript || `Our service call fee is ${serviceCallFee}.`),
        data: { topic: "pricing", serviceCallFee },
      });
    }
    return structuredSuccess({
      speak: String(
        pricing.unknownScript ||
          "Pricing depends on the job. A technician can give you an exact quote after diagnosing the issue.",
      ),
      data: { topic: "pricing", policy: "quote_on_site" },
    });
  }

  if (/hour|open|close|when are you/.test(topic)) {
    const hours =
      knowledge.businessHours || cfg.businessHours || workflowMeta.businessHours;
    if (hours) {
      return structuredSuccess({
        speak: `Our hours are ${String(hours)}.`,
        data: { topic: "hours", hours },
      });
    }
  }

  const faq = asRecord(knowledge.faq);
  for (const [key, value] of Object.entries(faq)) {
    if (topic.includes(key.toLowerCase())) {
      return structuredSuccess({
        speak: String(value),
        data: { topic: key },
      });
    }
  }

  return structuredFailure({
    speak: "I don't have specific information on that in my system. I can take a message or connect you with the team.",
    code: "NOT_FOUND",
    workflowState: input.ctx.session.currentState,
    nextAllowedActions: ["take_message", "request_human"],
  });
}
