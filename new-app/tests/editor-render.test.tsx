// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CleanupPanel } from '@/components/clips/editor/cleanup-panel'
import { ExportDialog } from '@/components/clips/editor/export-dialog'
import { TrimRangeBar } from '@/components/clips/editor/trim-range-bar'
import { TranscriptPanel } from '@/components/clips/editor/transcript-panel'
import { CaptionsPanel } from '@/components/clips/editor/captions-panel'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'

vi.mock('@/lib/clips-api', () => ({
  clipsFetch: vi.fn(() => Promise.resolve({ channels: [] })),
  exportClipWithOptions: vi.fn(),
  getRenderStatus: vi.fn(),
}))

vi.mock('@/lib/clips/export-preferences-sync', () => ({
  loadMergedExportDialogPreferences: vi.fn(() =>
    Promise.resolve({
      alsoSrt: false,
      exportSfx: 'off',
      defaultAspect: '9:16',
      defaultResolution: '720p',
    }),
  ),
  persistExportDialogPreferences: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { loading: vi.fn(), success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/billing/entitlements', () => ({
  can: vi.fn(() => true),
}))

const bounds = { clipStartMs: 0, clipEndMs: 60000, trimMinMs: 0, trimMaxMs: 120000 }

function loadFixture(name: string): ClipEditsV2 {
  const raw = JSON.parse(readFileSync(join(__dirname, 'fixtures/export-dialog-edits', name), 'utf8'))
  if (name === 'regular.json') {
    return normalizeEdits(defaultEdits(bounds), bounds)
  }
  return normalizeEdits(raw, bounds)
}

describe('editor render smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const fixtures = ['regular.json', 'stream_v3_clipB.json', 'no_layers.json', 'malformed_layers.json'] as const

  for (const file of fixtures) {
    it(`ExportDialog ${file}`, () => {
      const edits = loadFixture(file)
      expect(() =>
        render(
          <ExportDialog
            clipId="clip_test"
            title="Test"
            edits={edits}
            open
            onClose={() => {}}
            layoutMode={edits.layout.mode}
            onLayoutModeChange={() => {}}
          />,
        ),
      ).not.toThrow()
    })

    it(`CleanupPanel ${file}`, () => {
      const edits = loadFixture(file)
      expect(() =>
        render(
          <CleanupPanel
            clipId="clip_test"
            bounds={bounds}
            edits={edits}
            words={[]}
            gapSettings={{ mode: 'more_than', minGapSec: 0.6, maxGapSec: 3, targetGapSec: 0.35 }}
            onApplyProposal={() => {}}
            onRestoreProposal={() => {}}
            onCommitTrim={() => {}}
            onAuditionChange={() => {}}
            onSeek={() => {}}
          />,
        ),
      ).not.toThrow()
    })
  }

  it('TrimRangeBar segment/source/composite media', () => {
    const edits = loadFixture('stream_v3_clipB.json')
    for (const boundsCase of [
      { clipStartMs: 5000, clipEndMs: 35000, trimMinMs: 1934766, trimMaxMs: 2011766 },
      { clipStartMs: 0, clipEndMs: 60000, trimMinMs: 0, trimMaxMs: 175007 },
      { clipStartMs: 5000, clipEndMs: 35000, trimMinMs: 5000, trimMaxMs: 35000 },
    ]) {
      expect(() =>
        render(
          <TrimRangeBar
            bounds={boundsCase}
            trim={edits.trim}
            onCommitTrim={() => {}}
          />,
        ),
      ).not.toThrow()
    }
  })

  it('TranscriptPanel with selection', () => {
    const edits = loadFixture('regular.json')
    expect(() =>
      render(
        <TranscriptPanel
          words={[{ i: 0, w: 'hello', s: 0, e: 1 }]}
          wordsLoading={false}
          clipStartMs={0}
          clipEndMs={60000}
          shots={[]}
          edits={edits}
          onSeek={() => {}}
          onAddCut={() => {}}
          selectionRef={{ current: { from: 0, to: 0 } }}
        />,
      ),
    ).not.toThrow()
  })

  it('CaptionsPanel', () => {
    const edits = loadFixture('regular.json')
    expect(() =>
      render(
        <CaptionsPanel
          clipId="clip_test"
          edits={edits}
          words={[{ i: 0, w: 'hello', s: 0, e: 1 }]}
          onWordFix={() => {}}
          onChange={() => {}}
        />,
      ),
    ).not.toThrow()
  })
})
