import "server-only";

import { openAiChatCompletion } from "@/lib/ai/openai";
import type { AppointmentAiContext } from "./context";
import { contextSummaryForPrompt } from "./context";
import { UNDERSTANDING_AGENT_SYSTEM_PROMPT } from "./prompts";
import {
  UNDERSTANDING_JSON_SCHEMA,
  emptyUnderstanding,
  validateUnderstandingResult,
  type UnderstandingResult,
} from "./schema";
import { parseUnderstandingFallback } from "./understand-fallback";

export async function runUnderstandingAgent(
  ctx: AppointmentAiContext,
  hinted?: UnderstandingResult,
): Promise<{ understanding: UnderstandingResult; fallbackUsed: boolean; modelFailure: boolean }> {
  const base = hinted || emptyUnderstanding(ctx.message);
  base.originalText = ctx.message;

  const system = `${UNDERSTANDING_AGENT_SYSTEM_PROMPT}

Return ONLY valid JSON matching this schema:
${UNDERSTANDING_JSON_SCHEMA}`;

  const history = ctx.recentTurns.map((m) => `${m.role}: ${m.content}`).join("\n");
  const user = [
    contextSummaryForPrompt(ctx),
    history ? `\nRecent conversation:\n${history}` : "",
    `\nCustomer message: ${ctx.message}`,
    "JSON:",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const raw = await openAiChatCompletion(system, user, { temperature: 0.1, maxTokens: 700 });
    if (!raw) {
      const fallback = parseUnderstandingFallback(ctx.message, ctx);
      return { understanding: fallback, fallbackUsed: true, modelFailure: true };
    }

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      const fallback = parseUnderstandingFallback(ctx.message, ctx);
      return { understanding: fallback, fallbackUsed: true, modelFailure: true };
    }

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    parsed.originalText = ctx.message;
    const validated = validateUnderstandingResult(parsed, ctx.scopedIds);
    if (!validated) {
      const fallback = parseUnderstandingFallback(ctx.message, ctx);
      return { understanding: fallback, fallbackUsed: true, modelFailure: true };
    }
    return { understanding: validated, fallbackUsed: false, modelFailure: false };
  } catch {
    const fallback = parseUnderstandingFallback(ctx.message, ctx);
    return { understanding: fallback, fallbackUsed: true, modelFailure: true };
  }
}
