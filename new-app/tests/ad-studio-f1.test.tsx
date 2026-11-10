// @vitest-environment happy-dom
// @ts-expect-error vitest is resolved in new-app; root tsc has no vitest types
import { afterEach, describe, expect, it } from 'vitest'
// @ts-expect-error testing-library is resolved in new-app; root tsc does not include its test types
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AdStudioPage } from '../components/ad-studio/ad-studio-page'
import { createMockAdStudioClient } from '../lib/ad-studio/mock-client'
import { formatCredits, sanitizeAdStudioMessage } from '../lib/ad-studio/format'
import { buildSidebarNav } from '../lib/sidebar-nav'

afterEach(() => cleanup())

const ALL = { recording: true, soloRecording: false, scriptEditor: false, t2v: true }
const noWait = async () => {}

async function startStoryline() {
  const client = createMockAdStudioClient()
  render(<AdStudioPage client={client} sleep={noWait} pollMs={0} />)
  fireEvent.click(screen.getByTestId('ad-studio-mode-storyline'))
  fireEvent.change(screen.getByTestId('ad-studio-product-name'), { target: { value: 'AeroBottle' } })
  fireEvent.change(screen.getByTestId('ad-studio-selling-points'), { target: { value: 'Stays cold all day' } })
  fireEvent.click(screen.getByTestId('ad-studio-plan-cta'))
  return client
}

describe('Ad Studio live-contract UI', () => {
  it('keeps AI Studio and adds a separate /app/ad-studio sidebar item', () => {
    const nav = buildSidebarNav(ALL)
    expect(nav.find((item) => item.id === 'studio')).toMatchObject({ href: '/app/studio', label: 'Studio' })
    expect(nav.find((item) => item.id === 'ad-studio')).toMatchObject({ href: '/app/ad-studio', label: 'Ad Studio' })
  })

  it('formats credits and sanitizes dollar amounts from backend messages', () => {
    expect(formatCredits(null)).toBe('Credits TBD')
    expect(formatCredits(12)).toBe('12 credits')
    expect(sanitizeAdStudioMessage('Provider failed after $9.99 charge')).toBe('Provider failed after charge')
  })

  it('shows the two product-ad entry modes without a model gallery', () => {
    render(<AdStudioPage client={createMockAdStudioClient()} sleep={noWait} pollMs={0} />)
    expect(screen.getByTestId('ad-studio-mode-storyline')).toBeTruthy()
    expect(screen.getByTestId('ad-studio-mode-image-to-ad')).toBeTruthy()
    expect(screen.queryByTestId('studio-model-gallery')).toBeNull()
    expect(screen.queryByTestId('studio-model-picker')).toBeNull()
  })

  it('requires a real file for image-to-ad and stores the uploaded asset id, never asset_local_1', async () => {
    const client = createMockAdStudioClient({ autoAdvance: false })
    render(<AdStudioPage client={client} sleep={noWait} pollMs={0} />)
    fireEvent.click(screen.getByTestId('ad-studio-mode-image-to-ad'))
    fireEvent.change(screen.getByTestId('ad-studio-product-name'), { target: { value: 'AeroBottle' } })
    expect(screen.getByTestId('ad-studio-plan-cta').hasAttribute('disabled')).toBe(true)
    const file = new File(['image'], 'product.png', { type: 'image/png' })
    fireEvent.change(screen.getByTestId('ad-studio-product-image'), { target: { files: [file] } })
    expect(screen.getByTestId('ad-studio-plan-cta').hasAttribute('disabled')).toBe(false)
    fireEvent.click(screen.getByTestId('ad-studio-plan-cta'))
    await screen.findByTestId('ad-studio-plan')
    const listed = await client.listRuns()
    expect(listed.runs[0]?.input.imageAssetIds[0]).toMatch(/^asset_mock_/)
    expect(listed.runs[0]?.input.imageAssetIds).not.toContain('asset_local_1')
  })

  it('runs brief → plan → confirm → poll → image ads → done using backend-provided editor URLs', async () => {
    await startStoryline()
    await waitFor(() => expect(screen.getByTestId('ad-studio-confirm').hasAttribute('disabled')).toBe(false))
    expect(screen.getByTestId('ad-studio-plan-credits').textContent).toBe('Credits TBD')
    fireEvent.click(screen.getByTestId('ad-studio-confirm'))
    const done = await screen.findByTestId('ad-studio-done', {}, { timeout: 3000 })
    expect(done.textContent).not.toContain('$')
    expect(screen.getAllByTestId('ad-studio-image-variant')).toHaveLength(3)
    expect(screen.getByTestId('ad-studio-open-compact-editor').getAttribute('href')).toMatch(/\?mode=compact$/)
    expect(screen.getByTestId('ad-studio-open-full-editor').getAttribute('href')).toMatch(/^\/app\/video-editor\/[^/]+\/edit\/[^/?]+$/)
  })

  it('starts image-ad-to-commercial as a new plan that must be confirmed', async () => {
    await startStoryline()
    await waitFor(() => expect(screen.getByTestId('ad-studio-confirm').hasAttribute('disabled')).toBe(false))
    fireEvent.click(screen.getByTestId('ad-studio-confirm'))
    await screen.findByTestId('ad-studio-done', {}, { timeout: 3000 })
    fireEvent.click(screen.getAllByTestId('ad-studio-make-commercial')[0]!)
    const plan = await screen.findByTestId('ad-studio-plan')
    expect(plan.textContent).toContain('Commercial plan')
    expect(screen.getByTestId('ad-studio-confirm').hasAttribute('disabled')).toBe(false)
  })
})
