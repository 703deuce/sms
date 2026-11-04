import type { ClipEditsV2 } from '@/lib/clips/edits'

const ORDER: (keyof ClipEditsV2)[] = [
  'cutRanges',
  'trim',
  'captions',
  'captionLines',
  'textItems',
  'layout',
  'audio',
  'broll',
  'color',
  'wordFixes',
]

function jsonKey(edits: ClipEditsV2, key: keyof ClipEditsV2): string {
  return JSON.stringify(edits[key] ?? null)
}

/** New AI TTS / voiceover cue (upload on a Voiceover track). */
function aiVoiceoverPlaced(prev: ClipEditsV2, next: ClipEditsV2): boolean {
  const pa = prev.audio?.sfx ?? []
  const na = next.audio?.sfx ?? []
  if (na.length !== pa.length + 1) return false
  const prevIds = new Set(pa.map((s) => s.generationId))
  const added = na.filter((s) => !prevIds.has(s.generationId))
  if (added.length !== 1) return false
  const c = added[0]!
  return Boolean(c.uploadId) && c.kind === 'audio' && (c.volume ?? 1) === 1 && (c.durMs ?? 0) >= 100
}

/** Human label for one undo step from `prev` → `next`; never infer an asset title from its ID. */
export function describeEditsChange(prev: ClipEditsV2, next: ClipEditsV2): string {
  const short = (value: string): string => value.length > 38 ? value.slice(0, 35) + '…' : value
  const quoted = (value: string): string => `“${short(value.trim() || 'Untitled')}”`
  const seconds = (ms: number): string => `${(ms / 1000).toFixed(2).replace(/\.?0+$/, '')}s`
  const beforeCuts = prev.cutRanges ?? []
  const afterCuts = next.cutRanges ?? []
  if (jsonKey(prev, 'cutRanges') !== jsonKey(next, 'cutRanges')) {
    if (afterCuts.length > beforeCuts.length) {
      const added = afterCuts.find(c => !beforeCuts.some(p => JSON.stringify(p) === JSON.stringify(c)))
      if (Array.isArray(added)) return `Deleted segment ${seconds(added[0])}–${seconds(added[1])}`
      return 'Deleted a video segment'
    }
    return afterCuts.length < beforeCuts.length ? 'Restored a deleted segment' : 'Adjusted transcript cuts'
  }

  if (jsonKey(prev, 'trim') !== jsonKey(next, 'trim')) {
    const start = prev.trim.in !== next.trim.in
    const end = prev.trim.out !== next.trim.out
    return `Trimmed Video ${start && end ? 'in/out' : start ? 'start' : 'end'} to ${seconds(start ? next.trim.in : next.trim.out)}`
  }

  if (jsonKey(prev, 'wordFixes') !== jsonKey(next, 'wordFixes')) return 'Corrected transcript wording'

  if (jsonKey(prev, 'keyframes') !== jsonKey(next, 'keyframes')) {
    const tracks = next.keyframes ?? []
    const oldTracks = prev.keyframes ?? []
    const rotation = tracks.find(t => t.prop === 'rotation' && JSON.stringify(t) !== JSON.stringify(oldTracks.find(p => p.target === t.target && p.prop === 'rotation')))
    if (rotation) {
      const degree = rotation.points.at(-1)?.v ?? rotation.value ?? 0
      return `Rotation ${degree}° · ${rotation.target === 'video' ? 'Video' : rotation.target}`
    }
    const changed = tracks.find(t => JSON.stringify(t) !== JSON.stringify(oldTracks.find(p => p.target === t.target && p.prop === t.prop)))
    return changed ? `Adjusted ${changed.prop} · ${changed.target}` : 'Removed keyframe'
  }

  if (jsonKey(prev, 'captions') !== jsonKey(next, 'captions') || jsonKey(prev, 'captionLines') !== jsonKey(next, 'captionLines')) {
    if (prev.captions.size !== next.captions.size) return `Caption size ${next.captions.size}`
    if (jsonKey(prev, 'captionLines') !== jsonKey(next, 'captionLines')) return 'Edited caption text/timing'
    return 'Changed caption style'
  }

  if (jsonKey(prev, 'textItems') !== jsonKey(next, 'textItems')) {
    const before = prev.textItems ?? []
    const after = next.textItems ?? []
    const removed = before.find(t => !after.some(n => n.id === t.id))
    if (removed) return `Deleted text ${quoted(removed.text)}`
    const added = after.find(t => !before.some(p => p.id === t.id))
    if (added) return `Added text ${quoted(added.text)}`
    const changed = after.find(t => JSON.stringify(t) !== JSON.stringify(before.find(p => p.id === t.id)))
    if (changed) {
      const old = before.find(p => p.id === changed.id)
      if (old?.text !== changed.text) return `Edited text ${quoted(changed.text)}`
      if (old?.startMs !== changed.startMs || old?.endMs !== changed.endMs) return `Moved/trimmed text ${quoted(changed.text)}`
      return `Styled text ${quoted(changed.text)}`
    }
  }

  if (jsonKey(prev, 'audio') !== jsonKey(next, 'audio')) {
    if (aiVoiceoverPlaced(prev, next)) return 'Added AI voiceover'
    const pa = prev.audio?.sfx ?? []
    const na = next.audio?.sfx ?? []
    const removed = pa.find(s => !na.some(t => t.generationId === s.generationId))
    if (removed) return `Removed SFX ${short(removed.generationId)}`
    const added = na.find(s => !pa.some(t => t.generationId === s.generationId))
    if (added) return `Added SFX ${short(added.generationId)}`
    const changed = na.find(s => JSON.stringify(s) !== JSON.stringify(pa.find(p => p.generationId === s.generationId)))
    if (changed) return `Adjusted SFX ${short(changed.generationId)}`
    if (jsonKey(prev, 'audio') !== jsonKey(next, 'audio') && prev.audio?.musicVolume !== next.audio?.musicVolume)
      return `Music volume ${Math.round((next.audio?.musicVolume ?? 1) * 100)}%`
    if (JSON.stringify(prev.audio?.music) !== JSON.stringify(next.audio?.music))
      return prev.audio?.music && !next.audio?.music ? 'Removed music' : !prev.audio?.music && next.audio?.music ? 'Added music' : 'Adjusted music'
    return 'Adjusted audio mix'
  }

  if (jsonKey(prev, 'broll') !== jsonKey(next, 'broll')) {
    const pa = prev.broll ?? []
    const na = next.broll ?? []
    if (na.length > pa.length) return 'Added B-roll clip'
    if (na.length < pa.length) return 'Deleted B-roll clip'
    return 'Moved/trimmed B-roll clip'
  }

  if (jsonKey(prev, 'layout') !== jsonKey(next, 'layout')) return `Changed layout to ${next.layout.mode}`
  if (jsonKey(prev, 'color') !== jsonKey(next, 'color')) return 'Adjusted color'
  if (jsonKey(prev, 'sectionOrder') !== jsonKey(next, 'sectionOrder')) return 'Reordered Video clips'
  if (jsonKey(prev, 'inserts') !== jsonKey(next, 'inserts')) return 'Changed timeline gap/insert'
  if (jsonKey(prev, 'videoSplits') !== jsonKey(next, 'videoSplits')) return 'Split Video clip'
  for (const key of ORDER) {
    if (jsonKey(prev, key) !== jsonKey(next, key)) return `Edited ${String(key)}`
  }
  return 'Updated clip settings'
}

