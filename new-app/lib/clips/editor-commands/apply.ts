import { applyBrandTemplateToEdits } from '../apply-brand'
import { canonicalEditsJson, outputDurationMs, subtractRangeFromCuts, type ClipEditsV2 } from '../edits'
import { headlineBarAllowedForLayout } from '../headline-band-layout'
import { defaultLayoutSegments } from '../layout-segments'
import { syncLayersFromLegacy } from '../layers'
import { clampTrimToExtendedBounds } from '../trim-bounds'
import {
  applyProposalsToEdits,
  pruneCutCleanupKinds,
  pruneCutQualityMeta,
  type CleanupProposal,
} from '../editor/cleanup-proposals'
import { splitAt, type OpCtx } from '../editor/clip-timeline'
import { deleteRange, deleteRangeMain, moveVideoSegment } from '../editor/timeline-edit-ops'
import { TEXT_MAX_ITEMS, textPreset, normalizeTextItems, type TextItem } from '../editor/text-items'
import { createId } from '../../supabase/id'
import type {
  EditorCommandContext,
  EditorCommandDefinition,
  EditorCommandName,
  EditorCommandParams,
  DiffSummary,
} from './types'

function opCtx(edits: ClipEditsV2, ctx: EditorCommandContext): OpCtx {
  return { edits, previewEdits: ctx.previewEdits ?? edits }
}

function rangeSummary(text: string, startMs: number, endMs: number): DiffSummary {
  return { text, ranges: [{ startMs, endMs }] }
}

/** Same clamp + assignment as `setTrim` in use-editor-state.ts. */
function applyTrim(edits: ClipEditsV2, params: EditorCommandParams['trim'], ctx: EditorCommandContext): ClipEditsV2 {
  const media =
    ctx.bounds.trimMinMs != null && ctx.bounds.trimMaxMs != null
      ? { minMs: ctx.bounds.trimMinMs, maxMs: ctx.bounds.trimMaxMs }
      : undefined
  return {
    ...edits,
    trim: clampTrimToExtendedBounds(ctx.bounds.clipStartMs, ctx.bounds.clipEndMs, { in: params.inMs, out: params.outMs }, media),
  }
}

function applySplit(edits: ClipEditsV2, params: EditorCommandParams['split'], ctx: EditorCommandContext): ClipEditsV2 | null {
  const refs = params.item ? [params.item] : [{ lane: 'video' as const, id: '' }]
  return splitAt(opCtx(edits, ctx), refs, params.atMs)
}

function applyDeleteRange(
  edits: ClipEditsV2,
  params: EditorCommandParams['delete_range'],
  ctx: EditorCommandContext,
): ClipEditsV2 | null {
  const range: [number, number] = [params.startMs, params.endMs]
  const ctxOp = opCtx(edits, ctx)
  return params.mode === 'main' ? deleteRangeMain(ctxOp, range) : deleteRange(ctxOp, range)
}

function applyCleanup(
  edits: ClipEditsV2,
  params: EditorCommandParams['apply_cleanup'],
  ctx: EditorCommandContext,
): ClipEditsV2 | null {
  const proposals: CleanupProposal[] = params.proposals
  if (!proposals.length) return null
  return applyProposalsToEdits(edits, proposals, ctx.wordSpans ?? [])
}

/** Same cut/kinds/quality prune as `restoreCutRange` in use-editor-state.ts. */
function applyRestoreCut(edits: ClipEditsV2, params: EditorCommandParams['restore_cut']): ClipEditsV2 | null {
  const range: [number, number] = [params.startMs, params.endMs]
  const cuts = subtractRangeFromCuts(edits.cutRanges, range)
  const cutCleanupKinds = pruneCutCleanupKinds(edits.cutCleanupKinds, cuts)
  const cutQualityMeta = pruneCutQualityMeta(edits.cutQualityMeta, cuts)
  const next = { ...edits, cutRanges: cuts, cutCleanupKinds, cutQualityMeta }
  if (canonicalEditsJson(edits) === canonicalEditsJson(next)) return null
  return next
}

