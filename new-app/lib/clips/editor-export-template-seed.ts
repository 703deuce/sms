import type { ClipEditsV2 } from '@/lib/clips/edits'
import {
  cheapSuggestedHeadline,
  formatHeadlineForExport,
  headlineBarAllowedForLayout,
  type ClipExportTemplate,
} from '@/lib/clips/export-template'
import { layoutReservesHeadlineBand } from '@/lib/clips/layout-preview'

function headlineLayoutMode(mode: ClipEditsV2['layout']['mode']): boolean {
  return layoutReservesHeadlineBand(mode) || mode === 'fit_top'
}

/** Prefill exportTemplate headline from aiMeta hook once; never overwrites user text. */
export function seedEditorExportTemplate(
  edits: ClipEditsV2,
  aiMeta: unknown,
  opts?: { platform?: 'twitch' | 'kick'; channelUrl?: string | null },
): ClipEditsV2 {
  const hook = cheapSuggestedHeadline({ title: '', aiMeta }).trim()
  if (!hook) return edits

  const cur = edits.exportTemplate
  const suggested = cur?.suggestedHeadline?.trim() || hook
  const existingText = cur?.headlineBar?.text?.trim()
  const text = existingText || formatHeadlineForExport(suggested)
  const layoutOk = headlineBarAllowedForLayout(edits.layout.mode)
  const showBand = layoutOk && headlineLayoutMode(edits.layout.mode)
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
