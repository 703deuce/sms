import { defaultEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { AiCaptionsError, assertNoDollar } from '@/lib/ai-captions/errors'
import { groupCaptionLines } from '@/lib/ai-captions/lines'
import { applyStyleToCaptions, type SavedCaptionStyle } from '@/lib/ai-captions/styles'
import {
  editorUrlFor,
  srtUrlFor,
  type AiCaptionsResult,
  type AiCaptionsSource,
  type TranscriptWord,
} from '@/lib/ai-captions/types'
import { transcriptToCaptionWords } from '@/lib/ai-captions/words'

export type ResolvedCaptionsSource = {
  projectId: string
  assetId?: string
  durationMs: number
  ready: boolean
  hasAudio: boolean
  words: TranscriptWord[] | null
  playbackUrl: string | null
  thumbnailUrl: string | null
}

export type WrittenClip = {
  clipId: string
  projectId: string
  editsSaveVersion: number
}

export type CaptionClipEdits = {
  bounds: { clipStartMs: number; clipEndMs: number }
  edits: ClipEditsV2
}

export type AiCaptionsPipelineDeps = {
  /** Create a captions-only project from a completed uploadId. No clip picking, no credit spend. */
  ingestUpload(workspaceId: string, uploadId: string, createdById: string | null): Promise<{ projectId: string }>
  resolveSource(
    workspaceId: string,
    source: AiCaptionsSource,
    ingestedProjectId?: string | null,
  ): Promise<ResolvedCaptionsSource | null>
  transcribe(workspaceId: string, source: ResolvedCaptionsSource): Promise<TranscriptWord[]>
  writeClip(args: {
    workspaceId: string
    projectId: string
    runId: string
    durationMs: number
    title: string
    edits: ClipEditsV2
  }): Promise<WrittenClip>
  updateClipEdits(args: {
    clipId: string
    bounds: { clipStartMs: number; clipEndMs: number }
    baseVersion: number
    edits: ClipEditsV2
  }): Promise<WrittenClip>
  exportMp4(args: { workspaceId: string; clipId: string; watermark: false }): Promise<{ downloadUrl: string | null; renderId?: string | null }>
  pollExport?(workspaceId: string, renderId: string): Promise<{
    status: 'processing' | 'ready' | 'failed'
    downloadUrl: string | null
    error?: string
    stage?: 'prepare' | 'encode' | 'upload'
    progressPercent?: number
    etaSeconds?: number | null
  }>
  getCaptionLines?(workspaceId: string, clipId: string): Promise<AiCaptionsResult['lines']>
  getEditsVersion?(workspaceId: string, clipId: string): Promise<number>
  listSavedStyles(workspaceId: string): Promise<SavedCaptionStyle[]>
}

export function buildCaptionEdits(
  durationMs: number,
  styleId: string,
  saved: SavedCaptionStyle[],
  lines: AiCaptionsResult['lines'],
): CaptionClipEdits {
  const bounds = { clipStartMs: 0, clipEndMs: durationMs }
  const applied = applyStyleToCaptions(styleId, saved)
  const base = defaultEdits(bounds)
  const edits: ClipEditsV2 = {
    ...base,
    captions: {
      ...base.captions,
      enabled: true,
      presetId: applied.presetId,
      animation: applied.animation,
      position: 'bottom',
      case: 'sentence',
      keywordHighlight: applied.keywordHighlight,
      autoEmojis: applied.autoEmojis,
      ...(applied.customPresetId ? { customPresetId: applied.customPresetId } : {}),
      ...(applied.presetConfig ? { presetConfig: applied.presetConfig } : {}),
    },
    captionLines: lines.map((l) => ({
      id: l.id,
      text: l.text,
      startMs: l.startMs,
      endMs: l.endMs,
    })),
  }
  return { bounds, edits }
}

export function buildResult(args: {
  runId: string
  clipId: string
  projectId: string
  durationMs: number
  styleId: string
  words: AiCaptionsResult['words']
  lines: AiCaptionsResult['lines']
  playbackUrl: string | null
  thumbnailUrl: string | null
  downloadUrl: string | null
}): AiCaptionsResult {
  return {
    clipId: args.clipId,
    projectId: args.projectId,
    editorUrl: editorUrlFor(args.projectId, args.clipId),
    durationMs: args.durationMs,
    styleId: args.styleId,
    captionsEnabled: true,
    bounds: { startMs: 0, endMs: args.durationMs },
    words: args.words,
    lines: args.lines,
    playbackUrl: args.playbackUrl,
    thumbnailUrl: args.thumbnailUrl,
    downloadUrl: args.downloadUrl,
    srtUrl: srtUrlFor(args.runId),
  }
}

export async function loadOrTranscribe(
  workspaceId: string,
  source: AiCaptionsSource,
  deps: AiCaptionsPipelineDeps,
  ingestedProjectId?: string | null,
): Promise<ResolvedCaptionsSource & { words: TranscriptWord[] }> {
  const resolved = await deps.resolveSource(workspaceId, source, ingestedProjectId)
  if (!resolved) {
    throw new AiCaptionsError('source_not_found', 'That project, upload, or asset was not found in this workspace.', 404)
  }
  if (!resolved.hasAudio) {
    throw new AiCaptionsError('source_has_no_audio', 'This source has no audio to transcribe.', 400)
  }
  if (resolved.words && resolved.words.length && resolved.ready) {
    return { ...resolved, words: resolved.words }
  }
  if (source.kind === 'upload' && (!resolved.ready || !resolved.words?.length)) {
    if (resolved.ready && !resolved.words?.length) {
      console.warn('[ai-captions:pipeline] transcription_empty', { projectId: resolved.projectId })
      throw new AiCaptionsError('source_has_no_audio', 'No speech was detected in this video. Try another upload with spoken audio.', 400)
    }
    console.info('[ai-captions:pipeline] transcription_pending', { projectId: resolved.projectId })
    throw new AiCaptionsError('source_not_ready', 'Transcription did not return any words yet.', 400)
  }
  if (!resolved.ready) {
    throw new AiCaptionsError('source_not_ready', 'The source is not ready yet.', 400)
  }
  if (resolved.words && resolved.words.length) {
    return { ...resolved, words: resolved.words }
  }
  try {
    const words = await deps.transcribe(workspaceId, resolved)
    if (!words.length) {
      throw new AiCaptionsError('source_not_ready', 'Transcription did not return any words yet.', 400)
    }
    return { ...resolved, words }
  } catch (err) {
    if (err instanceof AiCaptionsError) throw err
    const message = assertNoDollar(err instanceof Error ? err.message : 'Transcription failed.')
    throw new AiCaptionsError('source_not_ready', message, 400)
  }
}

export function captionsFromTranscript(
  durationMs: number,
  words: TranscriptWord[],
  styleId: string,
  saved: SavedCaptionStyle[],
): { words: AiCaptionsResult['words']; lines: AiCaptionsResult['lines']; edits: ClipEditsV2 } {
  const captionWords = transcriptToCaptionWords(words)
  const lines = groupCaptionLines(captionWords)
  const { edits } = buildCaptionEdits(durationMs, styleId, saved, lines)
  return { words: captionWords, lines, edits }
}
