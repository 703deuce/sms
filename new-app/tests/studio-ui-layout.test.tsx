// @vitest-environment happy-dom
// @ts-expect-error vitest is resolved in new-app; root tsc has no vitest types
import { describe, expect, it } from 'vitest'
// @ts-expect-error vitest is resolved in new-app; root tsc has no vitest types
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AiStudioPage } from '../components/studio/ai-studio-page'
import { createDevStudioFallback } from '../lib/ai-studio/fallback'

describe('studio layout', () => {
  it('renders the rail, category nav, credit generate button, presets, and capability-gated frames', async () => {
    const client = createDevStudioFallback()
    render(<AiStudioPage client={client} listProjects={async () => []} sleep={async () => {}} />)
    expect(await screen.findByTestId('studio-control-rail')).toBeTruthy()
    expect(screen.getByTestId('studio-category-nav')).toBeTruthy()
    expect(screen.getByTestId('studio-generate').textContent).toMatch(/Generate · .+credits/)
    expect(screen.getByTestId('studio-generate').textContent).not.toMatch(/\$/)
    expect(screen.getByTestId('studio-settings-chip')).toBeTruthy()
    expect(screen.getByTestId('studio-prompt-presets')).toBeTruthy()
    fireEvent.click(screen.getByTestId('studio-category-nav').querySelector('[data-nav-mode="image_to_video"]') as HTMLElement)
    await waitFor(() => expect(screen.getByTestId('studio-swap-frames')).toBeTruthy())
    expect(screen.getByTestId('studio-upload-start_frame')).toBeTruthy()
    expect(screen.getByTestId('studio-upload-end_frame')).toBeTruthy()
    fireEvent.click(screen.getByTestId('studio-category-nav').querySelector('[data-nav-mode="text_to_image"]') as HTMLElement)
    await waitFor(() => expect(screen.queryByTestId('studio-swap-frames')).toBeNull())
    fireEvent.click(screen.getByTestId('studio-category-nav').querySelector('[data-nav-results="models"]') as HTMLElement)
    expect(await screen.findByTestId('studio-model-gallery')).toBeTruthy()
    expect(screen.getAllByText(/from \d+ credits/).length).toBeGreaterThan(0)
  })
})
