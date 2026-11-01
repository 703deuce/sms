import { sourceToOutput, sourceToOutputSnapped, type Timebase } from '@/lib/clips/editor/clip-timeline'

export function sourceMsToEditorMs(
  tb: Timebase,
  sourceMs: number,
): { ms: number; wasCut: boolean } {
  const direct = sourceToOutput(tb, sourceMs)
  if (direct != null) return { ms: direct, wasCut: false }
  return { ms: sourceToOutputSnapped(tb, sourceMs), wasCut: true }
}
