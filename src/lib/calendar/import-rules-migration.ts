import type { CalendarConfig } from "@/lib/calendar/providers";
import {
  defaultImportRules,
  type CalendarImportRules,
} from "@/lib/calendar/eligibility";

/** Bump when default import semantics change (v2 = permissive reminder candidates). */
export const IMPORT_RULES_SCHEMA_VERSION = 2;

const RULE_KEYS: (keyof CalendarImportRules)[] = [
  "requireExternalAttendees",
  "requireAttendeeEmail",
  "requireOrganizerIsConnection",
  "skipFreeShowAs",
  "skipTentativeShowAs",
  "skipInternalDomainOnlyMeetings",
  "skipAllDay",
  "useBuiltinTitleExcludes",
  "titleIncludePatterns",
  "titleExcludePatterns",
];

/** Implicit defaults persisted by legacy UI before schema v2. */
export function legacyImplicitImportRules(): CalendarImportRules {
  return {
    requireExternalAttendees: true,
    requireAttendeeEmail: false,
    requireOrganizerIsConnection: true,
    skipFreeShowAs: true,
    skipTentativeShowAs: false,
    skipInternalDomainOnlyMeetings: true,
    skipAllDay: true,
    useBuiltinTitleExcludes: true,
    titleExcludePatterns: [],
  };
}

function arraysEqual(a?: string[], b?: string[]): boolean {
  const left = (a || []).map((s) => s.toLowerCase()).sort();
  const right = (b || []).map((s) => s.toLowerCase()).sort();
  if (left.length !== right.length) return false;
  return left.every((v, i) => v === right[i]);
}

function ruleValueEqual(
  key: keyof CalendarImportRules,
  a: CalendarImportRules,
  b: CalendarImportRules,
): boolean {
  if (key === "titleIncludePatterns" || key === "titleExcludePatterns") {
    return arraysEqual(a[key], b[key]);
  }
  return a[key] === b[key];
}

/** True when stored rules are only legacy implicit defaults (never customized). */
export function isLegacyImplicitImportRules(stored: CalendarImportRules | undefined): boolean {
  if (!stored) return true;
  const legacy = legacyImplicitImportRules();
  return RULE_KEYS.every((key) => {
    const val = stored[key];
    if (val === undefined) return true;
    return ruleValueEqual(key, stored, legacy);
  });
}

/**
 * Preserve only fields the customer explicitly changed away from legacy implicit defaults.
 * Everything else picks up current product defaults (v2 permissive).
 */
export function migrateStoredImportRules(stored: CalendarImportRules | undefined): CalendarImportRules {
  if (!stored || isLegacyImplicitImportRules(stored)) {
    return defaultImportRules();
  }
  const legacy = legacyImplicitImportRules();
  const explicit: Partial<CalendarImportRules> = {};
  for (const key of RULE_KEYS) {
    if (stored[key] === undefined) continue;
    if (!ruleValueEqual(key, stored, legacy)) {
      (explicit as Record<string, unknown>)[key] = stored[key];
    }
  }
  return { ...defaultImportRules(), ...explicit };
}

export function mergeImportRulesWithMigration(config: CalendarConfig): CalendarImportRules {
  const version = config.importRulesSchemaVersion ?? 1;
  if (version >= IMPORT_RULES_SCHEMA_VERSION) {
    return { ...defaultImportRules(), ...(config.importRules || {}) };
  }
  return migrateStoredImportRules(config.importRules);
}
