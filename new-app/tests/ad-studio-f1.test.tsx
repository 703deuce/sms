// @vitest-environment happy-dom
// @ts-expect-error vitest is resolved in new-app; root tsc has no vitest types
import { afterEach, describe, expect, it } from 'vitest'
// @ts-expect-error vitest is resolved in new-app; root tsc has no vitest types
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { AdStudioPage } from '../components/ad-studio/ad-studio-page'
import { createMockAdStudioClient } from '../lib/ad-studio/mock-client'
import { formatCredits, sanitizeAdStudioMessage } from '../lib/ad-studio/format'
import { AD_STUDIO_COSTS } from '../lib/ad-studio/costs'
import { buildSidebarNav, createMenuItems } from '../lib/sidebar-nav'

afterEach(() => {
  cleanup()
})

const ALL = { recording: true, soloRecording: false, scriptEditor: false, t2v: true }

async function startStoryline(client = createMockAdStudioClient()) {
  render(<AdStudioPage client={client} sleep={async () => {}} pollMs={0} />)
  fireEvent.click(screen.getByTestId('ad-studio-mode-storyline'))
  fireEvent.change(screen.getByTestId('ad-studio-product-name'), { target: { value: 'AeroBottle' } })
  fireEvent.change(screen.getByTestId('ad-studio-selling-points'), { target: { value: 'stays cold' } })
  fireEvent.click(screen.getByTestId('ad-studio-plan-cta'))
  return client
}

describe('ad studio F1', () => {
  it('formats credits without a dollar amount', () => {
    expect(formatCredits(null)).toBe('Credits TBD')
    expect(formatCredits(12)).toBe('12 credits')
    expect(sanitizeAdStudioMessage('Failed $9.99 charge')).toBe('Failed charge')
    expect(JSON.stringify(AD_STUDIO_COSTS)).not.toContain('$')
  })

  it('nav and /app outcome entry point at /app/studio as Product ad', () => {
    const nav = buildSidebarNav(ALL)
    const item = nav.find((i) => i.id === 'studio')
    expect(item?.href).toBe('/app/studio')
    expect(item?.label).toBe('Product ad')
    const created = createMenuItems(ALL).find((i) => i.id === 'create-studio')
    expect(created?.href).toBe('/app/studio')
    expect(created?.label).toBe('Product ad')
  })

  it('mode home has no model gallery or model picker', () => {
    render(<AdStudioPage client={createMockAdStudioClient()} sleep={async () => {}} pollMs={0} />)
    expect(screen.getByTestId('ad-studio-mode-home')).toBeTruthy()
    expect(screen.getByTestId('ad-studio-mode-storyline')).toBeTruthy()
    expect(screen.getByTestId('ad-studio-mode-image-to-ad')).toBeTruthy()
    expect(screen.queryByTestId('studio-model-gallery')).toBeNull()
    expect(screen.queryByTestId('studio-model-picker')).toBeNull()
    expect(screen.queryByTestId('studio-category-nav')).toBeNull()
    expect(document.body.textContent).not.toContain('$')
  })

  it('keeps prior studio jobs visible in history', async () => {
    render(<AdStudioPage client={createMockAdStudioClient()} sleep={async () => {}} pollMs={0} />)
    fireEvent.click(screen.getByTestId('ad-studio-nav-history'))
    const panel = await screen.findByTestId('ad-studio-history')
    expect(within(panel).getByText('Prior product still')).toBeTruthy()
    expect(within(panel).getByText('Prior clip render')).toBeTruthy()
  })

  it('disables confirm until the plan is ready', async () => {
    const client = createMockAdStudioClient({ autoAdvance: false })
    await startStoryline(client)
    const confirm = await screen.findByTestId('ad-studio-confirm')
    expect(confirm.hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('ad-studio-plan').textContent).toMatch(/Planning/i)
  })

  it('shows a mixed stock and generated plan, Credits TBD, then opens the compact editor', async () => {
    await startStoryline()
    const plan = await screen.findByTestId('ad-studio-plan')
    await waitFor(() => {
      expect(screen.getByTestId('ad-studio-confirm').hasAttribute('disabled')).toBe(false)
    })
    const sources = [...plan.querySelectorAll('[data-source]')].map((el) => el.getAttribute('data-source'))
    expect(sources).toContain('stock')
    expect(sources).toContain('generated')
    expect(screen.getByTestId('ad-studio-plan-credits').textContent).toBe('Credits TBD')
    expect(plan.textContent).not.toContain('$')
    fireEvent.click(screen.getByTestId('ad-studio-confirm'))
    const done = await screen.findByTestId('ad-studio-done', {}, { timeout: 3000 })
    const compact = screen.getByTestId('ad-studio-open-compact-editor')
    const full = screen.getByTestId('ad-studio-open-full-editor')
    expect(compact.getAttribute('href')).toMatch(/^\/app\/video-editor\/[^/]+\/edit\/[^/?]+$/)
    expect(full.getAttribute('href')).toMatch(/^\/app\/video-editor\/[^/]+\/edit\/[^/?]+\?timeline=1$/)
    expect(done.textContent).not.toContain('$')
    expect(done.textContent).toContain('Credits TBD')
  })

  it('re-plan stays unpaid and does not skip back to generating', async () => {
    const client = createMockAdStudioClient()
    await startStoryline(client)
    await waitFor(() => {
      expect(screen.getByTestId('ad-studio-confirm').hasAttribute('disabled')).toBe(false)
    })
    fireEvent.click(screen.getByTestId('ad-studio-replan'))
    await waitFor(() => {
      expect(screen.getByTestId('ad-studio-confirm').hasAttribute('disabled')).toBe(true)
    })
    expect(screen.queryByTestId('ad-studio-progress')).toBeNull()
    await waitFor(() => {
      expect(screen.getByTestId('ad-studio-confirm').hasAttribute('disabled')).toBe(false)
    })
    const runs = await client.listRuns()
    expect(runs[0]?.status).toBe('plan_ready')
  })

  it('image-to-ad requires a product image', async () => {
    render(<AdStudioPage client={createMockAdStudioClient({ autoAdvance: false })} sleep={async () => {}} pollMs={0} />)
    fireEvent.click(screen.getByTestId('ad-studio-mode-image-to-ad'))
    fireEvent.change(screen.getByTestId('ad-studio-product-name'), { target: { value: 'AeroBottle' } })
    expect(screen.getByTestId('ad-studio-plan-cta').hasAttribute('disabled')).toBe(true)
    const file = new File(['img'], 'product.png', { type: 'image/png' })
    fireEvent.change(screen.getByTestId('ad-studio-product-image'), { target: { files: [file] } })
    expect(screen.getByTestId('ad-studio-plan-cta').hasAttribute('disabled')).toBe(false)
  })
})
