import type { EditorialSelection } from '@/lib/ai-producer-agent/specialists'

/** API boundary: add_clip_segment.beat is a fixed schema enum, whereas
 * EditorialSelection.beat is a descriptive, free-text narrative label.
 * Preserve the descriptive label in plan/audit metadata, NEVER as a tool enum.
 * The builder uses the same source video and its original audio by default. */
export function approvedRoughCutSegmentArgs(
  sourceId:string, selection:EditorialSelection,
):{sourceId:string;srcInMs:number;srcOutMs:number} {
  return {
    sourceId,
    srcInMs:selection.startMs,
    srcOutMs:selection.endMs,
  }
}
