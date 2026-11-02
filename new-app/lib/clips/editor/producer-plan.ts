/**
 * Q6.6 AI-01: bounded producer tool steps (one undo entry per step).
 */
import type { ClipBounds, ClipEditsV2, ClipWord } from '@/lib/clips/edits'
import { applyProducerToolsWithWords, type ProducerToolCall } from '@/lib/clips/edits-reducer'

export type ProducerPlanStep = {
  index: number
  name: string
  args: Record<string, unknown>
  summary: string
}

export function producerPlanFromTools(tools: ProducerToolCall[]): ProducerPlanStep[] {
  return tools.map((t, index) => ({
    index,
    name: t.name,
    args: t.args ?? {},
    summary: `${t.name}${Object.keys(t.args ?? {}).length ? '' : '()'}`,
  }))
}

export function applyProducerPlanStep(
  edits: ClipEditsV2,
  bounds: ClipBounds,
  words: ClipWord[],
  tools: ProducerToolCall[],
  stepIndex: number,
): { edits: ClipEditsV2; label: string; changeCount: number } | null {
  const tool = tools[stepIndex]
  if (!tool) return null
  const applied = applyProducerToolsWithWords(edits, bounds, [tool], words)
  const label = `Producer: ${tool.name}`
  return { edits: applied.edits, label, changeCount: applied.summaries.length || 1 }
}

export function applyProducerPlanThroughStep(
  edits: ClipEditsV2,
  bounds: ClipBounds,
  words: ClipWord[],
  tools: ProducerToolCall[],
  throughIndex: number,
): { edits: ClipEditsV2; changeCount: number } {
  const slice = tools.slice(0, throughIndex + 1)
  const applied = applyProducerToolsWithWords(edits, bounds, slice, words)
  return { edits: applied.edits, changeCount: applied.summaries.length || slice.length }
}
