import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceV3CallContext } from "../state/call-context";

export interface CallerInterpretationContext {
  configured_fields: Array<{
    key: string;
    label: string;
    type: string;
    required: boolean;
    description?: string;
  }>;
  known_fields: Record<string, string>;
  current_goal: string;
  business_timezone: string;
  current_local_datetime: string;
  current_local_date: string;
  current_local_weekday: string;
}

export function buildCallerInterpretationContext(
  config: VoiceV3AgentConfig,
  ctx: VoiceV3CallContext,
): CallerInterpretationContext {
  const known_fields: Record<string, string> = {};
  for (const [key, row] of Object.entries(ctx.intake.values)) {
    if (row.value?.trim()) known_fields[key] = row.value.trim();
  }

  return {
    configured_fields: config.intakeFields.map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      required: f.required,
      description: f.description,
    })),
    known_fields,
    current_goal: ctx.dialog.activeGoal,
    business_timezone: ctx.clock.timezone,
    current_local_datetime: ctx.clock.nowLocalDateTime,
    current_local_date: ctx.clock.localDate,
    current_local_weekday: ctx.clock.localWeekday,
  };
}

export function formatCallerInterpretationContextJson(
  payload: CallerInterpretationContext,
): string {
  return JSON.stringify(payload);
}
