/** Offline thesaurus stub (WordNet-sized dict shipped incrementally). */
const SYNONYMS: Record<string, string[]> = {
  run: ['sprint', 'dash', 'race'],
  happy: ['glad', 'joyful', 'pleased'],
  house: ['home', 'residence', 'dwelling'],
}

export function thesaurusLookup(word: string): string[] {
  return SYNONYMS[word.toLowerCase()] ?? []
}
