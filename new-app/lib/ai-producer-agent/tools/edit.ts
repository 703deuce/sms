import type { OutputState } from '@/lib/ai-producer-agent/orchestrator'
import { DraftEditsBuilder } from '@/lib/ai-producer-agent/draft-edits'
import type { ToolCtx } from '@/lib/ai-producer-agent/tools/registry'
import { validateBrokenRules } from '@/lib/ai-producer-agent/validate'

export function createProject(ctx: ToolCtx, out: OutputState, args: Record<string, unknown>) {
  if (out.builder) return { ok: false, summary: 'project already started' }
  const sources = (args.sources as string[]) ?? ctx.sources.map((s) => s.sourceId)
  const main = sources[0] ?? ctx.sources[0]?.sourceId
  if (!main) return { ok: false, summary: 'no main source' }
  // The rough-cut specialist returns ABSOLUTE timestamps in the source recording.
  // A nonzero clipStartMs here makes normalizeEdits' legacy-relative migration
  // add the source-window offset a second time when the trim happens to fit
  // within the window's length (observed: +300040ms on a 90s run).
  const bounds = ctx.config.editMode === 'just_chatting_rough_cut'
    ? absoluteSourceBounds(ctx)
    : provisionalBounds(ctx)
  out.builder = new DraftEditsBuilder(bounds, main, ctx.cache.words ?? [], ctx.rmsLookup ?? (() => []))
  out.builder.aspectRatio = ctx.config.editMode === 'just_chatting_rough_cut'
    ? '16:9' : (args.aspect as typeof out.builder.aspectRatio) ?? '9:16'
  // Long-form rough cuts default to the untouched full source frame. On a
  // three-person two-shot, speaker_follow without face boxes can zoom the
  // entire frame. Clip-mode 9:16 talking-head exports use speaker tracking;
  // the worker already runs face-aware reframe for speaker_follow.
  if (ctx.config.editMode === 'just_chatting_rough_cut') {
    const clipMode=ctx.config.storyMode==='clip_moment_v1'||ctx.config.storyMode==='clip_story_v1'
    out.builder.setLayout(clipMode?'speaker_follow':'full_frame')
  }
  out.pendingTitle = String(args.title ?? 'AI Producer edit')
  out.pendingSources = sources
  return { ok: true, summary: `builder ready main=${main}`, data: { mainSourceId: main } }
}

export function addSegment(ctx: ToolCtx, out: OutputState, args: Record<string, unknown>) {
  if (!out.builder) return { ok: false, summary: 'call create_project first' }
  const srcInMs = Number(args.srcInMs)
  const srcOutMs = Number(args.srcOutMs)
  for (const [s, e] of ctx.usedPayoffs) {
    const overlap = Math.max(0, Math.min(srcOutMs, e) - Math.max(srcInMs, s))
    if (overlap / Math.max(1, srcOutMs - srcInMs) > 0.5) {
      return { ok: false, summary: 'payoff overlap' }
    }
  }
  const seg = out.builder.addSegment(
    {
      sourceId: String(args.sourceId),
      srcInMs,
      srcOutMs,
      beat: args.beat as string | undefined,
    },
    args.atIndex != null ? Number(args.atIndex) : undefined,
  )
  return { ok: true, summary: seg.id, data: { segmentId: seg.id } }
}

export function trimSegment(out: OutputState, args: Record<string, unknown>) {
  if (!out.builder) return { ok: false, summary: 'call create_project first' }
  out.builder.trimSegment(
    String(args.segmentId),
    args.srcInMs != null ? Number(args.srcInMs) : undefined,
    args.srcOutMs != null ? Number(args.srcOutMs) : undefined,
  )
  return { ok: true, summary: 'trimmed' }
}

export function splitSegment(out: OutputState, args: Record<string, unknown>) {
  if (!out.builder) return { ok: false, summary: 'call create_project first' }
  out.builder.split(Number(args.atSrcMs))
  return { ok: true, summary: 'split' }
}

export function cutRange(out: OutputState, args: Record<string, unknown>) {
  if (!out.builder) return { ok: false, summary: 'call create_project first' }
  out.builder.cutRange(Number(args.srcInMs), Number(args.srcOutMs), (args.kind as 'gap' | 'filler' | 'manual') ?? 'manual')
  return { ok: true, summary: 'cut' }
}

export function reorder(out: OutputState, args: Record<string, unknown>) {
  if (!out.builder) return { ok: false, summary: 'call create_project first' }
  out.builder.reorder((args.order as string[]) ?? [])
  return { ok: true, summary: 'reordered' }
}

