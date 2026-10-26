import type { FormatSpec } from '@/lib/screenwriting/formats/types'
import { getTemplateSpec } from '@/lib/screenwriting/formats/templates'

/** DB may store full spec or `{ key }` only for faster creates. */
export function resolveFormatSpec(stored: unknown, templateKey: string): FormatSpec {
  const s = stored as FormatSpec | { key?: string } | null
  if (s && typeof s === 'object' && 'page' in s && 'elements' in s) return s as FormatSpec
  const key = (s && typeof s === 'object' && s.key) || templateKey || 'feature'
  return getTemplateSpec(key)
}
