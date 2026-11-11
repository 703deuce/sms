/**
 * Batch 5: standalone template music decisions -> the existing ClipEditsV2
 * preview/export representation. This module never modifies an editor timeline.
 */
import type { ClipEditsV2 } from '@/lib/clips/edits'
import {
  compileTemplate, templateFrameToMs, validateTemplateFamily,
  type TemplateFamilyV1, type TemplateDesignV1, type TemplateChoices,
  type TemplateCompileResult,
} from './sequence-contract'
import {
  assertAudioLicense, previewMusicReplacement,
  type AudioLicenseRecord, type AuthoredMusicScheduleV1,
  type ResyncPreview, type TemplateTimingV1,
} from './music-timing'

export type TemplateMusicDecisionV1 = {
  v: 1
  /** Pinned to source bytes at authoring time, and re-verified by the publisher. */
  rights: AudioLicenseRecord
  schedule: AuthoredMusicScheduleV1
  /** Defaults to keep original edit timing. */
  choice?: 'keep-timing' | 're-sync'
  originalSchedule?: AuthoredMusicScheduleV1
  /** An explicit user action; false by default. */
  acceptLoop?: boolean
  /** Optional manual fade lengths; clamped only by validation, not silently on export. */
  fadeInFrames?: number
  fadeOutFrames?: number
}
export type TemplateChoicesWithMusic = TemplateChoices & { templateMusic?: TemplateMusicDecisionV1 }

function frame(n: number, what: string) {
  if (!Number.isInteger(n) || n < 0) throw new Error(what + ': expected nonnegative integer output frame')
}
function toTiming(f: TemplateFamilyV1, decision: TemplateMusicDecisionV1): TemplateTimingV1 {
  const boundaries = [0, ...f.slots.map(s => s.startFrame + s.durationFrames)]
  const windows: TemplateTimingV1['windows'] = [
    ...f.texts.map(t => ({ id: 'text:' + t.id, kind: 'text' as const,
      startFrame: t.startFrame, endFrame: t.startFrame + t.durationFrames })),
    ...(f.graphics ?? []).map(g => ({ id: 'graphic:' + g.id, kind: 'fx' as const,
      startFrame: g.startFrame, endFrame: g.startFrame + g.durationFrames })),
  ]
  const fadeIn = decision.fadeInFrames ?? Math.min(15, Math.floor(f.totalFrames / 3))
  const fadeOut = decision.fadeOutFrames ?? Math.min(30, f.totalFrames - fadeIn)
  frame(fadeIn, 'fadeInFrames')
  frame(fadeOut, 'fadeOutFrames')
  if (fadeIn > 300 || fadeOut > 300 || fadeIn + fadeOut > f.totalFrames)
    throw new Error('Music fades exceed authored template duration')
  if (fadeIn) windows.push({ id: 'music-fade-in', kind: 'audio-fade', startFrame: 0, endFrame: fadeIn })
  if (fadeOut) windows.push({ id: 'music-fade-out', kind: 'audio-fade',
    startFrame: f.totalFrames - fadeOut, endFrame: f.totalFrames })
  return { v: 1, fps: 30, totalFrames: f.totalFrames, boundaries, windows,
    minShotFrames: 9, minTextFrames: 9 }
}

