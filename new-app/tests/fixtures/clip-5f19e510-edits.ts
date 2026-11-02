import { defaultEdits, normalizeEdits, type ClipBounds, type ClipEditsV2 } from '@/lib/clips/edits'

/** Saved prod edits for clip_5f19e510a23241c29190475d4723aa21 (slide MC: split left, cut right). */
export const CLIP_5F19E510_BOUNDS: ClipBounds = {
  clipStartMs: 0,
  clipEndMs: 32_000,
  trimMinMs: 0,
  trimMaxMs: 32_000,
}

export function clip5f19e510Edits(): ClipEditsV2 {
  return normalizeEdits(
    {
      ...defaultEdits(CLIP_5F19E510_BOUNDS),
      trim: { in: 0, out: 32_000 },
      videoSplits: [4641],
      cutRanges: [[29_215, 29_695]],
      transitions: [{ type: 'spin', durMs: 1000, srcMs: 29_695 }],
      segmentSpeeds: [
        { fromMs: 0, toMs: 4000, speed: 0.4 },
        { fromMs: 12_000, toMs: 16_000, speed: 0.4 },
        { fromMs: 16_000, toMs: 20_000, speed: 1.75 },
        { fromMs: 28_000, toMs: 32_000, speed: 1.75 },
      ],
      loopFriendlyEnd: false,
    },
    CLIP_5F19E510_BOUNDS,
  )
}
