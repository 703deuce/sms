import type { T2vSettingFit, T2vShotSetting } from '@/lib/t2v/pipeline/t2v-types'

/**
 * Implied setting per shot (Prompt-to-Video only). The script-context pass reads the video's topic and the lines
 * around each line and writes the time of day, indoor/outdoor, kind of place and mood that moment implies. The
 * searches, the visual checker, every text re-check (spare, cross-line, hold, last resort) and the AI B-roll
 * prompts all get it. The fit call is the model's (no word lists); code only applies the cap below.
 */

/** A clip whose visible setting contradicts the moment's implied setting can never reach the 5/10 filler floor. */
export const SETTING_CAP = 4

const TIMES = ['day', 'night', 'morning', 'evening', 'any'] as const
const PLACES = ['indoor', 'outdoor', 'any'] as const

const clean = (v: unknown, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n)

function oneOf<T extends string>(v: unknown, allowed: readonly T[]): T {
  const w = String(v ?? '').toLowerCase().replace(/[^a-z]+/g, ' ').trim()
  if (/\b(indoors?|inside|interior)\b/.test(w) && (allowed as readonly string[]).includes('indoor')) return 'indoor' as T
  if (/\b(outdoors?|outside|exterior)\b/.test(w) && (allowed as readonly string[]).includes('outdoor')) return 'outdoor' as T
  if (/\b(dusk|evening|sunset|bedtime)\b/.test(w) && (allowed as readonly string[]).includes('evening')) return 'evening' as T
  if (/\b(dawn|sunrise|morning)\b/.test(w) && (allowed as readonly string[]).includes('morning')) return 'morning' as T
  const first = w.split(' ')[0] as T
  return allowed.includes(first) ? first : ('any' as T)
}

/** The model's setting object, cleaned; undefined when it says nothing at all. */
export function parseSetting(raw: unknown): T2vShotSetting | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const s: T2vShotSetting = {
    timeOfDay: oneOf(r.timeOfDay ?? r.time_of_day ?? r.time, TIMES),
    place: oneOf(r.place ?? r.indoorOutdoor ?? r.indoor_outdoor, PLACES),
    where: clean(r.where ?? r.location, 60),
    mood: clean(r.mood, 60),
  }
  if (s.timeOfDay === 'any' && s.place === 'any' && !s.where && !s.mood) return undefined
  return s
}

/** One line for prompts: "time of day: night; place: indoor (bedroom); mood: calm, quiet". '' when unknown. */
export function settingText(s: T2vShotSetting | undefined): string {
  if (!s) return ''
  const parts: string[] = []
  if (s.timeOfDay && s.timeOfDay !== 'any') parts.push(`time of day: ${s.timeOfDay}`)
  if ((s.place && s.place !== 'any') || s.where) {
    const place = s.place && s.place !== 'any' ? s.place : ''
    parts.push(`place: ${[place, s.where ? (place ? `(${s.where})` : s.where) : ''].filter(Boolean).join(' ')}`)
  }
  if (s.mood) parts.push(`mood: ${s.mood}`)
  return parts.join('; ')
}

/** fits / neutral / contradicts. Anything else (or missing) is neutral: the depicts call still gates the clip. */
export function normSettingFit(v: unknown): T2vSettingFit {
  const w = String(v ?? '').toLowerCase().replace(/[^a-z]+/g, ' ').trim().split(' ')[0]
  if (w === 'contradicts' || w === 'contradict' || w === 'conflicts' || w === 'wrong' || w === 'no') return 'contradicts'
  if (w === 'fits' || w === 'fit' || w === 'yes' || w === 'matches') return 'fits'
  return 'neutral'
}

/** The score after the setting cap (same number as the worker's verify_stock.SETTING_CAP). */
export function capBySetting(score: number, fit: T2vSettingFit | undefined): number {
  return fit === 'contradicts' ? Math.min(score, SETTING_CAP) : score
}