/** Same merge as `setCaptions` in use-editor-state.ts, including layers v3 sync. */
function applySetCaptions(edits: ClipEditsV2, params: EditorCommandParams['set_captions']): ClipEditsV2 {
  const next = { ...edits, captions: { ...edits.captions, ...params } }
  return edits.layersV === 3 ? syncLayersFromLegacy(next) : next
}

/** Same layout pick as `setLayoutMode` in use-editor-state.ts. */
function applySetLayout(edits: ClipEditsV2, params: EditorCommandParams['set_layout']): ClipEditsV2 {
  const { template: _droppedTemplate, ...layoutRest } = edits.layout as typeof edits.layout & { template?: unknown }
  void _droppedTemplate
  let next: ClipEditsV2 = {
    ...edits,
    layout: {
      ...layoutRest,
      mode: params.mode,
      userPicked: true,
      layoutSegments: defaultLayoutSegments(edits.trim.in, edits.trim.out, params.mode),
      ...(params.facecam ? { facecam: params.facecam } : {}),
    },
  }
  const tpl = next.exportTemplate
  if (tpl?.headlineBar?.enabled && !headlineBarAllowedForLayout(params.mode)) {
    next = {
      ...next,
      exportTemplate: {
        ...tpl,
        headlineBar: { enabled: false, text: tpl.headlineBar?.text ?? '' },
      },
    }
  }
  return next
}

function applyText(edits: ClipEditsV2, params: EditorCommandParams['add_or_edit_text']): ClipEditsV2 | null {
  const items = edits.textItems ?? []
  const existingIdx = params.id ? items.findIndex((t) => t.id === params.id) : -1
  if (existingIdx >= 0) {
    const idx = existingIdx
    const cur = items[idx]!
    const startMs = params.startMs ?? cur.startMs
    const endMs =
      params.endMs ??
      (params.durationMs != null ? startMs + params.durationMs : cur.endMs)
    const nextItem: TextItem = {
      ...cur,
      text: params.text != null ? params.text : cur.text,
      startMs,
      endMs,
      ...(params.x != null ? { x: params.x } : {}),
      ...(params.y != null ? { y: params.y } : {}),
    }
    const nextItems = [...items.slice(0, idx), nextItem, ...items.slice(idx + 1)]
    const normalized = normalizeTextItems(nextItems, outputDurationMs(edits))
    if (!normalized) return null
    return { ...edits, textItems: normalized }
  }
  const text = String(params.text ?? '').trim()
  if (!text) return null
  if (items.length >= TEXT_MAX_ITEMS) return null
  const kind = params.kind ?? 'title_card'
  const startMs = params.startMs ?? 0
  const durationMs = params.durationMs ?? (params.endMs != null ? params.endMs - startMs : 3000)
  const endMs = params.endMs ?? startMs + durationMs
  const outputMs = outputDurationMs(edits)
  if (startMs >= outputMs || Math.min(endMs, outputMs) - startMs < 500) return null
  const preset = textPreset(kind === 'lower_third' ? 'caption_left' : 'title_white_on_dark_blur')
  if (!preset) return null
  const item: TextItem = {
    id: params.id ?? createId('txt'),
    text,
    startMs,
    endMs: Math.min(endMs, outputMs),
    x: params.x ?? (kind === 'lower_third' ? 12 : 50),
    y: params.y ?? (kind === 'lower_third' ? 72 : 30),
    style: { ...preset.style },
    presetId: preset.id,
    anim: {
      in: { type: kind === 'title_card' ? 'pop' : 'slide_up', unit: 'block', durMs: 250 },
      out: { type: 'fade', unit: 'block', durMs: 200 },
    },
  }
  const normalized = normalizeTextItems([...items, item], outputMs)
  if (!normalized) return null
  return { ...edits, textItems: normalized }
}

function applyBrand(edits: ClipEditsV2, params: EditorCommandParams['apply_brand']): ClipEditsV2 {
  return applyBrandTemplateToEdits(edits, params)
}

function applyReorder(
  edits: ClipEditsV2,
  params: EditorCommandParams['reorder_segment'],
  ctx: EditorCommandContext,
): ClipEditsV2 | null {
  return moveVideoSegment(opCtx(edits, ctx), params.segId, params.beforeId)
}

