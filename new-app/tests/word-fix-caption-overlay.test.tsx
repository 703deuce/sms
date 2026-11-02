// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { CaptionOverlay } from '@/components/clips/editor/caption-overlay'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import { editorPreviewCaptionClipWords } from '@/lib/clips/editor-preview-edits'

const bounds = { clipStartMs: 0, clipEndMs: 30_000 }

describe('CaptionOverlay word fix preview', () => {
  it('renders fixed caption text at the active word time', () => {
    const edits = normalizeEdits(
      {
        ...defaultEdits(bounds),
        captions: { enabled: true, presetId: 'bold_pop', animation: 'none', position: 'bottom', size: 6.5, wordsPerLine: 4 },
        wordFixes: { '5': 'Cracked.' },
      },
      bounds,
    )
    const source = [{ w: 'cracked.', s: 19, e: 19.5, i: 5 }]
    const words = editorPreviewCaptionClipWords(source, edits)
    const { container } = render(
      <CaptionOverlay words={words} currentTimeSec={19.2} edits={edits} boxHeightPx={640} outputDurationSec={30} />,
    )
    const line = container.querySelector('[data-testid="caption-line"]')
    expect(line?.textContent).toContain('Cracked.')
    expect(line?.textContent).not.toMatch(/\bcracked\./)
  })
})
