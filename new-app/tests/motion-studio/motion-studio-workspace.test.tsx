// @vitest-environment happy-dom
// @ts-ignore vitest is resolved in new-app; root tsc has no vitest types
import { afterEach, describe, expect, it, vi } from 'vitest'
// @ts-ignore testing-library is resolved in new-app; root tsc does not include its test types
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }), usePathname: () => '/app/motion-studio/x' }))

import { MotionStudioWorkspace } from '../../components/motion-studio/motion-studio-workspace'
import { MotionStudioEditorLanes } from '../../components/motion-studio/motion-studio-editor-lanes'
import { createMockMotionStudioClient } from '../../lib/motion-studio/mock-client'

afterEach(() => cleanup())

describe('Motion Studio workspace (FE-5/6/7)', () => {
  it('renders the review workspace for the example project with the exact concept sections', async () => {
    const client = createMockMotionStudioClient({ storage: null })
    render(<MotionStudioWorkspace projectId="ms_example_documentary" client={client} pollMs={0} />)
    await waitFor(() => expect(screen.getAllByText('Example documentary').length).toBeGreaterThan(0))
    for (const label of ['PROJECT', 'AI Director', 'Visual Storyboard', 'Media Library', 'Export']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
    expect(document.body.textContent).not.toMatch(/\$/)
    // Storyboard + preview use code-rendered poster frames, never blank placeholders or external URLs.
    const posters = document.querySelectorAll('[data-testid="ms-poster"]')
    expect(posters.length).toBeGreaterThanOrEqual(3)
    const kinds = new Set(Array.from(posters).map((p) => p.getAttribute('data-kind')))
    expect(kinds.has('photo') && kinds.has('chart') && kinds.has('text')).toBe(true)
    expect(document.body.innerHTML).not.toMatch(/(src|href)="https?:/)
  })

  it('shows a clean Project not found state with a link back for unknown / other-workspace ids', async () => {
    const client = createMockMotionStudioClient({ storage: null })
    render(<MotionStudioWorkspace projectId="ms_someone_elses" client={client} pollMs={0} />)
    await waitFor(() => expect(screen.getByTestId('ms-not-found')).toBeTruthy())
    expect(screen.getByText('Project not found')).toBeTruthy()
    expect(screen.getByTestId('ms-not-found-back').getAttribute('href')).toBe('/app/motion-studio')
    expect(screen.queryByText('Retry')).toBeNull()
  })

  it('editor lanes mount inside the Compact Editor slot and follow the editor playhead', async () => {
    const client = createMockMotionStudioClient({ storage: null })
    const onSeek = vi.fn()
    render(<MotionStudioEditorLanes projectId="ms_example_documentary" outputMs={0} onSeek={onSeek} client={client} />)
    await waitFor(() => expect(screen.getByTestId('ms-editor-lanes')).toBeTruthy())
    const visuals=screen.getByRole('button',{name:/Main Visuals/})
    expect(visuals.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(visuals)
    expect(visuals.getAttribute('aria-expanded')).toBe('true')
    for (const label of ['VIDEO', 'GRAPHICS', 'Main Voice', 'MUSIC']) expect(screen.getByText(label)).toBeTruthy()
    expect(screen.getByText('Back to workspace').closest('a')?.getAttribute('href')).toBe('/app/motion-studio/ms_example_documentary')
  })
})
