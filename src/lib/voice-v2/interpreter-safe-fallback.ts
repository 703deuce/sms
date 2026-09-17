import type { VoiceDialogGoal } from "./dialog-goal";
import { isActiveBookingGoal } from "./dialog-goal";
import type { CallerMeaning, InterpreterContext } from "./caller-meaning";
import { extractIntakeFieldsFromUtterance } from "./intake/extract-intake-from-utterance";
import { utteranceLooksLikeSchedulingCorrection } from "./scheduling-preference-state";
import { resolveSpokenDateYmd } from "@/lib/voice/calendar/resolve-datetime";

import type { InterpreterMergePolicy } from "./caller-meaning";

const AMBIGUOUS_REFERENCE_RE =
  /\b(the\s+)?(later|earlier|first|second|third|other|another)\s+one\b|\bthe\s+other\b|\bsomething\s+else\b|\buse\s+the\s+(email|phone)\s+i\s+(already\s+)?gave\b/i;

const GOAL_SWITCH_RE =
  /\b(let'?s\s+)?(do|try)\s+something\s+else\b|\bnever\s+mind\b|\bforget\s+(about\s+)?(that|it)\b/i;

const EXPLICIT_CALLBACK_RE =
  /\b(call\s+me\s+back|callback)\b/i;

function isSchedulingCaptureContext(ctx: InterpreterContext): boolean {
  if (isActiveBookingGoal(ctx.activeGoal)) return true;
  const stage = ctx.currentWorkflowStage;
  return stage === "COLLECT_SCHEDULING_PREFERENCE" || stage === "FIND_AVAILABILITY";
}

function hasSafeSchedulingLiteral(utterance: string, ctx: InterpreterContext): boolean {
  if (!isSchedulingCaptureContext(ctx)) return false;
  if (utteranceLooksLikeSchedulingCorrection(utterance)) return false;
  if (AMBIGUOUS_REFERENCE_RE.test(utterance)) return false;
  const resolved = resolveSpokenDateYmd({
    spoken: utterance,
    timezone: ctx.businessTimezone,
    now: new Date(ctx.currentDateTimeIso),
  });
  if (!resolved?.ymd) return false;
  const wordCount = utterance.split(/\s+/).filter(Boolean).length;
  return wordCount <= 12;
}

export function classifyInterpreterSafeFallback(ctx: InterpreterContext): {
  mergePolicy: InterpreterMergePolicy;
  meaning: CallerMeaning | null;
  reason: string;
} {
  const utterance = ctx.stable.text.trim();
  const preserveGoal = ctx.activeGoal;

  if (!utterance) {
    return { mergePolicy: "none", meaning: null, reason: "empty_utterance" };
  }

  if (AMBIGUOUS_REFERENCE_RE.test(utterance) || GOAL_SWITCH_RE.test(utterance)) {
    return { mergePolicy: "none", meaning: null, reason: "ambiguous_reference_or_goal_switch" };
  }

  const intake = extractIntakeFieldsFromUtterance(
    utterance,
    ctx.callContext.intakeSchema,
  );
  const hasIntakeLiteral = Object.keys(intake).length > 0;
  const schedulingSafe = hasSafeSchedulingLiteral(utterance, ctx);

  if (EXPLICIT_CALLBACK_RE.test(utterance)) {
    return { mergePolicy: "none", meaning: null, reason: "explicit_callback_requires_astra" };
  }

  if (!hasIntakeLiteral && !schedulingSafe) {
    return { mergePolicy: "none", meaning: null, reason: "no_safe_literal_facts" };
  }

  const facts: CallerMeaning["facts"] = {};
  if (schedulingSafe) {
    const resolved = resolveSpokenDateYmd({
      spoken: utterance,
      timezone: ctx.businessTimezone,
      now: new Date(ctx.currentDateTimeIso),
    });
    if (resolved?.ymd) {
      facts.requested_date = resolved.ymd;
    }
  }

  const meaning: CallerMeaning = {
    active_goal: preserveGoal,
    facts,
    corrections: [],
    explicit_action_requests: [],
    ambiguities: [],
    confidence: 0.75,
    digression: false,
    evidence: utterance,
    literal_intake_fields: intake,
  };

  return { mergePolicy: "literal_facts_only", meaning, reason: "safe_literal_extracted" };
}

export function preserveStateCallerMeaning(ctx: InterpreterContext): CallerMeaning {
  return {
    active_goal: ctx.activeGoal,
    facts: {},
    corrections: [],
    explicit_action_requests: [],
    ambiguities: ["interpreter_unavailable"],
    confidence: 0,
    digression: false,
    evidence: ctx.stable.text.trim(),
  };
}
