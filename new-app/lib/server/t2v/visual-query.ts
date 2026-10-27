import 'server-only'

/** Words that read well in scripts but return useless stock (camera cannot film these). */
const ABSTRACT_STOCK_TERMS = new Set([
  'concept',
  'concepts',
  'innovation',
  'innovative',
  'future',
  'success',
  'successful',
  'growth',
  'strategy',
  'solution',
  'solutions',
  'important',
  'amazing',
  'incredible',
  'beautiful',
  'professional',
  'quality',
  'value',
  'impact',
  'journey',
  'story',
  'vision',
  'mission',
  'believe',
  'trust',
  'inspire',
  'inspiring',
  'motivation',
  'motivational',
  'energy',
  'powerful',
  'transform',
  'transformation',
  'digital',
  'modern',
  'technology',
  'tech',
  'business',
  'corporate',
  'industry',
  'market',
  'economy',
  'sustainable',
  'sustainability',
  'environment',
  'environmental',
  'health',
  'wellness',
  'education',
  'learning',
])

function tokenizeConcrete(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !ABSTRACT_STOCK_TERMS.has(w))
}

/**
 * Strip abstract filler; ensure at least one topic token when the model was vague.
 */
export function normalizeVisualQuery(visualQuery: string, videoTopic: string): string {
  const topic = videoTopic.trim()
  const raw = visualQuery.trim()
  const words = raw
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean)
    .filter((w) => !ABSTRACT_STOCK_TERMS.has(w.toLowerCase()))
  let out = words.join(' ').trim()
  const topicTok = tokenizeConcrete(topic).slice(0, 3)
  if (topicTok.length && !topicTok.some((t) => out.toLowerCase().includes(t))) {
    out = `${topicTok.join(' ')} ${out}`.trim()
  }
  return out.slice(0, 100) || topic.slice(0, 100)
}

/** Topic-locked fallback when primary visual query returns no good Pixabay hits. */
export function narrationVisualFallback(narration: string, videoTopic: string): string {
  const topic = videoTopic.trim()
  const fromNarration = tokenizeConcrete(narration).slice(0, 5)
  const fromTopic = tokenizeConcrete(topic).slice(0, 4)
  const combined = [...new Set([...fromTopic, ...fromNarration])].join(' ')
  if (!topic) return combined.slice(0, 100)
  const lower = combined.toLowerCase()
  if (fromTopic.every((t) => lower.includes(t))) return combined.slice(0, 100)
  return `${fromTopic.join(' ')} ${combined}`.trim().slice(0, 100)
}
