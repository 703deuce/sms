/** Insert scene label between 5 and 6 → 5A; between 5A and 5B → 5AA; before 1 → A1 */
export function insertSceneLabel(existing: string[], after: string, before?: string): string {
  if (!after && before === '1') return 'A1'
  const siblings = existing.filter((n) => n.startsWith(after) && n !== after)
  if (!siblings.length) return `${after}A`
  const last = siblings.sort().at(-1) ?? `${after}A`
  if (last.endsWith('Z')) return `${last}A`
  const tail = last.slice(after.length)
  const next = tail.slice(0, -1) + String.fromCharCode(tail.charCodeAt(tail.length - 1) + 1)
  return after + next
}

export function formatOmittedScene(number: string): string {
  return `OMITTED (${number})`
}
