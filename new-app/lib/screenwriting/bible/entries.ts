export type BibleKind = 'character' | 'location' | 'note'

export interface BibleEntry {
  id: string
  kind: BibleKind
  name: string
  body: string
  linkedCharacter?: string
}

export function linkBibleToCharacter(entry: BibleEntry, characterName: string): BibleEntry {
  return { ...entry, linkedCharacter: characterName, kind: 'character' }
}
