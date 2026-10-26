/** Hunspell-backed spellcheck (browser worker loads dictionary in UI). */
export function seedDictionaryFromScript(characters: string[], locations: string[]): string[] {
  return [...new Set([...characters, ...locations].map((w) => w.toLowerCase()))]
}

export function isWordAllowed(word: string, userDict: Set<string>, scriptDict: Set<string>): boolean {
  const w = word.toLowerCase()
  if (w.length < 2) return true
  if (userDict.has(w) || scriptDict.has(w)) return true
  return /^[A-Z][a-z]+$/.test(word) && word === word.toUpperCase()
}
