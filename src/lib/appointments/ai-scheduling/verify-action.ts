import "server-only";

import { openAiChatCompletion } from "@/lib/ai/openai";
import { arAiReschedulerModelOptions } from "@/lib/appointment-reminders/ai-rescheduler/model";
import { WRITE_VERIFIER_SYSTEM_PROMPT } from "./prompts";
import {
  validateWriteActionVerdict,
  type ProposedWriteAction,
  type UnderstandingResult,
  type WriteActionVerdict,
} from "./schema";

export async function verifyWriteAction(input: {
  originalMessage: string;
  recentTurns: Array<{ role: "user" | "assistant"; content: string }>;
  understanding: UnderstandingResult;
  proposedAction: ProposedWriteAction;
  appointmentSummary?: string;
}): Promise<{ verdict: WriteActionVerdict; reason?: string; modelFailure: boolean }> {
  const history = input.recentTurns
    .slice(-4)
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const user = [
    `Original customer message: ${input.originalMessage}`,
    history ? `Recent conversation:\n${history}` : "",
    `Structured interpretation: ${JSON.stringify({
      intent: input.understanding.intent,
      explicitMutationRequested: input.understanding.explicitMutationRequested,
      appointmentId: input.understanding.appointmentReference.appointmentId,
      service: input.understanding.servicePreference.nameMentioned,
      date: input.understanding.datePreference.date,
      time: input.understanding.timePreference.exactTime,
    })}`,
    `Proposed deterministic action: ${JSON.stringify(input.proposedAction)}`,
    input.appointmentSummary ? `Appointment context: ${input.appointmentSummary}` : "",
    "Verdict:",
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const raw = await openAiChatCompletion(WRITE_VERIFIER_SYSTEM_PROMPT, user, {
      temperature: 0,
      maxTokens: 80,
      ...arAiReschedulerModelOptions(),
    });
    if (!raw) {
      return conservativeVerdict(input);
    }
    const parsed = validateWriteActionVerdict(raw);
    if (!parsed) {
      return conservativeVerdict(input);
    }
    return { verdict: parsed.verdict, reason: parsed.reason, modelFailure: false };
  } catch {
    return conservativeVerdict(input);
  }
}

function conservativeVerdict(input: {
  understanding: UnderstandingResult;
  proposedAction: ProposedWriteAction;
}): { verdict: WriteActionVerdict; reason?: string; modelFailure: boolean } {
  if (!input.understanding.explicitMutationRequested) {
    return {
      verdict: "MISMATCH",
      reason: "Explicit authorization not detected; verifier unavailable",
      modelFailure: true,
    };
  }
  if (input.proposedAction.kind === "CANCEL" || input.proposedAction.kind === "RESCHEDULE") {
    return {
      verdict: "NEEDS_CLARIFICATION",
      reason: "Verifier unavailable for destructive action",
      modelFailure: true,
    };
  }
  return {
    verdict: "NEEDS_CLARIFICATION",
    reason: "Verifier unavailable",
    modelFailure: true,
  };
}

export function writeActionRequiresVerifier(action: ProposedWriteAction): boolean {
  return (
    action.kind === "BOOK" ||
    action.kind === "RESCHEDULE" ||
    action.kind === "CANCEL" ||
    action.kind === "JOIN_WAITLIST"
  );
}
