export const CLIP_AGENT_MODES = ['clip_moment_v1', 'clip_story_v1', 'clip_unified_v1'] as const
export type ClipAgentMode = (typeof CLIP_AGENT_MODES)[number]

export function isClipAgentMode(mode?: string | null): mode is ClipAgentMode {
  return mode === 'clip_moment_v1' || mode === 'clip_story_v1' || mode === 'clip_unified_v1'
}

export function clipPipelineMode(pass: 'moment' | 'story'): 'clip_moment_v1' | 'clip_story_v1' {
  return pass === 'moment' ? 'clip_moment_v1' : 'clip_story_v1'
}

export function unifiedClipType(pass: 'moment' | 'story'): 'story' | 'continuous' {
  return pass === 'moment' ? 'continuous' : 'story'
}

/** Continuous clips stay in the 15–30s band (may go up to ~60s naturally). */
export const CONTINUOUS_TARGET_S: [number, number] = [15, 30]
