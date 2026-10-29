// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ExportDialog } from '@/components/clips/editor/export-dialog'
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
  toast: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/lib/billing/entitlements', () => ({
  can: vi.fn(() => true),
}))

const bounds = { clipStartMs: 0, clipEndMs: 60000 }

function loadFixture(name: string): ClipEditsV2 {
  const raw = JSON.parse(readFileSync(join(__dirname, 'fixtures/export-dialog-edits', name), 'utf8'))
  if (name === 'regular.json') {
    return normalizeEdits(defaultEdits(bounds), bounds)
  }
  return normalizeEdits(raw, bounds)
}

describe('ExportDialog render', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const cases = ['regular.json', 'stream_v3_clipB.json', 'no_layers.json', 'malformed_layers.json'] as const

  for (const file of cases) {
    it(`does not throw for ${file}`, () => {
      const edits = loadFixture(file)
      expect(() =>
        render(
          <ExportDialog
            clipId="clip_test"
            title="Test clip"
            edits={edits}
            open
            onClose={() => {}}
            layoutMode={edits.layout.mode}
            onLayoutModeChange={() => {}}
            platform="twitch"
            defaultChannelUrl="https://twitch.tv/test"
          />,
        ),
      ).not.toThrow()
    })
  }
})
