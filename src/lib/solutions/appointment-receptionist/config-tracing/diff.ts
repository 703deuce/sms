import { flattenWizardState, stableJsonEqual } from "./flatten";
import { redactFieldValue } from "./redact";
import type { FlatWizardConfig } from "./flatten";

export type FieldDiffEntry = {
  path: string;
  before: unknown;
  after: unknown;
  changed: boolean;
  expectedChange?: boolean;
};

export type ConfigDiffSummary = {
  changed: string[];
  unchanged: string[];
  added: string[];
  removed: string[];
  entries: FieldDiffEntry[];
};

export function diffFlatConfigs(
  before: FlatWizardConfig,
  after: FlatWizardConfig,
  options?: { expectedChangePaths?: Set<string> },
): ConfigDiffSummary {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed: string[] = [];
  const unchanged: string[] = [];
  const added: string[] = [];
  const removed: string[] = [];
  const entries: FieldDiffEntry[] = [];

  for (const path of [...keys].sort()) {
    const b = before[path];
    const a = after[path];
    const inBefore = path in before;
    const inAfter = path in after;
    if (!inBefore && inAfter) {
      added.push(path);
      entries.push({
        path,
        before: undefined,
        after: redactFieldValue(path, a),
        changed: true,
        expectedChange: options?.expectedChangePaths?.has(path),
      });
      continue;
    }
    if (inBefore && !inAfter) {
      removed.push(path);
      entries.push({
        path,
        before: redactFieldValue(path, b),
        after: undefined,
        changed: true,
        expectedChange: options?.expectedChangePaths?.has(path),
      });
      continue;
    }
    const isChanged = !stableJsonEqual(b, a);
    entries.push({
      path,
      before: redactFieldValue(path, b),
      after: redactFieldValue(path, a),
      changed: isChanged,
      expectedChange: options?.expectedChangePaths?.has(path),
    });
    if (isChanged) changed.push(path);
    else unchanged.push(path);
  }

  return { changed, unchanged, added, removed, entries };
}

export function diffWizardStates(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  options?: { expectedChangePaths?: Set<string> },
): ConfigDiffSummary {
  return diffFlatConfigs(flattenWizardState(before), flattenWizardState(after), options);
}

export function formatPublishDiffLine(entry: FieldDiffEntry): string {
  const exp = entry.expectedChange === true ? "YES" : entry.expectedChange === false ? "NO" : "?";
  return `${entry.path}:\n  draft: ${JSON.stringify(entry.after)}\n  published_before: ${JSON.stringify(entry.before)}\n  expected_change: ${exp}`;
}
