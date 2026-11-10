import type { AiCaptionsLine } from '@/lib/ai-captions/types'

const clock = (ms: number): string => {
  const n = Math.max(0, Math.round(ms))
  const hh = Math.floor(n / 3600000)
  const mm = Math.floor((n % 3600000) / 60000)
  const ss = Math.floor((n % 60000) / 1000)
  const milli = n % 1000
  return [hh, mm, ss].map((value) => String(value).padStart(2, '0')).join(':') + '.' + String(milli).padStart(3, '0')
}

/** WebVTT is based on the same reviewed caption lines as SRT and the editor. */
export function vttFromLines(lines: AiCaptionsLine[]): string {
  console.info('[ai-captions:vtt] serialize_begin', { cues: lines.length })
  const cues = lines.filter((line) => line.endMs > line.startMs)
    .map((line) => `${clock(line.startMs)} --> ${clock(line.endMs)}\n${line.text.replace(/-->/g, '→')}`)
  console.info('[ai-captions:vtt] serialize_complete', { cues: cues.length })
  return `WEBVTT\n\n${cues.join('\n\n')}\n`
}
