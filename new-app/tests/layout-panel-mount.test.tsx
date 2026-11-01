// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { LayoutPanel } from '@/components/clips/editor/layout-panel'
import { ScriptShortenGapsPanel } from '@/components/script-editor/side/script-shorten-gaps-panel'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'

vi.mock('sonner', () => ({ toast: { message: vi.fn(), success: vi.fn(), error: vi.fn() } }))

const bounds = { clipStartMs: 0, clipEndMs: 20_000, trimMinMs: 0, trimMaxMs: 40_000 }

describe('Layout / Polish panel mount', () => {
  it('renders without ReferenceError (FreeToolBadge + shorten gaps)', () => {
    const edits = normalizeEdits(defaultEdits(bounds), bounds)
    const { getByTestId } = render(
      <LayoutPanel
        edits={edits}
        shots={[]}
        onMode={() => {}}
        onShotFocus={() => {}}
        onRerunReframe={() => {}}
        onEdits={() => {}}
        clipId="clip1"
        words={[{ i: 0, w: 'hello', s: 1, e: 1.5 }]}
        clipStartMs={0}
        clipEndMs={20_000}
        gapToolSettings={{ mode: 'more_than', minGapSec: 0.6, maxGapSec: 3, targetGapSec: 0.35 }}
        onGapToolSettingsChange={() => {}}
        onAddCut={() => {}}
        onSeekSource={() => {}}
        onOpenGapReview={() => {}}
        onOpenFillerReview={() => {}}
      />,
    )
    expect(getByTestId('script-shorten-gaps-panel')).toBeTruthy()
  })

  it('ScriptShortenGapsPanel shows Free badge', () => {
    const { getAllByTestId } = render(
      <ScriptShortenGapsPanel
        gapHits={[]}
        mode="more_than"
        onModeChange={() => {}}
        minGapSec={0.6}
        maxGapSec={3}
        onMinGapSecChange={() => {}}
        onMaxGapSecChange={() => {}}
        targetGapSec={0.35}
        onTargetGapSecChange={() => {}}
        activeHitId={null}
        rangeStartMs={0}
        onSelectHit={() => {}}
        onShortenOne={() => {}}
        onShortenAll={() => {}}
        onOpenReview={() => {}}
      />,
    )
    expect(getAllByTestId('script-shorten-gaps-panel')[0]!.textContent).toMatch(/Shorten word gaps/)
  })
})
