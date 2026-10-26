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
import { normalizeSetCaptionsArgs, resolvedCaptionStyle } from '@/lib/clips/producer-captions'
import { defaultEdits, type ClipBounds, type ClipEditsV2, type ClipWord } from '@/lib/clips/edits'
import { applySilenceTrimToEdits } from '@/lib/clips/silence-trim'

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
  | 'set_zoom'
  | 'set_silence_trim'
  | 'apply_silence_trim'

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
      const args = normalizeSetCaptionsArgs(call.args || {}, base.captions)
      const captions = { ...base.captions, ...args }
      const next = { ...base, captions }
      if (
        JSON.stringify(resolvedCaptionStyle(base.captions)) ===
        JSON.stringify(resolvedCaptionStyle(next.captions))
      ) {
        return { edits: base, summary: 'No caption change needed' }
      }
      return { edits: next, summary: 'Updated captions' }
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
      const next = applyBrandTemplateToEdits(base, {
        logoKey,
        settings,
        introVideoKey: call.args.introVideoKey as string | undefined,
        outroVideoKey: call.args.outroVideoKey as string | undefined,
        id: call.args.templateId as string | undefined,
      })
      return { edits: next, summary: 'Applied brand template' }
    }
    case 'set_zoom': {
      const a = call.args as { enabled?: boolean; intensity?: number }
      const zoom = { ...base.zoom, ...a }
      return { edits: { ...base, zoom }, summary: 'Updated auto zoom' }
    }
    case 'set_silence_trim': {
      const a = call.args as { enabled?: boolean; minGapMs?: number; keepMs?: number }
      const silenceTrim = { ...base.silenceTrim, ...a }
      return { edits: { ...base, silenceTrim }, summary: 'Updated silence trim' }
    }
    case 'apply_silence_trim':
      return { edits: base, summary: 'apply_silence_trim requires words (server)' }
    default:
      return { edits: base, summary: 'Unknown tool' }
  }
}

export function applyProducerToolsWithWords(
  initial: ClipEditsV2,
  bounds: ClipBounds,
  calls: ProducerToolCall[],
  words: ClipWord[],
): { edits: ClipEditsV2; summaries: string[]; pendingPaid: ProducerToolCall[] } {
  const trimmed = calls.filter((c) => c.name !== 'apply_silence_trim')
  const silenceCalls = calls.filter((c) => c.name === 'apply_silence_trim')
  let { edits, summaries, pendingPaid } = applyProducerTools(initial, bounds, trimmed)
  for (const call of silenceCalls) {
    const a = call.args as { minGapMs?: number; keepMs?: number }
    edits = applySilenceTrimToEdits(edits, words, { enabled: true, ...a })
    summaries.push('Tightened silence gaps')
  }
  return { edits, summaries, pendingPaid }
}

/** Apply many producer tools as one logical patch (single undo step on the client). */
export function applyProducerPatch(
  initial: ClipEditsV2,
  bounds: ClipBounds,
  calls: ProducerToolCall[],
): { edits: ClipEditsV2; summaries: string[]; pendingPaid: ProducerToolCall[]; changeCount: number } {
  const { edits, summaries, pendingPaid } = applyProducerTools(initial, bounds, calls)
  const changeCount = summaries.filter((s) => !/^Pending /.test(s)).length
  return { edits, summaries, pendingPaid, changeCount }
}

export function applyProducerTools(
  initial: ClipEditsV2,
  bounds: ClipBounds,
  calls: ProducerToolCall[],
): { edits: ClipEditsV2; summaries: string[]; pendingPaid: ProducerToolCall[] } {
  let edits = initial
  const summaries: string[] = []
  const pendingPaid: ProducerToolCall[] = []
  const captionCalls = calls.filter((c) => c.name === 'set_captions')
  const otherCalls = calls.filter((c) => c.name !== 'set_captions')
  if (captionCalls.length > 1) {
    const merged: ProducerToolCall = {
      name: 'set_captions',
      args: captionCalls.reduce((acc, c) => ({ ...acc, ...(c.args || {}) }), {}),
    }
    const res = applyProducerTool(edits, bounds, merged)
    edits = res.edits
    summaries.push(res.summary)
  } else if (captionCalls.length === 1) {
    const res = applyProducerTool(edits, bounds, captionCalls[0])
    edits = res.edits
    summaries.push(res.summary)
  }
  for (const call of otherCalls) {
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
