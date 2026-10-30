import type { ClipEditsV2 } from '@/lib/clips/edits'
import { canonicalEditsJson, normalizeEdits } from '@/lib/clips/edits'
import type { ClipBounds } from '@/lib/clips/edits'

/** Worker / server-owned subtrees — server wins on autosave conflict merge. */
const SERVER_OWNED_PATHS: (keyof ClipEditsV2)[] = ['audio', 'captions', 'exportTemplate']
/** T6.2: subtrees the user edits directly — on a two-sided conflict merge per sub-key instead of dropping local. */
const USER_EDITED_SUBTREES = new Set<keyof ClipEditsV2>(['captions', 'exportTemplate'])

function shallowEqualJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function mergeWorkerOwnedField<K extends keyof ClipEditsV2>(
  key: K,
  base: ClipEditsV2,
  local: ClipEditsV2,
  server: ClipEditsV2,
): ClipEditsV2[K] {
  if (shallowEqualJson(base[key], local[key])) {
    console.info('[clipper:autosave] merge_field', { key, winner: 'server' })
    return server[key]
  }
  if (shallowEqualJson(base[key], server[key])) {
    console.info('[clipper:autosave] merge_field', { key, winner: 'local' })
    return local[key]
  }
  // T6.2: both sides diverged. For user-edited subtrees (captions preset/style, title style) a
  // whole-subtree "server wins" silently dropped the user's pick (CP chips never persisted when a
  // worker/seed write raced the autosave). Merge per sub-key: server base + keys the user changed.
  if (USER_EDITED_SUBTREES.has(key)) {
    const b = (base[key] ?? {}) as Record<string, unknown>
    const l = (local[key] ?? {}) as Record<string, unknown>
    const out: Record<string, unknown> = { ...((server[key] ?? {}) as Record<string, unknown>) }
    for (const k of new Set([...Object.keys(b), ...Object.keys(l)])) {
      if (!shallowEqualJson(b[k], l[k])) {
        if (l[k] === undefined) delete out[k]
        else out[k] = l[k]
      }
    }
    console.info('[clipper:autosave] merge_field', { key, winner: 'subkey_merge' })
    return out as ClipEditsV2[K]
  }
  console.info('[clipper:autosave] merge_field', { key, winner: 'server' })
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
