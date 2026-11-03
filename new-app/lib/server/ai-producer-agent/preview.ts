import 'server-only'

import type { OutputState } from '@/lib/ai-producer-agent/orchestrator'

export async function renderPreview(
  ctx: { runId: string },
  out: OutputState,
  _args: Record<string, unknown>,
): Promise<{ ok: boolean; summary: string; data?: unknown; costUsd?: number }> {
  if (!out.clipId) {
    return { ok: false, summary: 'preview unavailable (no clip)', costUsd: 0 }
  }
  const renderId = `prev_${ctx.runId}_${out.index}`
  return { ok: true, summary: 'edl-only preview', data: { renderId, mode: 'edl' }, costUsd: 0 }
}
