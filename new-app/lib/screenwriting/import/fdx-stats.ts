/** Lightweight FDX stats for import warnings (no full re-parse of pmJson). */
export function fdxImportStats(xml: string): {
  paragraphCount: number
  unknownTypes: string[]
  droppedDual: number
} {
  const paragraphCount = (xml.match(/<Paragraph\b/gi) ?? []).length
  const droppedDual = (xml.match(/Type="Dual Dialogue"/gi) ?? []).length
  const unknownTypes: string[] = []
  const typeRe = /Type="([^"]+)"/g
  let m: RegExpExecArray | null
  const known = new Set([
    'Action',
    'Character',
    'Dialogue',
    'Parenthetical',
    'Scene Heading',
    'Transition',
    'Shot',
    'General',
    'Dual Dialogue',
  ])
  while ((m = typeRe.exec(xml))) {
    const t = m[1]
    if (!known.has(t) && !unknownTypes.includes(t)) unknownTypes.push(t)
  }
  return { paragraphCount, unknownTypes, droppedDual }
}
