/**
 * Batch 5 standalone, deterministic music timing policy.
 * This module is deliberately independent of Compact/Timeline and the B3 compiler.
 * No network access, beat redetection, or hidden music substitution on reload.
 */
import type { BeatGrid } from '@/lib/clips/editor/beats'

export type AudioLicenseRecord = {
  assetId: string
  origin: string
  author: string
  license: string
  revision: string
  sha256: string
  commercialUse: boolean
  exportAllowed: boolean
  redistributionAllowed: boolean
  attribution?: string
  verifiedDurationFrames: number
  verifiedAt: string
}

export type AuthoredMusicScheduleV1 = {
  v: 1
  mode: 'fixed-time' | 'beat-time'
  musicAssetId: string
  sha256: string
  bpm: number | null
  offsetFrames: number
  durationFrames: number
  /** Sorted absolute source-music frames, not recomputed at reload. */
  beats: number[]
  /** Phrase starts, including any lyric or spoken-word cues. */
  phrases: Array<{ id: string; frame: number; kind: 'instrumental' | 'lyric' | 'narration' }>
  protectedAnchors: Array<{ id: string; frame: number; approved: true }>
  manualOverrides?: Array<{ id: string; frame: number; approved: true }>
}

export type TemplateTimingV1 = {
  v: 1
  fps: 30
  totalFrames: number
  boundaries: number[]
  /** [start, end) windows; each attached to the output clock. */
  windows: Array<{ id: string; startFrame: number; endFrame: number; kind: 'text' | 'motion' | 'fx' | 'transition' | 'audio-fade' }>
  minShotFrames: number
  minTextFrames: number
}

export type ResyncPreview = {
  original: TemplateTimingV1
  proposed: TemplateTimingV1
  oldDurationFrames: number
  newDurationFrames: number
  movedBoundaries: number
  warnings: string[]
  /** The caller must explicitly accept this immutable proposal as one undoable change. */
  requiresAcceptance: true
}
const HASH = /^[a-f0-9]{64}$/i
const validFrame = (n: number) => Number.isInteger(n) && n >= 0

export function assertAudioLicense(record: AudioLicenseRecord, forTemplateExport = true): void {
  if (!record || !record.assetId || !record.origin || !record.author || !record.license ||
      !record.revision || !HASH.test(record.sha256) || !record.verifiedAt ||
      !validFrame(record.verifiedDurationFrames) || record.verifiedDurationFrames === 0)
    throw new Error('Music unavailable: asset provenance, SHA-256 or verified duration is missing')
  if (!record.commercialUse || (forTemplateExport && !record.exportAllowed))
    throw new Error('Music rights do not permit commercial template export')
  if (/^(user-upload|user-owned)$/i.test(record.license) && !record.revision.startsWith('ack:'))
    throw new Error('User music rights acknowledgment is required')
}

/** The returned schedule is immutable data authored once from a decoded/local analysis result. */
export function pinMusicSchedule(input: {
  assetId: string
  license: AudioLicenseRecord
  grid: BeatGrid
  mode: AuthoredMusicScheduleV1['mode']
  offsetFrames?: number
  phrases?: AuthoredMusicScheduleV1['phrases']
  protectedAnchors?: AuthoredMusicScheduleV1['protectedAnchors']
}): AuthoredMusicScheduleV1 {
  assertAudioLicense(input.license)
  if (input.assetId !== input.license.assetId) throw new Error('Music asset identity mismatch')
  const duration = input.license.verifiedDurationFrames
  const offset = input.offsetFrames ?? 0
  if (!Number.isInteger(offset) || Math.abs(offset) >= duration) throw new Error('Invalid music offset')
  const beats = [...new Set(input.grid.beatsMs.map(ms => Math.round(ms * 30 / 1000)))]
    .filter(frame => validFrame(frame) && frame < duration).sort((a,b) => a-b)
  if (input.mode === 'beat-time' && (!beats.length || !(input.grid.bpm > 0)))
    throw new Error('No confident beat grid: use fixed-time timing or another song')
  const phrases = input.phrases ?? []
  const anchors = input.protectedAnchors ?? []
  for (const p of phrases) if (!p.id || !validFrame(p.frame) || p.frame >= duration) throw new Error('Invalid phrase cue')
  for (const a of anchors) if (!a.approved || !a.id || !validFrame(a.frame) || a.frame >= duration)
    throw new Error('Protected anchor requires manual approval')
  return {
    v: 1, mode: input.mode, musicAssetId: input.assetId, sha256: input.license.sha256,
    bpm: input.grid.bpm > 0 ? input.grid.bpm : null, offsetFrames: offset,
    durationFrames: duration, beats, phrases: structuredClone(phrases),
    protectedAnchors: structuredClone(anchors),
  }
}

