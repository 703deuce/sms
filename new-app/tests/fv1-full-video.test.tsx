// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  FULL_VIDEO_DURATION_ERROR,
  FULL_VIDEO_MAX_DURATION_MS,
  assertFullVideoUploadDuration,
  formatMediaDuration,
  isFullVideoSettings,
  sourceAspectRatio,
} from '@/lib/clips/full-video'
import { clipProjectSettingsSchema, defaultClipSettings } from '@/lib/clips/settings'
import { buildProcessProjectJobPayload } from '@/lib/server/clips/process-project-payload'

let search = new URLSearchParams()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => search,
}))
vi.mock('@/lib/clips-api', () => ({
  createProject: vi.fn(),
  createProjectFromLink: vi.fn(),
  estimateCredits: vi.fn(() => Promise.resolve({ credits: 1 })),
}))
vi.mock('@/lib/clips/upload', () => ({
  uploadClipFile: vi.fn(() => Promise.resolve()),
  cancelClipUpload: vi.fn(),
  fetchUploadLimits: vi.fn(() => Promise.resolve({ maxLabel: '20 GB', effectiveMaxLabel: '20 GB', maxBytes: 1 })),
  rejectFileIfOverUploadLimit: vi.fn(() => null),
}))
vi.mock('@/lib/billing/entitlements', () => ({ featuresAllUnlocked: () => false }))
vi.mock('@/lib/features/t2v', () => ({ isT2vFeatureEnabled: () => false }))
vi.mock('@/components/streamer/streamer-import-panel', () => ({ StreamerImportPanel: () => null }))

import { NewProjectWorkspace } from '@/components/clips/new-project-workspace'

describe('FV1 full-video helpers', () => {
  it('caps at 3 hours', () => {
    expect(FULL_VIDEO_MAX_DURATION_MS).toBe(10_800_000)
    expect(() => assertFullVideoUploadDuration(10_800_000)).not.toThrow()
    expect(() => assertFullVideoUploadDuration(60 * 60 * 1000)).not.toThrow()
    expect(() => assertFullVideoUploadDuration(10_800_001)).toThrow(FULL_VIDEO_DURATION_ERROR)
  })
  it('picks the canvas nearest the source frame', () => {
    expect(sourceAspectRatio(1920, 1080)).toBe('16:9')
    expect(sourceAspectRatio(3840, 1600)).toBe('16:9')
    expect(sourceAspectRatio(1080, 1920)).toBe('9:16')
    expect(sourceAspectRatio(1080, 1080)).toBe('1:1')
    expect(sourceAspectRatio(1080, 1350)).toBe('4:5')
    expect(sourceAspectRatio(0, 0)).toBe('16:9')
    expect(sourceAspectRatio(null, undefined)).toBe('16:9')
  })
  it('formats long durations', () => {
    expect(formatMediaDuration(3_723_000)).toBe('1:02:03')
    expect(formatMediaDuration(245_000)).toBe('4:05')
  })
  it('settings carry fullVideo; payload marks byo + fullVideo; clips unchanged', () => {
    const s = defaultClipSettings({ byo: true, fullVideo: true, aspectRatio: '16:9' })
    expect(clipProjectSettingsSchema.parse(s).fullVideo).toBe(true)
    expect(isFullVideoSettings(s)).toBe(true)
    expect(isFullVideoSettings(defaultClipSettings())).toBe(false)
    const p = buildProcessProjectJobPayload(s)
    expect(p.byo).toBe(true)
    expect(p.fullVideo).toBe(true)
    const byo = buildProcessProjectJobPayload(defaultClipSettings({ byo: true }))
    expect(byo.byo).toBe(true)
    expect(byo.fullVideo).toBeUndefined()
    const find = buildProcessProjectJobPayload(defaultClipSettings())
    expect(find.byo).toBeUndefined()
    expect(find.fullVideo).toBeUndefined()
  })
})

describe('FV1 New project: "Edit a full video" intent', () => {
  it('is offered alongside Find clips and the 3-min clip option', () => {
    search = new URLSearchParams()
    render(<NewProjectWorkspace reframeV2Enabled={false} />)
    expect(screen.getByText('Find clips in a long video')).toBeTruthy()
    expect(screen.getByText('Edit a finished clip (up to 3 min)')).toBeTruthy()
    expect(screen.getByText('Edit a full video')).toBeTruthy()
    const radios = screen.getAllByRole('radio', { hidden: true }) as HTMLInputElement[]
    const find = radios.find((r) => r.value === 'find')!
    expect(find.checked).toBe(true)
  })
  it('?intent=full preselects it and shows no $ anywhere', () => {
    search = new URLSearchParams('intent=full')
    const { container } = render(<NewProjectWorkspace reframeV2Enabled={false} />)
    const radios = Array.from(container.querySelectorAll('input[name="project-intent"]')) as HTMLInputElement[]
    expect(radios.find((r) => r.value === 'full')!.checked).toBe(true)
    expect(container.textContent).not.toMatch(/\$\d/)
  })
})
