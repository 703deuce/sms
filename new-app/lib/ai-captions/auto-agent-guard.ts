/**
 * Captions-only projects must never start the upload auto-clipper, even if a
 * workspace default autoAgentClipMode leaked onto the project settings.
 */
const AUTO_AGENT_MODES = new Set(['clip_moment_v1', 'clip_story_v1', 'clip_unified_v1'])

export function captionsOnlyProjectSettings(durationMs: number): {
  captionsOnly: true
  rangeStartMs: number
  rangeEndMs: number
} {
  return { captionsOnly: true, rangeStartMs: 0, rangeEndMs: Math.max(0, durationMs) }
}

export function shouldAutoStartUploadAgentBatch(
  settings: Record<string, unknown> | null | undefined,
): boolean {
  const s = settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {}
  if (s.captionsOnly === true) return false
  const mode = s.autoAgentClipMode
  if (typeof mode !== 'string' || !AUTO_AGENT_MODES.has(mode)) return false
  if (s.agentClipBatch || s.unifiedClipRunId) return false
  return true
}
