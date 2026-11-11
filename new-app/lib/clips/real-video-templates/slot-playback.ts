/**
 * Standalone template slot-local playback sampler. This is an opt-in planning primitive:
 * no legacy ClipEditsV2 field or renderer is changed by importing it.
 *
 * Time domains: output/item are integer frames at 30fps; media is a real-valued source
 * frame. A hold samples the last advancing frame, while output time (music/text) continues.
 * A curve changes SOURCE progress only; it never moves cuts or output-clock overlays.
 */
export type TemplatePlaybackPiece =
  | { kind: 'play'; frames: number; rate: number }
  | { kind: 'hold'; frames: number }

export type TemplateSlotPlayback = {
  outputFrames: number
  sourceInFrame: number
  sourceDurationFrames: number
  pieces: readonly TemplatePlaybackPiece[]
  headFrames?: number
  tailFrames?: number
}

export type TemplatePlaybackSample = {
  outputLocalFrame: number
  mediaFrame: number
  held: boolean
}

const validInt = (n: number) => Number.isSafeInteger(n) && n >= 0

/** A complete output-frame plan; no silent truncation, extrapolation or appending. */
export function validateTemplatePlayback(slot: TemplateSlotPlayback): void {
  if (!validInt(slot.outputFrames) || slot.outputFrames < 1 ||
      !validInt(slot.sourceInFrame) ||
      !validInt(slot.sourceDurationFrames) || slot.sourceDurationFrames < 1 ||
      !validInt(slot.headFrames ?? 0) || !validInt(slot.tailFrames ?? 0) ||
      !Array.isArray(slot.pieces) || !slot.pieces.length)
    throw new Error('template playback: invalid duration, handle or piece')
  let output = 0
  let source = slot.sourceInFrame
  if (source < (slot.headFrames ?? 0))
    throw new Error('template playback: missing head handle')
  for (const piece of slot.pieces) {
    if (!validInt(piece.frames) || piece.frames < 1)
      throw new Error('template playback: piece must contain full output frames')
    if (piece.kind === 'play') {
      if (!Number.isFinite(piece.rate) || piece.rate < 0.25 || piece.rate > 4)
        throw new Error('template playback: rate must be 0.25..4')
      // The last sampled frame, not the exclusive end of the next sample.
      const last = source + (piece.frames - 1) * piece.rate
      if (last >= slot.sourceDurationFrames)
        throw new Error('template playback: source too short')
      source += piece.frames * piece.rate
    } else if (piece.kind !== 'hold') {
      throw new Error('template playback: unsupported piece')
    }
    output += piece.frames
    if (output > slot.outputFrames) throw new Error('template playback: pieces exceed slot')
  }
  if (output !== slot.outputFrames) throw new Error('template playback: pieces must fill output')
  const finalSample = sampleTemplatePlaybackUnchecked(slot, output - 1).mediaFrame
  if (finalSample + (slot.tailFrames ?? 0) >= slot.sourceDurationFrames)
    throw new Error('template playback: missing tail handle')
}

/** Source frame to sample for an output-local frame, including a deliberate freeze. */
function sampleTemplatePlaybackUnchecked(slot: TemplateSlotPlayback, localFrame: number): TemplatePlaybackSample {
  let output = 0
  let source = slot.sourceInFrame
  let lastSample = source
  for (const piece of slot.pieces) {
    if (localFrame < output + piece.frames) {
      if (piece.kind === 'hold')
        return { outputLocalFrame: localFrame, mediaFrame: lastSample, held: true }
      return { outputLocalFrame: localFrame, mediaFrame: source + (localFrame - output) * piece.rate, held: false }
    }
    if (piece.kind === 'play') {
      lastSample = source + (piece.frames - 1) * piece.rate
      source += piece.frames * piece.rate
    }
    output += piece.frames
  }
  throw new RangeError('template playback: frame outside slot')
}

export function sampleTemplatePlayback(slot: TemplateSlotPlayback, localFrame: number): TemplatePlaybackSample {
  validateTemplatePlayback(slot)
  if (!validInt(localFrame) || localFrame >= slot.outputFrames)
    throw new RangeError('template playback: frame outside slot')
  return sampleTemplatePlaybackUnchecked(slot, localFrame)
}

/**
 * A centered cross-source transition does not consume the authored timeline.
 * Both A/B samples are returned in the same OUTPUT frame; caller blends them.
 * The caller must validate and render the actual cross-source frames, not a
 * post-composite insert, and must not duplicate source audio.
 */
export function sampleTemplateTransition(
  outgoing: TemplateSlotPlayback,
  incoming: TemplateSlotPlayback,
  incomingLocalFrame: number,
  durationFrames: number,
): { outgoingFrame: number; incomingFrame: number; mix: number } {
  validateTemplatePlayback(outgoing)
  validateTemplatePlayback(incoming)
  if (!validInt(durationFrames) || durationFrames < 2 ||
      !validInt(incomingLocalFrame) || incomingLocalFrame >= durationFrames)
    throw new RangeError('template transition: invalid window/frame')
  const left = Math.floor(durationFrames / 2)
  const right = durationFrames - left
  if (left > outgoing.outputFrames || right > incoming.outputFrames)
    throw new Error('template transition: window exceeds adjacent shots')
  // During the outgoing half, B needs a head handle; during incoming half, A needs a tail.
  // A handle's source sample uses the endpoint rate (hold = stationary).
  const outEnd = sampleTemplatePlaybackUnchecked(outgoing, outgoing.outputFrames - 1).mediaFrame
  const inStart = sampleTemplatePlaybackUnchecked(incoming, 0).mediaFrame
  const outLastRate = lastPlaybackRate(outgoing)
  const inFirstRate = firstPlaybackRate(incoming)
  const outFrame = incomingLocalFrame < left
    ? sampleTemplatePlaybackUnchecked(outgoing, outgoing.outputFrames - left + incomingLocalFrame).mediaFrame
    : outEnd + (incomingLocalFrame - left + 1) * outLastRate
  const inFrame = incomingLocalFrame < left
    ? inStart - (left - incomingLocalFrame) * inFirstRate
    : sampleTemplatePlaybackUnchecked(incoming, incomingLocalFrame - left).mediaFrame
  if (outFrame < 0 || outFrame >= outgoing.sourceDurationFrames ||
      inFrame < 0 || inFrame >= incoming.sourceDurationFrames)
    throw new Error('template transition: source handles unavailable')
  return { outgoingFrame: outFrame, incomingFrame: inFrame, mix: (incomingLocalFrame + 0.5) / durationFrames }
}

function firstPlaybackRate(slot: TemplateSlotPlayback): number {
  const first = slot.pieces[0]!
  return first.kind === 'play' ? first.rate : 0
}
function lastPlaybackRate(slot: TemplateSlotPlayback): number {
  const last = slot.pieces[slot.pieces.length - 1]!
  return last.kind === 'play' ? last.rate : 0
}
