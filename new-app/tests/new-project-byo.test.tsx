// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NewProjectWorkspace } from '@/components/clips/new-project-workspace'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/lib/clips-api', () => ({
  createProject: vi.fn(),
  createProjectFromLink: vi.fn(),
  estimateCredits: vi.fn(() => Promise.resolve({ credits: 1 })),
}))

vi.mock('@/lib/clips/upload', () => ({
  uploadClipFile: vi.fn(() => Promise.resolve()),
  cancelClipUpload: vi.fn(),
  fetchUploadLimits: vi.fn(() =>
    Promise.resolve({ maxLabel: '20 GB', effectiveMaxLabel: '20 GB', maxBytes: 1 }),
  ),
  rejectFileIfOverUploadLimit: vi.fn(() => null),
}))

vi.mock('@/lib/billing/entitlements', () => ({
  featuresAllUnlocked: () => false,
}))

vi.mock('@/lib/features/t2v', () => ({
  isT2vFeatureEnabled: () => false,
}))

vi.mock('@/components/streamer/streamer-import-panel', () => ({
  StreamerImportPanel: () => null,
}))

describe('NewProjectWorkspace intents', () => {
  it('renders find-clips and BYO mode switch on upload tab', () => {
    render(<NewProjectWorkspace reframeV2Enabled={false} />)
    expect(screen.getByTestId('new-project-intent')).toBeTruthy()
    expect(screen.getByText('Find clips in a long video')).toBeTruthy()
    expect(screen.getByText('Edit a finished clip (up to 3 min)')).toBeTruthy()
  })
})
