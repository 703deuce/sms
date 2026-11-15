import { MS_TRACK_LABELS } from './config'
import type { MsProject, MsScene } from './types'

/**
 * Motion Studio lanes shown inside the Compact Editor and the workspace timeline.
 * Read model only: derived from the project's scenes/audio (master timeline, ST-TL-001).
 */
export type MsTrackItemTone = 'scene' | 'broll' | 'ai' | 'voice' | 'music' | 'caption'

export type MsTrackItem = {
  id: string
  sceneId: string | null
  startMs: number
  endMs: number
  label: string
  tone: MsTrackItemTone
  status: MsScene['status']
  /** Handoff sub-segments: approach / footage / return. */
  part?: 'approach' | 'footage' | 'return'
}

export type MsTrack = { id: 'scenes' | 'video' | 'graphics' | 'voice' | 'music'; label: string; items: MsTrackItem[] }

export function buildMotionTracks(project: Pick<MsProject, 'scenes' | 'audio' | 'durationMs' | 'settings' | 'assets'>): { tracks: MsTrack[]; durationMs: number } {
  const durationMs = project.durationMs || project.scenes.at(-1)?.endMs || project.settings.lengthMin * 60_000
  const scenes: MsTrackItem[] = project.scenes.map((s) => ({
    id: `scene:${s.id}`,
    sceneId: s.id,
    startMs: s.startMs,
    endMs: s.endMs,
    label: `${s.index + 1}. ${s.title}`,
    tone: 'scene',
    status: s.status,
  }))
  const video: MsTrackItem[] = []
  const graphics: MsTrackItem[] = []
  for (const s of project.scenes) {
    if (s.handoff) {
      const a = s.startMs
      const f = Math.min(s.endMs, a + s.handoff.approachMs)
      const r = Math.max(f, s.endMs - s.handoff.returnMs)
      const asset = project.assets.find((x) => x.id === s.handoff?.assetId)
      graphics.push({ id: `gfx:${s.id}:approach`, sceneId: s.id, startMs: a, endMs: f, label: 'Approach · camera enters photo', tone: 'ai', status: s.status, part: 'approach' })
      video.push({ id: `vid:${s.id}`, sceneId: s.id, startMs: f, endMs: r, label: asset ? `Insert · ${asset.label}` : 'Footage insert', tone: 'broll', status: s.status, part: 'footage' })
      graphics.push({ id: `gfx:${s.id}:return`, sceneId: s.id, startMs: r, endMs: s.endMs, label: s.handoff.exit === 'return' ? 'Return · camera resumes' : 'Cut', tone: 'ai', status: s.status, part: 'return' })
    } else {
      graphics.push({ id: `gfx:${s.id}`, sceneId: s.id, startMs: s.startMs, endMs: s.endMs, label: s.graphicName, tone: 'ai', status: s.status })
    }
  }
  const voice: MsTrackItem[] = project.scenes.length
    ? [{ id: 'voice:main', sceneId: null, startMs: 0, endMs: durationMs, label: project.audio.voice.label, tone: 'voice', status: project.audio.voice.status }]
    : []
  const music: MsTrackItem[] = project.scenes.length
    ? [{ id: 'music:main', sceneId: null, startMs: 0, endMs: durationMs, label: project.audio.music.label, tone: 'music', status: project.audio.music.status }]
    : []
  return {
    durationMs,
    tracks: [
      { id: 'scenes', label: MS_TRACK_LABELS.scenes, items: scenes },
      { id: 'video', label: MS_TRACK_LABELS.video, items: video },
      { id: 'graphics', label: MS_TRACK_LABELS.graphics, items: graphics },
      { id: 'voice', label: MS_TRACK_LABELS.voice, items: voice },
      { id: 'music', label: MS_TRACK_LABELS.music, items: music },
    ],
  }
}

export function sceneAt(scenes: MsScene[], ms: number): MsScene | null {
  return scenes.find((s) => ms >= s.startMs && ms < s.endMs) ?? scenes.at(-1) ?? null
}