function validateTiming(t: TemplateTimingV1) {
  if (t.v !== 1 || t.fps !== 30 || !validFrame(t.totalFrames) || t.totalFrames < 1 ||
      !validFrame(t.minShotFrames) || t.minShotFrames < 3 ||
      !validFrame(t.minTextFrames) || t.minTextFrames < 9 ||
      t.boundaries.length < 2 || t.boundaries[0] !== 0 ||
      t.boundaries[t.boundaries.length - 1] !== t.totalFrames)
    throw new Error('Invalid authored template timing')
  for (let i=1; i<t.boundaries.length; i++) {
    if (!validFrame(t.boundaries[i]!) || t.boundaries[i]! - t.boundaries[i-1]! < t.minShotFrames)
      throw new Error('Authored shots are overlapping or too short')
  }
  for (const w of t.windows)
    if (!w.id || !validFrame(w.startFrame) || !validFrame(w.endFrame) ||
        w.endFrame <= w.startFrame || w.endFrame > t.totalFrames ||
        (w.kind === 'text' && w.endFrame-w.startFrame < t.minTextFrames))
      throw new Error('Invalid authored timing window')
}

/** Frame quantization is cumulative: endpoints are rounded, never 30 independent durations. */
export function distributeFrameBoundaries(weights: readonly number[], total: number, minimum: number): number[] {
  if (!validFrame(total) || !Number.isInteger(minimum) || minimum < 1 ||
      !weights.length || weights.some(w => !Number.isFinite(w) || w <= 0) ||
      total < minimum * weights.length)
    throw new Error('Impossible beat quantization: song too short for shot minimums')
  const flexible = total - weights.length * minimum
  const sum = weights.reduce((a,b) => a+b, 0)
  const out = [0]
  let cumulative = 0
  for (let i=0; i<weights.length; i++) {
    cumulative += weights[i]!
    out.push(minimum * (i+1) + Math.round(flexible * cumulative / sum))
  }
  out[out.length - 1] = total
  return out
}

function verifiedSchedule(s: AuthoredMusicScheduleV1, license: AudioLicenseRecord) {
  assertAudioLicense(license)
  if (s.v !== 1 || s.musicAssetId !== license.assetId || s.sha256 !== license.sha256 ||
      s.durationFrames !== license.verifiedDurationFrames ||
      !Number.isInteger(s.offsetFrames))
    throw new Error('Music was modified: re-analyze and explicitly approve the new asset')
  for (let i=0; i<s.beats.length; i++)
    if (!validFrame(s.beats[i]!) || s.beats[i]! >= s.durationFrames ||
        (i && s.beats[i]! <= s.beats[i-1]!))
      throw new Error('Invalid pinned music beat schedule')
  for (const a of [...s.protectedAnchors, ...(s.manualOverrides ?? [])])
    if (!a.approved || !a.id || !validFrame(a.frame) || a.frame >= s.durationFrames)
      throw new Error('Unapproved or invalid manual anchor')
}

/**
 * Preview-only: keep-timing is the default, and resync never mutates inputs.
 * Nonlinear time warp is piecewise-linear across the old and new *approved* cut anchors.
 * For lyric/narration templates every semantic phrase must have an explicit matching cue.
 */
