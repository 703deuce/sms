// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScriptViewCompactTimeline } from '@/components/clips/editor/script-view-compact-timeline'
import { defaultEdits } from '@/lib/clips/edits'

vi.mock('@/components/clips/editor/timeline/use-filmstrip-frames', () => ({
  useFilmstripFrames: () => null,
}))

describe('ScriptViewCompactTimeline', () => {
  it('renders compact timeline chrome and zoom controls', () => {
    render(
      <ScriptViewCompactTimeline
        peaks={{ peaks: [0.1, 0.2], peaksPerSec: 40, durationMs: 1000 }}
        edits={defaultEdits({ clipStartMs: 0, clipEndMs: 1000, trimMinMs: 0, trimMaxMs: 1000 })}
        words={[
          { i: 0, w: 'Hello', s: 0, e: 0.5 },
          { i: 1, w: 'world', s: 0.5, e: 1 },
        ]}
        trimInMs={0}
        trimOutMs={1000}
        mediaOffsetMs={0}
        outputDurationMs={1000}
        outputMs={100}
        videoUrl={null}
        onSeekOutput={vi.fn()}
      />,
    )
    expect(screen.getByTestId('script-view-compact-timeline')).toBeTruthy()
    expect(screen.getByTestId('script-compact-zoom-pct')).toBeTruthy()
    expect(screen.getByLabelText('Zoom to fit')).toBeTruthy()
  })
})
