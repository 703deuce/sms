import prompts from '@/lib/clips/music-library-prompts.json'

export type StockAudioEntry = {
  id: string
  kind: 'music' | 'sfx'
  title: string
  source: 'transovo-music' | 'kenney-sfx'
  license: 'elevenlabs' | 'cc0'
  durationS: number
  tags: string[]
  mood?: string
  genre?: string
  bpm?: number
  storageKey?: string
  /** Public path under /stock-audio/ for Kenney files. */
  src?: string
}

const KENNEY_FILES: { file: string; title: string; tags: string[]; durationS: number }[] = [
  { file: 'whoosh.wav', title: 'Whoosh', tags: ['whoosh', 'transition', 'swipe'], durationS: 1 },
  { file: 'pop.wav', title: 'Pop', tags: ['pop', 'ui', 'click'], durationS: 1 },
  { file: 'ding.wav', title: 'Ding', tags: ['ding', 'notify', 'success'], durationS: 1 },
  { file: 'boom.wav', title: 'Boom', tags: ['boom', 'impact', 'hit'], durationS: 1 },
  { file: 'record-scratch.wav', title: 'Record scratch', tags: ['scratch', 'stinger', 'dj'], durationS: 2 },
  { file: 'laugh-sting.wav', title: 'Laugh sting', tags: ['laugh', 'comedy', 'stinger'], durationS: 2 },
]

export const KENNEY_SFX: StockAudioEntry[] = KENNEY_FILES.map((row) => ({
  id: `kenney-${row.file.replace(/\.wav$/i, '')}`,
  kind: 'sfx' as const,
  title: row.title,
  source: 'kenney-sfx' as const,
  license: 'cc0' as const,
  durationS: row.durationS,
  tags: row.tags,
  src: `/stock-audio/sfx/${row.file}`,
}))

export type MusicPromptPreset = (typeof prompts)[number]

export const MUSIC_PROMPT_PRESETS: MusicPromptPreset[] = prompts

export function allStockAudioEntries(): StockAudioEntry[] {
  return [...KENNEY_SFX]
}

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

export function searchStockAudio(
  entries: StockAudioEntry[],
  q: string,
  opts?: { kind?: 'music' | 'sfx'; mood?: string; genre?: string; maxDurationS?: number },
): StockAudioEntry[] {
  let list = entries
  if (opts?.kind) list = list.filter((e) => e.kind === opts.kind)
  if (opts?.maxDurationS != null) list = list.filter((e) => e.durationS <= opts.maxDurationS!)
  if (opts?.mood) list = list.filter((e) => e.mood === opts.mood)
  if (opts?.genre) list = list.filter((e) => e.genre === opts.genre)
  const tokens = tokenize(q)
  if (!tokens.length) return list
  const scored = list.map((e) => {
    const hay = [e.title, ...e.tags, e.mood ?? '', e.genre ?? ''].join(' ').toLowerCase()
    let score = 0
    for (const t of tokens) if (hay.includes(t)) score += 1
    return { e, score }
  })
  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.e.title.localeCompare(b.e.title))
    .map((x) => x.e)
}