export function cleanupPassLabel(kind: string, count: number): string {
  const names: Record<string, string> = {
    filler: 'Remove fillers',
    repeat: 'Remove repeats',
    gap: 'Shorten gaps',
    retake: 'Remove retakes',
    clarity: 'Edit for clarity',
    beat: 'Cut to beat',
    broll: 'Auto B-roll',
    translate: 'Translate captions',
    multicam: 'Auto camera cuts',
  }
  const head = names[kind] ?? 'Cleanup'
  return `${head} · ${count} cut${count === 1 ? '' : 's'}`
}

export function cleanupRestorePassLabel(kind: string, count: number): string {
  const names: Record<string, string> = {
    filler: 'Restore fillers',
    repeat: 'Restore repeats',
    gap: 'Restore gaps',
    retake: 'Restore retakes',
    clarity: 'Restore clarity',
  }
  const head = names[kind] ?? 'Restore'
  return `${head} · ${count} cut${count === 1 ? '' : 's'}`
}

export function singleCleanupApplyLabel(proposal: { kind: string }): string {
  switch (proposal.kind) {
    case 'retake':
      return 'Remove retake'
    case 'repeat':
      return 'Remove repeat'
    case 'filler':
      return 'Remove filler'
    case 'gap':
      return 'Shorten gap'
    case 'clarity':
      return 'Edit for clarity'
    default:
      return 'Cut'
  }
}