/** Immutable plan, reused by the template's own preview and project render. */
export function planTemplateMusic(
  rawFamily: TemplateFamilyV1,
  decision: TemplateMusicDecisionV1,
  userTexts?: Record<string, string>,
): {
  family: TemplateFamilyV1
  durationFrames: number
  preview: ResyncPreview
  music: { loop: boolean; fadeInMs: number; fadeOutMs: number }
} {
  const family = validateTemplateFamily(rawFamily)
  if (decision.v !== 1) throw new Error('Unsupported template music decision')
  assertAudioLicense(decision.rights)
  const { schedule, rights } = decision
  if (schedule.v !== 1 || schedule.sha256 !== rights.sha256 ||
      schedule.musicAssetId !== rights.assetId ||
      schedule.durationFrames !== rights.verifiedDurationFrames)
    throw new Error('Music source hash/duration does not match its pinned beat schedule')
  if (family.beatAnchors.length && schedule.mode !== 'beat-time')
    throw new Error('Beat-driven template requires pinned beat-time audio')
  const timing = toTiming(family, decision)
  const chosen = decision.choice ?? 'keep-timing'
  if (chosen !== 'keep-timing' && chosen !== 're-sync') throw new Error('Unknown music timing choice')
  if (chosen === 're-sync' && !decision.originalSchedule)
    throw new Error('Re-sync needs the original authored schedule')
  const preview = previewMusicReplacement({
    timing, previous: decision.originalSchedule ?? schedule,
    replacement: schedule, license: rights, choice: chosen,
    allowLoop: decision.acceptLoop === true,
  })
  const loop = decision.acceptLoop === true
  if (preview.newDurationFrames > schedule.durationFrames && !loop)
    throw new Error('Selected music is too short. Explicitly accept loop or select a longer song')
  // Do not silently bake music, reword text or flatten the B3 sequence.
  const moved = preview.proposed
  const bounds = moved.boundaries
  const map = (f: number) => {
    if (f === timing.totalFrames) return moved.totalFrames
    let i = 1
    while (i < timing.boundaries.length && f >= timing.boundaries[i]!) i++
    const oldA = timing.boundaries[i-1]!, oldB = timing.boundaries[i]!
    return bounds[i-1]! + Math.round((f - oldA) * (bounds[i]! - bounds[i-1]!) / (oldB - oldA))
  }
  const updated: TemplateFamilyV1 = structuredClone(family)
  updated.totalFrames = moved.totalFrames
  updated.slots = family.slots.map((slot, i) => {
    const durationFrames = bounds[i+1]! - bounds[i]!
    const previousFrames = timing.boundaries[i+1]! - timing.boundaries[i]!
    let transition = slot.transition
    if (transition !== 'cut') {
      const frames = Math.round(transition.durationFrames * durationFrames / previousFrames)
      if (frames < 3 || frames > 60)
        throw new Error('Re-sync transition needs a manually adjusted duration/handles')
      transition = { ...transition, durationFrames: frames }
    }
    return { ...slot, startFrame: bounds[i]!, durationFrames, transition }
  })
  updated.texts = family.texts.map(t => ({ ...t, startFrame: map(t.startFrame),
    durationFrames: map(t.startFrame+t.durationFrames)-map(t.startFrame) }))
  updated.graphics = family.graphics?.map(g => ({ ...g, startFrame: map(g.startFrame),
    durationFrames: map(g.startFrame+g.durationFrames)-map(g.startFrame) }))
  updated.beatAnchors = family.beatAnchors.map(map)
  updated.phraseAnchors = family.phraseAnchors?.map(a => ({ ...a, frame: map(a.frame) }))
  // Structural validator rejects impossible transition handles, overlapping FX,
  // unreadable text, zero-length shots and unsupported source speeds.
  const checked = validateTemplateFamily(updated)
  // Respect user-written words: re-sync must reject unreadable durations, never
  // shorten, paraphrase or silently omit a title to fit the new soundtrack.
  for (const title of checked.texts) {
    const written = userTexts?.[title.id] ?? title.defaultText
    if (typeof written !== 'string' || !written.trim() || Array.from(written).length > title.maxChars)
      throw new Error('Text ' + title.id + ' exceeds its authored length limit')
    const readingFrames = Math.max(9, Math.ceil(Array.from(written).length / 15 * 30))
    if (title.durationFrames < readingFrames)
      throw new Error('Text ' + title.id + ' needs at least ' + readingFrames + ' frames to remain readable')
  }
  const inWindow = moved.windows.find(w => w.id === 'music-fade-in')
  const outWindow = moved.windows.find(w => w.id === 'music-fade-out')
  return { family: checked, durationFrames: checked.totalFrames, preview,
    music: { loop, fadeInMs: templateFrameToMs(inWindow ? inWindow.endFrame : 0),
      fadeOutMs: templateFrameToMs(outWindow ? moved.totalFrames - outWindow.startFrame : 0) } }
}

/**
 * B3 compiler is the sole source for the template's preview/worker edits.
 * Existing legacy ClipEditsV2 video and MP3 export semantics remain untouched.
 */
export function compileTemplateWithMusic(
  family: TemplateFamilyV1, design: TemplateDesignV1,
  choices: TemplateChoicesWithMusic, carrier: { durationFrames: number; edits: ClipEditsV2 },
): TemplateCompileResult & { musicPreview?: ResyncPreview } {
  if (choices.music && !choices.templateMusic)
    throw new Error('Music rights and a pinned schedule are required before template export')
  if (!choices.music && choices.templateMusic)
    throw new Error('Cannot schedule missing music')
  const plan = choices.templateMusic ? planTemplateMusic(family, choices.templateMusic, choices.texts) : null
  if (plan && choices.music?.id !== choices.templateMusic?.rights.assetId)
    throw new Error('Selected music upload differs from approved music bytes')
  const actualFamily = plan?.family ?? family
  if (carrier.durationFrames !== actualFamily.totalFrames)
    throw new Error('Template music preview/export carrier has incorrect frame count')
  const result = compileTemplate(actualFamily, design, choices, carrier)
  if (choices.music && result.edits.audio?.music && plan) {
    result.edits.audio.music = {
      ...result.edits.audio.music, loop: plan.music.loop,
      fadeInMs: plan.music.fadeInMs, fadeOutMs: plan.music.fadeOutMs,
      volume: 0.35,
      duckDepth: actualFamily.slots.some(s => s.sourceAudio === 'source') ? 0.65 : 0.55,
    }
  }
  return { ...result, ...(plan ? { musicPreview: plan.preview } : {}) }
}
