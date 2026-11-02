'use client'

import { Timeline } from '@/components/clips/editor/timeline'
import { timebaseFor } from '@/lib/clips/editor/clip-timeline'
import { clip5f19e510Edits } from '@/tests/fixtures/clip-5f19e510-edits'
import { useMemo, useState } from 'react'

const bounds = { clipStartMs: 0, clipEndMs: 32_000, trimMinMs: 0, trimMaxMs: 32_000 }
const words = [{ i: 0, w: 'test', s: 0, e: 1 }]

/** Dev/e2e-only harness: prod slide fixture on the timeline (not linked in prod nav). */
export default function SlideTimelineTestPage() {
  const [edits, setEdits] = useState(clip5f19e510Edits())
  const outputDurationMs = useMemo(() => timebaseFor(edits).durationMs, [edits])
  return (
    <div className="h-screen bg-background p-2" data-testid="slide-test-page">
      <div
        data-testid="slide-fixture-state"
        data-video-splits={JSON.stringify(edits.videoSplits)}
        data-cut-ranges={JSON.stringify(edits.cutRanges)}
        className="sr-only"
        aria-hidden
      />
      <Timeline
        edits={edits}
        words={words}
        shots={[]}
        outputMs={8000}
        clipOutputDurationMs={outputDurationMs}
        onSeekOutput={() => {}}
        clipStartMs={bounds.clipStartMs}
        clipEndMs={bounds.clipEndMs}
        trimMinMs={bounds.trimMinMs}
        trimMaxMs={bounds.trimMaxMs}
        onCommitEdits={(next) => setEdits(next)}
        onUndo={() => {}}
        onRedo={() => {}}
        canUndo={false}
      />
    </div>
  )
}
