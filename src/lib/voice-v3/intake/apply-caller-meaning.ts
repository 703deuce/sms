import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { CapturedField, VoiceV3CallContext, VoiceV3Goal } from "../state/call-context";
import type { CallerMeaning } from "./caller-meaning-schema";

export interface ApplyCallerMeaningResult {
  context: VoiceV3CallContext;
  fieldsChanged: string[];
  correctionCount: number;
}

function isConfiguredKey(config: VoiceV3AgentConfig, key: string): boolean {
  return config.intakeFields.some((f) => f.key === key);
}

function goalFromMeaning(goal: CallerMeaning["active_goal"]): VoiceV3Goal {
  return goal;
}

/**
 * Deterministic merge — no tools, no second model pass.
 */
export function applyCallerMeaningToContext(
  ctx: VoiceV3CallContext,
  config: VoiceV3AgentConfig,
  meaning: CallerMeaning,
  at: Date = new Date(),
): ApplyCallerMeaningResult {
  const updatedAt = at.toISOString();
  const values = { ...ctx.intake.values };
  const fieldsChanged = new Set<string>();
  let correctionCount = 0;

  for (const row of meaning.captured_fields) {
    const key = row.key.trim();
    const value = row.value.trim();
    if (!key || !value || !isConfiguredKey(config, key)) continue;
    values[key] = {
      value,
      source: "caller",
      confidence: row.confidence,
      updatedAt,
    };
    fieldsChanged.add(key);
  }

  for (const row of meaning.corrections) {
    const key = row.key.trim();
    const value = row.new_value.trim();
    if (!key || !value || !isConfiguredKey(config, key)) continue;
    values[key] = {
      value,
      source: "caller",
      confidence: row.confidence,
      updatedAt,
    };
    fieldsChanged.add(key);
    correctionCount += 1;
  }

  const scheduling = { ...ctx.scheduling };
  let schedulingChanged = false;
  const sched = meaning.scheduling;
  if (sched.requested_date_expression?.trim()) {
    scheduling.requestedDateExpression = sched.requested_date_expression.trim();
    schedulingChanged = true;
  }
  if (sched.requested_time_expression?.trim()) {
    scheduling.requestedTimeExpression = sched.requested_time_expression.trim();
    schedulingChanged = true;
  }
  if (sched.requested_daypart?.trim()) {
    scheduling.requestedDaypart = sched.requested_daypart.trim();
    schedulingChanged = true;
  }
  if (schedulingChanged) {
    scheduling.generation = (scheduling.generation ?? 0) + 1;
  }

  const context: VoiceV3CallContext = {
    ...ctx,
    updatedAt,
    dialog: { activeGoal: goalFromMeaning(meaning.active_goal) },
    intake: { values },
    scheduling,
    runtime: { version: ctx.runtime.version + 1 },
  };

  return {
    context,
    fieldsChanged: [...fieldsChanged],
    correctionCount,
  };
}
