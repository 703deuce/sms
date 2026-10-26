export interface NameEntry {
  name: string
  gender?: string
  notes?: string
}

export function dedupeNames(entries: NameEntry[]): NameEntry[] {
  const seen = new Set<string>()
  const out: NameEntry[] = []
  for (const e of entries) {
    const k = e.name.trim().toUpperCase()
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(e)
  }
  return out
}

export function suggestNameFix(name: string, database: NameEntry[]): string | null {
  const upper = name.trim().toUpperCase()
  const hit = database.find((d) => d.name.toUpperCase() === upper)
  return hit ? hit.name : null
}
