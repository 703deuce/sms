import {
  DEFAULT_DUCK_DEPTH,
  DEFAULT_MUSIC_FADE_IN_MS,
  DEFAULT_MUSIC_FADE_OUT_MS,
  DEFAULT_MUSIC_VOLUME,
  DEFAULT_SFX_VOLUME,
} from '@/lib/clips/audio'
import { applyBrandTemplateToEdits } from '@/lib/clips/apply-brand'
import { brandTemplateSettingsSchema } from '@/lib/clips/brand'
import type { BrollItem } from '@/lib/clips/broll'
import { createId } from '@/lib/supabase/id'
import { defaultEdits, type ClipBounds, type ClipEditsV2 } from '@/lib/clips/edits'

export type ProducerToolName =
  | 'trim'
  | 'set_captions'
  | 'set_layout'
  | 'set_title'
  | 'set_music_mix'
  | 'add_sfx'
  | 'remove_broll'
  | 'insert_stock_broll'
  | 'generate_ai_broll'
  | 'generate_music'
  | 'generate_thumbnail'
  | 'dub'
  | 'apply_brand'

export type ProducerToolCall = {
  name: ProducerToolName
  args: Record<string, unknown>
  requiresConfirm?: boolean
}

export type ReducerResult = {
  edits: ClipEditsV2
  summary: string
  pendingPaid?: ProducerToolCall
}

export function applyProducerTool(
  edits: ClipEditsV2,
  bounds: ClipBounds,
  call: ProducerToolCall,
): ReducerResult {
  const base = { ...edits, v: 2 as const }
  switch (call.name) {
    case 'trim': {
      const inMs = Number(call.args.inMs ?? base.trim.in)
      const outMs = Number(call.args.outMs ?? base.trim.out)
      return {
        edits: { ...base, trim: { in: inMs, out: outMs } },
        summary: `Trimmed to ${inMs}–${outMs} ms`,
      }
    }
    case 'set_captions': {
      const captions = { ...base.captions, ...(call.args as Record<string, unknown>) }
      return { edits: { ...base, captions }, summary: 'Updated captions' }
    }
    case 'set_layout': {
      const mode = String(call.args.mode || base.layout.mode) as ClipEditsV2['layout']['mode']
      return {
        edits: { ...base, layout: { ...base.layout, mode } },
        summary: `Layout → ${mode}`,
      }
    }
    case 'set_title':
      return { edits: base, summary: `Title → ${String(call.args.title || '')}` }
    case 'set_music_mix': {
      const music = base.audio?.music
      if (!music) return { edits: base, summary: 'No music to mix' }
      const patch = call.args as { volumeDb?: number; duckDepthDb?: number }
      const volume =
        patch.volumeDb !== undefined ? Math.min(1, Math.max(0, (patch.volumeDb + 60) / 60)) : music.volume
      const duckDepth =
        patch.duckDepthDb !== undefined
          ? Math.min(1, Math.max(0, patch.duckDepthDb / 30))
          : music.duckDepth
      return {
        edits: {
          ...base,
          audio: {
            music: { ...music, volume, duckDepth },
            sfx: base.audio?.sfx || [],
          },
        },
        summary: 'Updated music mix',
      }
    }
    case 'add_sfx': {
      const generationId = String(call.args.generationId || '')
      const atMs = Number(call.args.atMs ?? 0)
      if (!generationId) return { edits: base, summary: 'Missing SFX generation' }
      const sfx = [...(base.audio?.sfx || []), { generationId, atMs, volume: DEFAULT_SFX_VOLUME }]
      return {
        edits: {
          ...base,
          audio: { music: base.audio?.music ?? null, sfx },
        },
        summary: `Added SFX at ${atMs} ms`,
      }
    }
    case 'remove_broll': {
      const id = String(call.args.id || '')
      const broll = (base.broll || []).filter((b) => b.id !== id)
      return { edits: { ...base, broll }, summary: 'Removed B-roll' }
    }
    case 'insert_stock_broll': {
      const item: BrollItem = {
        id: createId('broll'),
        source: 'stock',
        assetId: String(call.args.assetId || ''),
        startMs: Number(call.args.atMs ?? 0),
        endMs: Number(call.args.atMs ?? 0) + Number(call.args.durationMs ?? 3000),
      }
      return {
        edits: { ...base, broll: [...(base.broll || []), item] },
        summary: `Stock B-roll at ${item.startMs} ms`,
      }
    }
    case 'generate_ai_broll':
    case 'generate_music':
    case 'generate_thumbnail':
      return {
        edits: base,
        summary: `Pending ${call.name}`,
        pendingPaid: { ...call, requiresConfirm: true },
      }
    case 'dub':
      return {
        edits: base,
        summary: `Pending dub (${String(call.args.targetLang || 'es')})`,
        pendingPaid: { ...call, requiresConfirm: true },
      }
    case 'apply_brand': {
      const settings = brandTemplateSettingsSchema.parse(call.args.settings ?? call.args)
      const logoKey = call.args.logoKey as string | undefined
      const next = applyBrandTemplateToEdits(base, { logoKey, settings })
      return { edits: next, summary: 'Applied brand template' }
    }
    default:
      return { edits: base, summary: 'Unknown tool' }
  }
}

export function applyProducerTools(
  initial: ClipEditsV2,
  bounds: ClipBounds,
  calls: ProducerToolCall[],
): { edits: ClipEditsV2; summaries: string[]; pendingPaid: ProducerToolCall[] } {
  let edits = initial
  const summaries: string[] = []
  const pendingPaid: ProducerToolCall[] = []
  for (const call of calls) {
    const res = applyProducerTool(edits, bounds, call)
    edits = res.edits
    summaries.push(res.summary)
    if (res.pendingPaid) pendingPaid.push(res.pendingPaid)
  }
  return { edits, summaries, pendingPaid }
}

export function freshProducerEdits(bounds: ClipBounds) {
  return defaultEdits(bounds)
}
