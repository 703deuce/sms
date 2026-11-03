import { defaultEdits, normalizeEdits, type ClipBounds, type ClipEditsV2 } from '@/lib/clips/edits'
import type { EditPlanJson } from '@/lib/ai-producer-agent/types'

export class DraftEditsBuilder {
  private draft: ClipEditsV2
  private version = 0

  constructor(private bounds: ClipBounds) {
    this.draft = defaultEdits(bounds)
  }

  get edits(): ClipEditsV2 {
    return this.draft
  }

  get draftVersion(): number {
    return this.version
  }

  applyPlan(plan: EditPlanJson): { warnings: string[] } {
    const warnings: string[] = []
    if (!plan.segments.length) {
      warnings.push('empty_plan')
      return { warnings }
    }
    const first = plan.segments[0]
    const last = plan.segments[plan.segments.length - 1]
    const trimIn = Math.min(first.srcInMs, last.srcInMs)
    const trimOut = Math.max(first.srcOutMs, last.srcOutMs)
    this.draft = normalizeEdits(
      {
        ...this.draft,
        trim: { in: trimIn, out: trimOut },
        cutRanges: (plan.cutsInside ?? []).map((c) => ({
          start: c.removeSrcMs[0],
          end: c.removeSrcMs[1],
        })),
        transitions: (plan.transitions ?? []).map((t) => ({
          at: t.atSegment,
          type: t.type,
        })) as unknown as ClipEditsV2['transitions'],
        textItems: (plan.text ?? []) as ClipEditsV2['textItems'],
      },
      this.bounds,
    )
    this.version += 1
    return { warnings }
  }
}
