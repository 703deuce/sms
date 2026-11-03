// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProducerPopover } from '@/components/clips/editor/producer-popover'
import type { ClipBounds, ClipEditsV2 } from '@/lib/clips/edits'

vi.mock('@/components/clips/producer/producer-panel', () => ({
  ProducerPanel: () => null,
}))

const bounds: ClipBounds = { clipStartMs: 0, clipEndMs: 60_000 }
const edits: ClipEditsV2 = {
  v: 2,
  trim: { in: 0, out: 60_000 },
  cutRanges: [],
  wordFixes: {},
  captions: { enabled: true, presetId: 'bold_pop', animation: 'pop', size: 6.5, position: 'bottom', case: 'sentence', wordsPerLine: 2 },
  layout: { mode: 'speaker_follow', shotOverrides: [], layoutSegments: [] },
  silenceTrim: { enabled: false, minGapMs: 350, keepMs: 120, fillerTrim: true, protectReactionGaps: false },
  broll: [],
  audio: { music: null, sfx: [] },
}

describe('AI Producer Agent mount (flag off)', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_AI_PRODUCER_AGENT', '')
    vi.stubEnv('AI_PRODUCER_AGENT_ENABLED', '')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('does not render new-edit entry when flag is off', () => {
    render(
      <ProducerPopover
        open
        onClose={() => {}}
        clipId="clip_test"
        bounds={bounds}
        edits={edits}
        durationMs={60_000}
        onAudition={() => {}}
        onAccept={() => {}}
        onUndo={() => {}}
      />,
    )
    expect(screen.queryByTestId('ai-producer-agent-new-edit-entry')).toBeNull()
    expect(screen.getByTestId('producer-popover-close')).toBeTruthy()
  })
})
