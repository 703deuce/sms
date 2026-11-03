/** CUTS_QUALITY1: per-cut metadata stored on edits (additive). */

export type CutConfidence = 'ready' | 'needs_review'

export type CutQualityMeta = {
  srcStartMs: number
  srcEndMs: number
  confidence: CutConfidence
  reason: string
}

export type CutQualityReason =
  | 'filler_lexicon'
  | 'filler_repeat'
  | 'gap_shorten'
  | 'gap_motion_kept'
  | 'gap_guest_audio'
  | 'boundary_touch_neighbor'
  | 'manual'
