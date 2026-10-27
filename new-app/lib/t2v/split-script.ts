export function splitScript(text: string, mode: 'sentence' | 'line_break'): string[] {
  if (mode === 'line_break') return text.split(/\n+/).map((l) => l.trim()).filter(Boolean)
  const sentences = text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? []
  const out: string[] = []
  for (const s of sentences.map((x) => x.trim()).filter(Boolean)) {
    if (out.length && out[out.length - 1].split(' ').length < 6) out[out.length - 1] += ` ${s}`
    else out.push(s)
  }
  return out
}
