/** Shared deterministic field operators (qualification + urgency). */

import type { VoiceV2QualificationOperator } from "./qualification-types";

function splitList(value: string): string[] {
  return value
    .split(/[,;|]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function asNumber(value: string): number | null {
  const n = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function evaluateDeterministicFieldRule(input: {
  operator: VoiceV2QualificationOperator;
  expected: string;
  actual: string | null | undefined;
}): boolean {
  const actualRaw = input.actual?.trim() ?? "";
  const actual = actualRaw.toLowerCase();
  const expected = input.expected?.trim() ?? "";

  switch (input.operator) {
    case "EXISTS":
      return actualRaw.length > 0;
    case "NOT_EXISTS":
      return actualRaw.length === 0;
    case "EQUALS":
      return actual === expected.toLowerCase();
    case "NOT_EQUALS":
      return actual !== expected.toLowerCase();
    case "CONTAINS":
      return expected.length > 0 && actual.includes(expected.toLowerCase());
    case "IN": {
      const set = splitList(expected);
      return set.length > 0 && set.includes(actual);
    }
    case "NOT_IN": {
      const set = splitList(expected);
      return set.length === 0 || !set.includes(actual);
    }
    case "GREATER_THAN_OR_EQUAL": {
      const a = asNumber(actualRaw);
      const e = asNumber(expected);
      return a != null && e != null && a >= e;
    }
    case "LESS_THAN_OR_EQUAL": {
      const a = asNumber(actualRaw);
      const e = asNumber(expected);
      return a != null && e != null && a <= e;
    }
    default:
      return false;
  }
}
