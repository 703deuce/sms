/**
 * B6 template slot-local playback. The authored slot duration is immutable; this module only maps
 * output/item-local 30fps frames to source frames. Holds freeze picture/source audio while text,
 * graphics, transitions and music stay on the output clock.
 */
import { CURVE_PIECES, SPEED_CURVE_IDS, curveSpeedAt, type SpeedCurveId } from '@/lib/clips/editor/speed-curves'
import { clampSpeed } from '@/lib/clips/editor/speed'
import {
  SOURCE_PLAYBACK_FPS,
  normalizeSourceSegmentPlayback,
  sourcePlaybackSample,
  type SourceSegmentPlayback,
} from '@/lib/clips/editor/sources'

export type TemplatePlaybackPiece =
  | { kind: 'play'; frames: number; rate: number }
  | { kind: 'hold'; frames: number }
  | { kind: 'curve'; frames: number; curve: SpeedCurveId }

export type TemplateSlotPlaybackSpec = {
  pieces: TemplatePlaybackPiece[]
}

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const posInt = (v: unknown) => Number.isSafeInteger(v) && Number(v) > 0
const exact = (o: Record<string, unknown>, allowed: readonly string[], context: string) => {
  for (const k of Object.keys(o)) if (!allowed.includes(k)) throw new Error(context + ': unsupported field ' + k)
}

export function validateTemplatePlaybackSpec(raw: unknown, outputFrames: number): TemplateSlotPlaybackSpec {
  if (!object(raw)) throw new Error('slot.playback: expected object')
  exact(raw, ['pieces'], 'slot.playback')
  if (!Array.isArray(raw.pieces) || !raw.pieces.length) throw new Error('slot.playback: pieces required')
  const pieces: TemplatePlaybackPiece[] = []
  let total = 0
  for (const value of raw.pieces) {
    if (!object(value) || !posInt(value.frames)) throw new Error('slot.playback: invalid piece')
    const frames = Number(value.frames)
    if (value.kind === 'hold') {
      exact(value, ['kind','frames'], 'slot.playback.hold')
      pieces.push({ kind: 'hold', frames })
    } else if (value.kind === 'play') {
      exact(value, ['kind','frames','rate'], 'slot.playback.play')
      const rate = Number(value.rate)
      if (!Number.isFinite(rate) || rate < 0.25 || rate > 4) throw new Error('slot.playback: rate must be 0.25..4')
      const rounded = Math.round(rate * 1000) / 1000
      if (Math.abs(rate - rounded) > 1e-9) throw new Error('slot.playback: rate precision is 3 decimals')
      pieces.push({ kind: 'play', frames, rate: rounded })
    } else if (value.kind === 'curve') {
      exact(value, ['kind','frames','curve'], 'slot.playback.curve')
      if (!(SPEED_CURVE_IDS as readonly unknown[]).includes(value.curve))
        throw new Error('slot.playback: unsupported curve')
      pieces.push({ kind: 'curve', frames, curve: value.curve as SpeedCurveId })
    } else {
      throw new Error('slot.playback: unsupported piece')
    }
    total += frames
  }
  if (total !== outputFrames) throw new Error('slot.playback: pieces must fill slot output exactly')
  return { pieces }
}

function pushPiece(out: SourceSegmentPlayback['pieces'], piece: SourceSegmentPlayback['pieces'][number]) {
  const prev = out[out.length - 1]
  if (piece.kind === 'hold' && prev?.kind === 'hold') {
    prev.frames += piece.frames
    return
  }
  if (piece.kind === 'play' && prev?.kind === 'play' && prev.rate === piece.rate) {
    prev.frames += piece.frames
    return
  }
  out.push({ ...piece })
}

export function compileTemplatePlayback(raw: unknown, outputFrames: number): SourceSegmentPlayback {
  const spec = validateTemplatePlaybackSpec(raw, outputFrames)
  const pieces: SourceSegmentPlayback['pieces'] = []
  for (const piece of spec.pieces) {
    if (piece.kind === 'hold') {
      pushPiece(pieces, { kind: 'hold', frames: piece.frames })
      continue
    }
    if (piece.kind === 'play') {
      pushPiece(pieces, { kind: 'play', frames: piece.frames, rate: piece.rate })
      continue
    }
    const n = Math.max(1, Math.min(CURVE_PIECES, piece.frames))
    for (let i = 0; i < n; i++) {
      const a = Math.round(piece.frames * i / n)
      const b = Math.round(piece.frames * (i + 1) / n)
      if (b <= a) continue
      const rate = clampSpeed(Math.round(curveSpeedAt(piece.curve, (i + 0.5) / n) * 20) / 20)
      pushPiece(pieces, { kind: 'play', frames: b - a, rate })
    }
  }
  const plan = normalizeSourceSegmentPlayback({ v: 1, fps: SOURCE_PLAYBACK_FPS, outputFrames, pieces })
  if (!plan) throw new Error('slot.playback: failed canonical expansion')
  return plan
}

export function sampleTemplatePlayback(playback: SourceSegmentPlayback, sourceInFrame: number, localFrame: number) {
  const sample = sourcePlaybackSample(playback, localFrame)
  return {
    outputLocalFrame: localFrame,
    mediaFrame: sourceInFrame + sample.mediaOffsetFrame,
    rate: sample.rate,
    held: sample.held,
  }
}

export function playbackSourceBounds(
  playback: SourceSegmentPlayback,
  sourceInFrame: number,
  fromLocalFrame = 0,
  toLocalFrame = playback.outputFrames - 1,
): { minFrame: number; maxFrame: number } {
  if (!Number.isInteger(fromLocalFrame) || !Number.isInteger(toLocalFrame) || toLocalFrame < fromLocalFrame)
    throw new RangeError('slot.playback: invalid bounds')
  let minFrame = Infinity
  let maxFrame = -Infinity
  for (let frame = fromLocalFrame; frame <= toLocalFrame; frame++) {
    const media = sampleTemplatePlayback(playback, sourceInFrame, frame).mediaFrame
    minFrame = Math.min(minFrame, media)
    maxFrame = Math.max(maxFrame, media)
  }
  return { minFrame, maxFrame }
}

export function playbackRequiredHandleFrames(
  playback: SourceSegmentPlayback,
  side: 'head' | 'tail',
  outputHandleFrames: number,
): number {
  if (!Number.isInteger(outputHandleFrames) || outputHandleFrames < 0)
    throw new RangeError('slot.playback: invalid transition handle')
  if (!outputHandleFrames) return 0
  if (side === 'head') {
    const atCut = sourcePlaybackSample(playback, 0).mediaOffsetFrame
    const edge = sourcePlaybackSample(playback, -outputHandleFrames).mediaOffsetFrame
    return Math.ceil(Math.max(0, atCut - edge))
  }
  const end = playback.outputFrames - 1
  const atCut = sourcePlaybackSample(playback, end).mediaOffsetFrame
  const edge = sourcePlaybackSample(playback, end + outputHandleFrames).mediaOffsetFrame
  return Math.ceil(Math.max(0, edge - atCut))
}
