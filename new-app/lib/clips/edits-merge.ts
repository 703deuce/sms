import type { ClipEditsV2 } from '@/lib/clips/edits'
import { canonicalEditsJson, normalizeEdits } from '@/lib/clips/edits'
import type { ClipBounds } from '@/lib/clips/edits'

/** Worker / server-owned subtrees — server wins on autosave conflict merge. */
const SERVER_OWNED_PATHS: (keyof ClipEditsV2)[] = ['audio', 'captions', 'exportTemplate']

function shallowEqualJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function mergeWorkerOwnedField<K extends keyof ClipEditsV2>(
  key: K,
  base: ClipEditsV2,
  local: ClipEditsV2,
  server: ClipEditsV2,
): ClipEditsV2[K] {
  if (shallowEqualJson(base[key], local)) return server[key]
  if (shallowEqualJson(base[key], server)) return local[key]
  return server[key]
}

/**
 * Three-way merge after optimistic save conflict.
 * Local wins when it diverged from base; server wins for worker-owned fields.
 */
export function mergeEditsThreeWay(
  base: ClipEditsV2,
  local: ClipEditsV2,
  server: ClipEditsV2,
  bounds: ClipBounds,
): { merged: ClipEditsV2; externalChange: boolean } {
  const merged: ClipEditsV2 = { ...local }
  let externalChange = false

  for (const key of SERVER_OWNED_PATHS) {
    const before = merged[key]
    merged[key] = mergeWorkerOwnedField(key, base, local, server)
    if (!shallowEqualJson(before, merged[key]) && !shallowEqualJson(base[key], server[key])) {
      externalChange = true
    }
  }

  if (!shallowEqualJson(base.cutRanges, server.cutRanges) && shallowEqualJson(base.cutRanges, local.cutRanges)) {
    merged.cutRanges = server.cutRanges
    externalChange = true
  }
  if (!shallowEqualJson(base.trim, server.trim) && shallowEqualJson(base.trim, local.trim)) {
    merged.trim = server.trim
    externalChange = true
  }
  if (!shallowEqualJson(base.wordFixes, server.wordFixes) && shallowEqualJson(base.wordFixes, local.wordFixes)) {
    merged.wordFixes = server.wordFixes
    externalChange = true
  }
  if (!shallowEqualJson(base.layout, server.layout) && shallowEqualJson(base.layout, local.layout)) {
    merged.layout = server.layout
    externalChange = true
  }

  const normalized = normalizeEdits(merged, bounds)
  if (canonicalEditsJson(normalized) !== canonicalEditsJson(local)) {
    externalChange = true
  }
  return { merged: normalized, externalChange }
}