export function setTransition(out: OutputState, args: Record<string, unknown>) {
  if (!out.builder) return { ok: false, summary: 'call create_project first' }
  out.builder.setTransition(String(args.atSegment), String(args.type), args.durMs != null ? Number(args.durMs) : undefined)
  return { ok: true, summary: 'transition' }
}

export function setSplitEdit(out: OutputState, args: Record<string, unknown>) {
  if (!out.builder) return { ok: false, summary: 'call create_project first' }
  out.builder.setSplitEdit(String(args.atSegment), Number(args.audioOffsetMs))
  return { ok: true, summary: 'split edit' }
}

export function setCaptions(out: OutputState, args: Record<string, unknown>) {
  if (!out.builder) return { ok: false, summary: 'call create_project first' }
  out.builder.setCaptions(args as Record<string, unknown>)
  return { ok: true, summary: 'captions' }
}

export function setLayout(out: OutputState, args: Record<string, unknown>) {
  if (!out.builder) return { ok: false, summary: 'call create_project first' }
  out.builder.setLayout(String(args.mode))
  return { ok: true, summary: 'layout' }
}

export function addZoom(out: OutputState, args: Record<string, unknown>) {
  if (!out.builder) return { ok: false, summary: 'call create_project first' }
  out.builder.addZoom(Number(args.outInMs), Number(args.outOutMs), Number(args.scale), (args.ease as 'snap' | 'smooth') ?? 'snap')
  return { ok: true, summary: 'zoom' }
}

export function addText(out: OutputState, args: Record<string, unknown>) {
  if (!out.builder) return { ok: false, summary: 'call create_project first' }
  out.builder.addText(String(args.text), Number(args.outInMs), Number(args.durMs), args.kind as 'hook' | 'label' | 'meme', args.style as string | undefined)
  return { ok: true, summary: 'text' }
}

export function addMusic(out: OutputState, args: Record<string, unknown>) {
  if (!out.builder) return { ok: false, summary: 'call create_project first' }
  out.builder.addMusic({
    assetId: String(args.assetId),
    outInMs: Number(args.outInMs),
    outOutMs: args.outOutMs != null ? Number(args.outOutMs) : undefined,
    volumeDb: Number(args.volumeDb),
  })
  return { ok: true, summary: 'music' }
}

export function addSfx(out: OutputState, args: Record<string, unknown>) {
  if (!out.builder) return { ok: false, summary: 'call create_project first' }
  out.builder.addSfx({ sfxId: String(args.sfxId), outMs: Number(args.outMs), volumeDb: args.volumeDb != null ? Number(args.volumeDb) : undefined })
  return { ok: true, summary: 'sfx' }
}

export function setSpeed(out: OutputState, args: Record<string, unknown>) {
  if (!out.builder) return { ok: false, summary: 'call create_project first' }
  out.builder.setSpeed(Number(args.srcInMs), Number(args.srcOutMs), Number(args.rate))
  return { ok: true, summary: 'speed' }
}

export function setFreeze(out: OutputState, args: Record<string, unknown>) {
  if (!out.builder) return { ok: false, summary: 'call create_project first' }
  out.builder.setFreeze(Number(args.atSrcMs), Number(args.durMs))
  return { ok: true, summary: 'freeze' }
}

export function setLoudness(out: OutputState, args: Record<string, unknown>) {
  if (!out.builder) return { ok: false, summary: 'call create_project first' }
  out.builder.setLoudness(Number(args.lufs) as -14 | -16 | -18)
  return { ok: true, summary: 'loudness' }
}

export function finishEdit(out: OutputState, args: Record<string, unknown>) {
  const broken = validateBrokenRules({
    genre: 'irl_just_chatting',
    outputType: out.outputType,
    platform: 'tiktok',
    targetLengthS: [15, 30],
    story: '',
    segments: [],
    brokenRules: (args.brokenRules as []) ?? [],
  })
  if (broken.some((b) => b.hard)) return { ok: false, summary: 'invalid brokenRules' }
  return { ok: true, summary: 'finish', data: { story: args.story } }
}

function provisionalBounds(ctx: ToolCtx) {
  const src = ctx.sources[0]
  const start = src?.rangeMs?.[0] ?? 0
  const end = src?.rangeMs?.[1] ?? start + 120_000
  return { clipStartMs: start, clipEndMs: end, trimMinMs: 0, trimMaxMs: end + 60_000 }
}

/** Absolute-recording timebase for sourced rough cuts; never window-relative. */
function absoluteSourceBounds(ctx: ToolCtx) {
  const end = ctx.sources[0]?.rangeMs?.[1] ?? 120_000
  return { clipStartMs: 0, clipEndMs: end, trimMinMs: 0, trimMaxMs: end }
}
