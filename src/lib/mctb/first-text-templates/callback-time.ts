import type { MctbCallbackTimePreset, MctbCallbackTimeVariable } from "./types";

const PRESET_PHRASES: Record<Exclude<MctbCallbackTimePreset, "custom">, string> = {
  within_10_minutes: "within 10 minutes",
  within_15_minutes: "within 15 minutes",
  within_30_minutes: "within 30 minutes",
  within_1_hour: "within 1 hour",
  as_soon_as_possible: "as soon as possible",
  when_we_reopen_tomorrow_morning: "when we reopen tomorrow morning",
};

export const MCTB_CALLBACK_TIME_PRESET_OPTIONS: Array<{
  value: MctbCallbackTimePreset;
  label: string;
}> = [
  { value: "within_10_minutes", label: "Within 10 minutes" },
  { value: "within_15_minutes", label: "Within 15 minutes" },
  { value: "within_30_minutes", label: "Within 30 minutes" },
  { value: "within_1_hour", label: "Within 1 hour" },
  { value: "as_soon_as_possible", label: "As soon as possible" },
  { value: "custom", label: "Custom" },
];

export const MCTB_CALLBACK_TIME_AFTER_HOURS_PRESET_OPTIONS: Array<{
  value: MctbCallbackTimePreset;
  label: string;
}> = [
  { value: "when_we_reopen_tomorrow_morning", label: "When we reopen tomorrow morning" },
  { value: "within_1_hour", label: "Within 1 hour" },
  { value: "as_soon_as_possible", label: "As soon as possible" },
  { value: "custom", label: "Custom" },
];

export function defaultCallbackTimeVariable(
  inBusinessHours: boolean,
): MctbCallbackTimeVariable {
  return inBusinessHours
    ? { preset: "within_30_minutes" }
    : { preset: "when_we_reopen_tomorrow_morning" };
}

export function resolveCallbackTimePhrase(variable?: MctbCallbackTimeVariable | null): string {
  if (!variable) return "";
  if (variable.preset === "custom") {
    return (variable.customText || "").trim();
  }
  return PRESET_PHRASES[variable.preset] || "";
}
