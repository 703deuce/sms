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
import { AudioPanel } from '@/components/clips/editor/audio-panel'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'

vi.mock('@/lib/clips-api', () => ({
  clipsFetch: vi.fn(() => Promise.resolve({ channels: [] })),
  exportClipWithOptions: vi.fn(),
  getRenderStatus: vi.fn(),
  retranscribeProject: vi.fn(() => Promise.resolve({ ok: true, jobId: 'j1', status: 'QUEUED' })),
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
            projectId="proj_test"
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

  it('TranscriptPanel with selection and reorder', () => {
    const base = loadFixture('regular.json')
    const edits = normalizeEdits(
      { ...base, sectionOrder: [[30000, 60000], [0, 30000]] as [number, number][] },
      bounds,
    )
    const selectionRef = { current: null }
    expect(() =>
      render(
        <TranscriptPanel
          words={[
            { i: 0, w: 'a', s: 0, e: 1 },
            { i: 1, w: 'b', s: 30, e: 31 },
          ]}
          clipStartMs={0}
          clipEndMs={60000}
          shots={[]}
          edits={edits}
          onSeek={() => {}}
          onAddCut={() => {}}
          selectionRef={selectionRef}
          onPatchSectionOrder={() => {}}
        />,
      ),
    ).not.toThrow()
  })

  it('AudioPanel level and speed', () => {
    const edits = normalizeEdits(
      { ...loadFixture('regular.json'), loudnessLufs: -14, speed: 1.25 },
      bounds,
    )
    expect(() =>
      render(
        <AudioPanel
          clipId="clip_test"
          edits={edits}
          outputDurationMs={8000}
          playheadMs={0}
          onSuggestMusic={() => {}}
          onAttachMusic={() => {}}
          onPatchMusic={() => {}}
          onRemoveMusic={() => {}}
          onAddSfx={() => {}}
          onUpdateSfx={() => {}}
          onRemoveSfx={() => {}}
          onPatchStudioSound={() => {}}
          onPatchExportAudio={() => {}}
        />,
      ),
    ).not.toThrow()
  })

  it('ExportDialog scaled duration with speed', () => {
    const edits = normalizeEdits({ ...loadFixture('regular.json'), speed: 1.25 }, bounds)
    expect(() =>
      render(
        <ExportDialog
          clipId="clip_test"
          title="Test"
          edits={edits}
          open
          onClose={() => {}}
          layoutMode={edits.layout.mode}
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
