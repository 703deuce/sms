import 'server-only'
import type { T2vDraftV1 } from '@/lib/t2v/types'
import type { T2vTemplateStylePatch } from '@/lib/t2v/m9-contracts'

/** Apply template style to draft; script text and scenes array are preserved. */
export function applyTemplateStyleToDraft(doc: T2vDraftV1, patch: T2vTemplateStylePatch, templateId: string): T2vDraftV1 {
  const settings = { ...doc.settings, ...(patch.settings as object), templateId }
  const next: T2vDraftV1 = { ...doc, settings: settings as T2vDraftV1['settings'] }
  if (patch.music) {
    next.music = { ...doc.music, ...patch.music }
  }
  if (patch.defaultTransitions) {
    next.scenes = doc.scenes.map((s) => ({
      ...s,
      transition: (patch.defaultTransitions?.transition as T2vDraftV1['scenes'][0]['transition']) ?? s.transition,
      transitionMs: patch.defaultTransitions?.transitionMs ?? s.transitionMs,
    }))
  }
  return next
}
