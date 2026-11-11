// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { FindClipsInVideoButton } from '@/components/clips/editor/find-clips-in-video-button'

const estimateCredits = vi.fn(async () => ({ credits: 17 }))
const clipsFetch = vi.fn(async () => ({ jobId: 'fixture', mode: 'highlights' }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/clips-api', () => ({
  estimateCredits: (...args: unknown[]) => estimateCredits(...args),
  clipsFetch: (...args: unknown[]) => clipsFetch(...args),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('HG08 portal confirmation rendered interactions', () => {
  it('opens an accessible dialog on document.body, cancels without paid submit and restores focus', async () => {
    render(<FindClipsInVideoButton projectId="fixture" durationMs={60000} />)
    const trigger = screen.getByTestId('editor-find-clips-in-video')
    trigger.focus()
    fireEvent.click(trigger)
    const dialog = await screen.findByRole('dialog', { name: 'Find clips in this video' })
    expect(dialog.parentElement).toBe(document.body.querySelector('.fixed.inset-0'))
    expect(screen.getByTestId('find-clips-dialog-text').textContent).toContain('17 credits')
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('find-clips-start')))
    fireEvent.click(screen.getByTestId('find-clips-cancel'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(trigger)
    expect(clipsFetch).not.toHaveBeenCalled()
  })

  it('closes with Escape, does not start a job and restores focus', async () => {
    render(<FindClipsInVideoButton projectId="fixture" durationMs={60000} highlightsOnly />)
    const trigger = screen.getByTestId('editor-find-clips-in-video')
    trigger.focus()
    fireEvent.click(trigger)
    await screen.findByRole('dialog')
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(trigger)
    expect(clipsFetch).not.toHaveBeenCalled()
  })
})
