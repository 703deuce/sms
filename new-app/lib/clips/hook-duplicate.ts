/**
 * E6: an auto hook overlay that is just the clip's first spoken line duplicates the captions.
 * Mirror of worker/clips_worker/hook_duplicate.py — keep the two in step.
 */
function hookTokens(text: string): string[] {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9' ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

export function hookTextDuplicatesCaptions(
  text: string,
  captionWords: { w: string; s: number }[],
  durationMs: number,
): boolean {
  const hook = hookTokens(text)
  if (!hook.length) return false
  const windowS = Math.max(0.5, durationMs / 1000) + 1.5
  const spoken: string[] = []
  for (const w of captionWords ?? []) {
    const s = Number(w.s)
    if (!Number.isFinite(s)) continue
    if (s > windowS) break
    spoken.push(...hookTokens(String(w.w ?? '')))
  }
  if (!spoken.length) return false
  let j = 0
  let hits = 0
  for (const tok of hook) {
    let k = j
    while (k < spoken.length && spoken[k] !== tok) k++
    if (k < spoken.length) {
      hits++
      j = k + 1
    }
  }
  return hits >= Math.max(2, Math.ceil(0.6 * hook.length - 1e-9)) || (hook.length === 1 && hits === 1)
}
