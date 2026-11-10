import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { AiCaptionsPipelineDeps, WrittenClip } from '@/lib/ai-captions/pipeline'
import { memoryAiCaptionsPrefs, memoryAiCaptionsStore } from '@/lib/ai-captions/run-store'
import type { AiCaptionsRunDeps } from '@/lib/ai-captions/runs'
import type { SavedCaptionStyle } from '@/lib/ai-captions/styles'
import type { AiCaptionsSource, TranscriptWord } from '@/lib/ai-captions/types'
import { AiCaptionsError } from '@/lib/ai-captions/errors'

export type ReadySource = {
  projectId: string
  uploadId?: string
  assetId?: string
  durationMs: number
  ready?: boolean
  hasAudio?: boolean
  words: TranscriptWord[]
  wordsPending?: boolean
  playbackUrl?: string | null
  thumbnailUrl?: string | null
}

export function wordsAt(script: Array<{ w: string; s: number; dur?: number; p?: number }>): TranscriptWord[] {
  const out: TranscriptWord[] = []
  for (let i = 0; i < script.length; i++) {
    const row = script[i]!
    const s = row.s
    const e = s + (row.dur ?? 0.4)
    const next = script[i + 1]?.s
    const word: TranscriptWord = { w: row.w, s, e: next != null ? Math.min(e, next) : e }
    if (row.p !== undefined) word.p = row.p
    out.push(word)
  }
  return out
}

/** 25-minute talking-head transcript with punctuation, a mid-sentence stretch, and a low-confidence word. */
export function longTalkingHeadWords(): TranscriptWord[] {
  const words: TranscriptWord[] = []
  const sentences = [
    'Welcome back to the show, I am glad you made it.',
    'Today we are walking through a quiet launch and what changed.',
    'The team shipped the build after midnight and nobody slept.',
    'Still, the first comments were kind, and that mattered.',
  ]
  let t = 0
  let n = 0
  const end = 25 * 60
  while (t < end - 8) {
    const sentence = sentences[n % sentences.length]!
    const parts = sentence.split(' ')
    for (const part of parts) {
      const p = n === 40 ? 0.21 : n % 17 === 0 ? 0.92 : undefined
      words.push({ w: part, s: t, e: t + 0.35, ...(p !== undefined ? { p } : {}) })
      t += 0.4
      n += 1
      if (t >= end - 2) break
    }
    t += 0.6
  }
  words.push({ w: 'Thanks.', s: end - 1.2, e: end - 0.4, p: 0.99 })
  return words
}

export function testDeps(opts?: {
  sources?: Map<string, ReadySource>
  saved?: SavedCaptionStyle[]
  transcribe?: AiCaptionsPipelineDeps['transcribe']
}): AiCaptionsRunDeps & {
  clips: Map<string, { projectId: string; durationMs: number; edits: ClipEditsV2; version: number }>
  lastExportWatermark: boolean | null
} {
  const sources = opts?.sources ?? new Map<string, ReadySource>()
  const clips = new Map<string, { projectId: string; durationMs: number; edits: ClipEditsV2; version: number }>()
  let exportWatermark: boolean | null = null
  let clipN = 0

  const keyFor = (source: AiCaptionsSource) => {
    if (source.kind === 'asset') return `asset:${source.projectId}:${source.assetId}`
    if (source.kind === 'upload') return `upload:${source.uploadId}`
    return `project:${source.projectId}`
  }

  let createdFromUpload = 0
  const pipeline: AiCaptionsPipelineDeps = {
    async ingestUpload(_workspaceId, uploadId) {
      const hit = sources.get(`upload:${uploadId}`)
      if (!hit) throw new AiCaptionsError('source_not_found', 'That upload was not found in this workspace.', 404)
      if (hit.ready === false && !hit.projectId) {
        throw new AiCaptionsError('source_not_ready', 'The upload is not complete yet.', 400)
      }
      createdFromUpload += 1
      return { projectId: hit.projectId || `proj_from_${uploadId}` }
    },
    async resolveSource(_workspaceId, source, ingestedProjectId) {
      const hit =
        sources.get(keyFor(source)) ||
        (ingestedProjectId ? sources.get(`project:${ingestedProjectId}`) : undefined) ||
        (typeof ingestedProjectId === 'string' ? [...sources.values()].find((s) => s.projectId === ingestedProjectId) : undefined)
      if (!hit) return null
      if (source.kind === 'asset' && hit.assetId && hit.assetId !== source.assetId) return null
      const words = hit.wordsPending ? null : hit.words
      return {
        projectId: hit.projectId,
        assetId: source.kind === 'asset' ? source.assetId : hit.assetId,
        durationMs: hit.durationMs,
        ready: hit.ready !== false && !hit.wordsPending,
        hasAudio: hit.hasAudio !== false,
        words,
        playbackUrl: hit.playbackUrl ?? null,
        thumbnailUrl: hit.thumbnailUrl ?? null,
      }
    },
    transcribe:
      opts?.transcribe ??
      (async () => {
        throw new AiCaptionsError('source_not_ready', 'Transcription did not return any words yet.', 400)
      }),
    async writeClip(args) {
      clipN += 1
      const clipId = `clip_cap_${clipN}`
      clips.set(clipId, { projectId: args.projectId, durationMs: args.durationMs, edits: args.edits, version: 1 })
      return { clipId, projectId: args.projectId, editsSaveVersion: 1 }
    },
    async updateClipEdits(args) {
      const current = clips.get(args.clipId)
      if (!current) throw new Error('clip missing')
      current.edits = args.edits
      current.version += 1
      return { clipId: args.clipId, projectId: current.projectId, editsSaveVersion: current.version }
    },
    async exportMp4(args) {
      exportWatermark = args.watermark
      return { downloadUrl: `https://example.test/exports/${args.clipId}.mp4` }
    },
    async listSavedStyles() {
      return opts?.saved ?? []
    },
  }

  return {
    store: memoryAiCaptionsStore(),
    prefs: memoryAiCaptionsPrefs(),
    pipeline,
    now: () => new Date('2026-11-10T07:30:00.000Z'),
    clips,
    get lastExportWatermark() {
      return exportWatermark
    },
  }
}

export function sourceMap(rows: ReadySource[]): Map<string, ReadySource> {
  const map = new Map<string, ReadySource>()
  for (const row of rows) {
    map.set(row.projectId, row)
    map.set(`project:${row.projectId}`, row)
    if (row.assetId) map.set(`asset:${row.projectId}:${row.assetId}`, row)
    if (row.uploadId) map.set(`upload:${row.uploadId}`, row)
  }
  return map
}

export type { WrittenClip }
