import type { LunaMessage } from '@/lib/ai-producer-agent/luna-client'
import type { Budget } from '@/lib/ai-producer-agent/budget'
import { CAPS } from '@/lib/ai-producer-agent/budget'

export type ToolResult = { ok: boolean; summary: string; data?: unknown; costUsd?: number }

export function summarizeToolResult(name: string, r: ToolResult): string {
  if (!r.ok) return JSON.stringify({ ok: false, error: r.summary.slice(0, 500) })
  const d = r.data as Record<string, unknown>
  switch (name) {
    case 'get_transcript':
      return cap({ ok: true, lines: toLines((d.words as unknown[]) ?? []) })
    case 'get_audio_energy':
      return cap({
        ok: true,
        valleys: ((d.valleys as unknown[]) ?? []).slice(0, 50),
        bursts: d.bursts,
        silences: d.silences,
      })
    case 'find_moments':
      return cap({
        ok: true,
        moments: ((d.moments as unknown[]) ?? []).slice(0, 12).map(pickMoment),
      })
    case 'analyze_visual':
      return cap({
        ok: true,
        laughs: d.laughs,
        reactions: d.reactions,
        actions: ((d.actions as unknown[]) ?? []).slice(0, 20),
        faces: d.faces,
        hookQuality: d.hookQuality,
      })
    case 'validate_plan':
      return cap({
        ok: true,
        hardFailures: ((d.hardFailures as unknown[]) ?? []).slice(0, 20),
        warnings: ((d.warnings as unknown[]) ?? []).slice(0, 10),
      })
    default:
      return cap({ ok: true, ...d })
  }
}

function cap(o: unknown) {
  const s = JSON.stringify(o)
  return s.length <= 2000 ? s : JSON.stringify({ truncated: true, head: s.slice(0, 1900) })
}

function toLines(words: unknown[]) {
  return words.slice(0, 200).map((w) => {
    const row = w as { w?: string; s?: number; e?: number }
    return `[${Math.round((row.s ?? 0) * 1000)}-${Math.round((row.e ?? 0) * 1000)}] ${row.w ?? ''}`
  })
}

function pickMoment(m: unknown) {
  const x = m as Record<string, unknown>
  return {
    id: x.id,
    sourceId: x.sourceId,
    s: x.start_s ?? x.s,
    e: x.end_s ?? x.e,
    score: x.score,
    title: x.title ?? x.what_happened,
    beats: x.beats,
  }
}

export function compactHistory(messages: LunaMessage[], budget: Budget): void {
  if (budget.lunaIn < CAPS.lunaInputTokens * 0.7) return
  const toolIdx: number[] = []
  messages.forEach((m, i) => {
    if (m.role === 'tool') toolIdx.push(i)
  })
  if (toolIdx.length <= 6) return
  const drop = toolIdx.slice(0, toolIdx.length - 6)
  for (const i of drop) {
    const m = messages[i]
    if (m.role !== 'tool') continue
    messages[i] = { ...m, content: '{"summarised":true}' }
  }
}
