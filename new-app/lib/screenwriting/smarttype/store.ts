export type SmartTypeLists = {
  characters: string[]
  locations: string[]
  intros: string[]
  times: string[]
  transitions: string[]
  extensions: string[]
}

export const DEFAULT_SMARTTYPE: SmartTypeLists = {
  characters: [],
  locations: [],
  intros: ['INT.', 'EXT.', 'I/E', 'EST.'],
  times: ['DAY', 'NIGHT', 'CONTINUOUS', 'LATER', 'MOMENTS LATER'],
  transitions: ['CUT TO:', 'FADE IN:', 'FADE OUT.', 'FADE TO:', 'DISSOLVE TO:'],
  extensions: ['V.O.', 'O.S.', 'O.C.', "CONT'D"],
}

export function learnToken(list: string[], value: string, max = 500): string[] {
  const v = value.trim()
  if (!v) return list
  const next = [v, ...list.filter((x) => x.toLowerCase() !== v.toLowerCase())]
  return next.slice(0, max)
}

export function rankSuggestions(list: string[], query: string, preferred?: string): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return list.slice(0, 12)
  const scored = list
    .map((item) => {
      const lower = item.toLowerCase()
      let score = lower.startsWith(q) ? 2 : lower.includes(q) ? 1 : 0
      if (preferred && lower === preferred.toLowerCase()) score += 3
      return { item, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
  return scored.map((x) => x.item).slice(0, 12)
}

export function renameCharacterInLists(lists: SmartTypeLists, from: string, to: string): SmartTypeLists {
  const replace = (arr: string[]) =>
    arr.map((x) => (x.toLowerCase() === from.toLowerCase() ? to : x)).filter((x, i, a) => a.indexOf(x) === i)
  return {
    ...lists,
    characters: replace([...lists.characters, to]),
  }
}