export function previewMusicReplacement(input: {
  timing: TemplateTimingV1
  previous: AuthoredMusicScheduleV1
  replacement: AuthoredMusicScheduleV1
  license: AudioLicenseRecord
  choice?: 'keep-timing' | 're-sync'
  allowLoop?: boolean
}): ResyncPreview {
  const { timing, previous, replacement } = input
  validateTiming(timing)
  verifiedSchedule(replacement, input.license)
  if (input.choice !== 're-sync') {
    return { original: structuredClone(timing), proposed: structuredClone(timing),
      oldDurationFrames: timing.totalFrames, newDurationFrames: timing.totalFrames,
      movedBoundaries: 0, warnings: [], requiresAcceptance: true }
  }
  if (previous.v !== 1 || !previous.durationFrames) throw new Error('Missing previous music schedule')
  if (replacement.mode !== 'beat-time' || previous.mode !== 'beat-time' ||
      !replacement.beats.length || !previous.beats.length ||
      !(replacement.bpm && previous.bpm))
    throw new Error('Re-sync requires two pinned beat-time schedules')
  const ratio = previous.bpm / replacement.bpm
  if (ratio < 0.5 || ratio > 2) throw new Error('Tempo difference outside safe re-sync limits')
  const total = Math.round(timing.totalFrames * ratio)
  if (total > replacement.durationFrames && !input.allowLoop)
    throw new Error('Music too short: looping/crossfade requires explicit acceptance')
  if (total < timing.minShotFrames * (timing.boundaries.length-1))
    throw new Error('Music tempo makes minimum shot lengths impossible')
  const oldCues = previous.phrases.filter(p => p.kind !== 'instrumental')
  for (const cue of oldCues)
    if (!replacement.phrases.some(p => p.id === cue.id && p.kind === cue.kind))
      throw new Error('Re-sync needs an explicit matching lyric/narration cue: ' + cue.id)
  for (const anchor of previous.protectedAnchors) {
    const replacementAnchor = [...replacement.protectedAnchors, ...(replacement.manualOverrides ?? [])]
      .find(a => a.id === anchor.id)
    if (!replacementAnchor) throw new Error('Protected anchor needs an approved replacement: ' + anchor.id)
  }
  // Cut weights preserve each shot's relative authored rhythm while distributing integer frames.
  const weights = timing.boundaries.slice(1).map((b,i) => b-timing.boundaries[i]!)
  const bounds = distributeFrameBoundaries(weights, total, timing.minShotFrames)
  // Original hard-protected cut anchors must map to manually approved target positions.
  for (const a of previous.protectedAnchors) {
    const oldCut = timing.boundaries.indexOf(a.frame)
    if (oldCut >= 0) {
      const target = [...replacement.protectedAnchors, ...(replacement.manualOverrides ?? [])].find(x=>x.id===a.id)!
      if (bounds[oldCut] !== target.frame)
        throw new Error('Protected anchor conflicts with re-sync; manual edit required: ' + a.id)
    }
  }
  const map = (f:number) => {
    if (f === timing.totalFrames) return total
    let i=1
    while (i < timing.boundaries.length && f >= timing.boundaries[i]!) i++
    const a=timing.boundaries[i-1]!, b=timing.boundaries[i]!
    return bounds[i-1]! + Math.round((f-a)*(bounds[i]!-bounds[i-1]!)/(b-a))
  }
  const windows = timing.windows.map(w => ({...w,startFrame:map(w.startFrame),endFrame:map(w.endFrame)}))
  for (const w of windows)
    if (w.endFrame <= w.startFrame || (w.kind === 'text' && w.endFrame-w.startFrame < timing.minTextFrames))
      throw new Error('Re-sync would make a text or FX window unreadable')
  const proposed = { ...structuredClone(timing), totalFrames: total, boundaries: bounds, windows }
  validateTiming(proposed)
  return {
    original: structuredClone(timing), proposed, oldDurationFrames: timing.totalFrames,
    newDurationFrames: total, movedBoundaries: bounds.filter((b,i)=>b !== timing.boundaries[i]).length,
    warnings: total > replacement.durationFrames ? ['Explicit music loop/crossfade required'] : [],
    requiresAcceptance: true,
  }
}

/** One immutable undo record; cancel simply discards the preview. */
export function acceptMusicResync(preview: ResyncPreview): { before: TemplateTimingV1; after: TemplateTimingV1 } {
  validateTiming(preview.proposed)
  return { before: structuredClone(preview.original), after: structuredClone(preview.proposed) }
}
