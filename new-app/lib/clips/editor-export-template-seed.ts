import type { ClipEditsV2 } from '@/lib/clips/edits'
import { isInternalClipReasoningText } from '@/lib/clips/clip-results-chips'
import {
  cheapSuggestedHeadline,
  editorHeadlineBandAllowed,
  formatHeadlineForExport,
  headlineBarAllowedForLayout,
  type ClipExportTemplate,
} from '@/lib/clips/export-template'
import { logEditorDecision } from '@/lib/clips/editor-decision-log'

/** Prefill exportTemplate headline from clip title + aiMeta once; never overwrites valid user text. */
export function seedEditorExportTemplate(
  edits: ClipEditsV2,
  clip: { title: string; aiMeta?: unknown },
  opts?: { platform?: 'twitch' | 'kick'; channelUrl?: string | null },
): ClipEditsV2 {
  const hook = cheapSuggestedHeadline(clip).trim()
  if (!hook) return edits

  const cur = edits.exportTemplate
  const storedSuggested = cur?.suggestedHeadline?.trim()
  const suggested =
    storedSuggested && !isInternalClipReasoningText(storedSuggested) ? storedSuggested : hook
  const existingText = cur?.headlineBar?.text?.trim()
  const text =
    existingText && !isInternalClipReasoningText(existingText)
      ? formatHeadlineForExport(existingText)
      : formatHeadlineForExport(suggested)
  const layoutOk = headlineBarAllowedForLayout(edits.layout.mode)
  const showBand = editorHeadlineBandAllowed(edits.layout.mode)
  const enabled =
    cur?.headlineBar?.enabled === true
      ? true
      : cur?.headlineBar?.enabled === false
        ? false
        : showBand

  const nextTpl: ClipExportTemplate = {
    ...cur,
    suggestedHeadline: suggested,
    headlineBar: {
      enabled: layoutOk ? enabled : false,
      text,
    },
    platform: cur?.platform ?? opts?.platform,
    channelLink: cur?.channelLink?.url
      ? cur.channelLink
      : opts?.channelUrl
        ? { enabled: false, url: opts.channelUrl }
        : cur?.channelLink,
  }

  if (
    cur?.suggestedHeadline === nextTpl.suggestedHeadline &&
    cur?.headlineBar?.enabled === nextTpl.headlineBar?.enabled &&
    cur?.headlineBar?.text === nextTpl.headlineBar?.text
  ) {
    return edits
  }

  logEditorDecision('headline_seed', {
    clipTitle: clip.title,
    source: storedSuggested && !isInternalClipReasoningText(storedSuggested) ? 'stored' : 'clip_meta',
    suggestedHeadline: suggested,
    layoutMode: edits.layout.mode,
    showBand,
  })

  return { ...edits, exportTemplate: nextTpl }
}

export function patchEditorExportTemplateHeadline(
  edits: ClipEditsV2,
  patch: { enabled?: boolean; text?: string },
): ClipEditsV2 {
  const cur = edits.exportTemplate ?? {}
  const next: ClipExportTemplate = {
    ...cur,
    headlineBar: {
      enabled: patch.enabled ?? cur.headlineBar?.enabled ?? false,
      text: patch.text ?? cur.headlineBar?.text ?? cur.suggestedHeadline ?? '',
    },
  }
  return { ...edits, exportTemplate: next }
}
