import type { ScriptDocumentV1 } from '@/lib/clips/script-edl/types'

function formatYoutubeChapterTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

export function chapterMarkers(document: ScriptDocumentV1) {
  return (document.markers ?? []).filter((m) => m.exportAsChapter !== false)
}

export function youtubeChaptersText(document: ScriptDocumentV1, title?: string): string {
  const lines: string[] = []
  if (title) lines.push(title, '')
  const markers = chapterMarkers(document)
  for (const m of markers) {
    const label = (m.label ?? 'Chapter').trim()
    lines.push(`${formatYoutubeChapterTime(m.outMs)} ${label}`)
  }
  return lines.join('\n')
}

export function descriptionWithChapters(document: ScriptDocumentV1, baseDescription: string): string {
  const chapters = youtubeChaptersText(document)
  if (!chapters.trim()) return baseDescription
  const sep = baseDescription.trim() ? '\n\n' : ''
  return `${baseDescription.trim()}${sep}Chapters:\n${chapters}`
}

export function markersForSrtNote(document: ScriptDocumentV1): string {
  const markers = chapterMarkers(document)
  if (!markers.length) return ''
  return markers.map((m) => `[${formatYoutubeChapterTime(m.outMs)}] ${m.label ?? 'Chapter'}`).join('\n')
}