function sourceLen(ctx: EditorCommandContext): number {
  return Math.max(0, ctx.bounds.clipEndMs - ctx.bounds.clipStartMs)
}

export const editorCommandDefinitions: { [K in EditorCommandName]: EditorCommandDefinition<K> } = {
  trim: {
    name: 'trim',
    paramsSchema: { type: 'object' },
    preconditions: {},
    destructive: false,
    bulk: false,
    apply: applyTrim,
    summarize: (p) => rangeSummary(`Trimmed to ${p.inMs}–${p.outMs} ms`, p.inMs, p.outMs),
    bulkFor: (p, ctx) => {
      const src = sourceLen(ctx)
      if (src < 60_000) return false
      return p.outMs - p.inMs < src / 2
    },
  },
  split: {
    name: 'split',
    paramsSchema: { type: 'object' },
    preconditions: { playheadInRange: true },
    destructive: false,
    bulk: false,
    apply: applySplit,
    summarize: (p) => rangeSummary(`Split at ${p.atMs} ms`, p.atMs, p.atMs),
  },
  delete_range: {
    name: 'delete_range',
    paramsSchema: { type: 'object' },
    preconditions: { rangeRequired: true },
    destructive: true,
    bulk: false,
    apply: applyDeleteRange,
    summarize: (p) => rangeSummary(`Deleted ${p.startMs}–${p.endMs} ms`, p.startMs, p.endMs),
    bulkFor: (p, ctx, before) => {
      const len = p.endMs - p.startMs
      const out = outputDurationMs(before) || sourceLen(ctx)
      return len >= 10_000 || (out > 0 && len >= out / 2)
    },
  },
  apply_cleanup: {
    name: 'apply_cleanup',
    paramsSchema: { type: 'object' },
    preconditions: { rangeRequired: true },
    destructive: true,
    bulk: false,
    apply: applyCleanup,
    summarize: (p) => ({
      text: p.proposals.length === 1 ? 'Applied cleanup cut' : `Applied ${p.proposals.length} cleanup cuts`,
      ranges: p.proposals.map((x) => ({ startMs: x.range[0], endMs: x.range[1] })),
    }),
    bulkFor: (p) => p.proposals.length > 1,
  },
  restore_cut: {
    name: 'restore_cut',
    paramsSchema: { type: 'object' },
    preconditions: { rangeRequired: true },
    destructive: false,
    bulk: false,
    apply: applyRestoreCut,
    summarize: (p) => rangeSummary(`Restored ${p.startMs}–${p.endMs} ms`, p.startMs, p.endMs),
  },
  set_captions: {
    name: 'set_captions',
    paramsSchema: { type: 'object' },
    preconditions: {},
    destructive: false,
    bulk: false,
    apply: applySetCaptions,
    summarize: () => ({ text: 'Updated captions' }),
  },
  set_layout: {
    name: 'set_layout',
    paramsSchema: { type: 'object' },
    preconditions: {},
    destructive: false,
    bulk: false,
    apply: applySetLayout,
    summarize: (p) => ({ text: `Layout → ${p.mode}` }),
  },
  add_or_edit_text: {
    name: 'add_or_edit_text',
    paramsSchema: { type: 'object' },
    preconditions: {},
    destructive: false,
    bulk: false,
    apply: applyText,
    summarize: (p) => ({ text: p.id ? 'Edited text overlay' : 'Added text overlay' }),
  },
  apply_brand: {
    name: 'apply_brand',
    paramsSchema: { type: 'object' },
    preconditions: { brandKitRequired: true },
    destructive: false,
    bulk: true,
    apply: applyBrand,
    summarize: () => ({ text: 'Applied brand template' }),
  },
  reorder_segment: {
    name: 'reorder_segment',
    paramsSchema: { type: 'object' },
    preconditions: { itemRequired: true },
    destructive: false,
    bulk: false,
    apply: applyReorder,
    summarize: (p) => ({ text: p.beforeId ? `Moved ${p.segId} before ${p.beforeId}` : `Moved ${p.segId} to end` }),
    bulkFor: (_p, _ctx, before) => (before.videoSplits?.length ?? 0) > 1,
  },
}
