// @vitest-environment happy-dom
// @ts-expect-error vitest is resolved in new-app; root tsc has no vitest types
import { afterEach, describe, expect, it } from 'vitest'
// @ts-expect-error testing-library is resolved in new-app; root tsc does not include its test types
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AdStudioPage } from '../components/ad-studio/ad-studio-page'
import { createMockAdStudioClient } from '../lib/ad-studio/mock-client'
import { AdStudioHttpError, type AdStudioClient } from '../lib/ad-studio/client'
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

  it('keeps successful history when the initial config GET fails and lets config retry independently', async () => {
    const base = createMockAdStudioClient({ autoAdvance: false })
    await base.createRun({
      mode: 'storyline',
      idempotencyKey: 'seed-history',
      input: {
        name: 'Seed campaign',
        sellingPoints: ['A real saved run'],
        aspect: '9:16',
        durationSec: 15,
        imageAssetIds: [],
      },
    })
    let configCalls = 0
    const client: AdStudioClient = {
      ...base,
      async getConfig() {
        configCalls += 1
        if (configCalls === 1) throw new AdStudioHttpError(502, 'REQUEST_FAILED', 'Temporary gateway failure')
        return base.getConfig()
      },
    }

    render(<AdStudioPage client={client} sleep={noWait} pollMs={0} />)

    expect(await screen.findByTestId('ad-studio-recent-run')).toBeTruthy()
    expect(screen.getByTestId('ad-studio-read-recovery').textContent).toContain('safe creation defaults')
    fireEvent.click(screen.getByTestId('ad-studio-retry-config'))
    await waitFor(() => expect(screen.queryByTestId('ad-studio-read-recovery')).toBeNull())
    expect(configCalls).toBe(2)
  })

  it('recovers from one transient polling GET without repeating the paid confirmation action', async () => {
    const base = createMockAdStudioClient()
    let getRunCalls = 0
    let confirmCalls = 0
    const client: AdStudioClient = {
      ...base,
      async getRun(runId) {
        getRunCalls += 1
        if (getRunCalls === 1) throw new AdStudioHttpError(502, 'REQUEST_FAILED', 'Temporary gateway failure')
        return base.getRun(runId)
      },
      async confirm(runId, key) {
        confirmCalls += 1
        return base.confirm(runId, key)
      },
    }

    render(<AdStudioPage client={client} sleep={noWait} pollMs={0} />)
    fireEvent.click(screen.getByTestId('ad-studio-mode-storyline'))
    fireEvent.change(screen.getByTestId('ad-studio-product-name'), { target: { value: 'AeroBottle' } })
    fireEvent.change(screen.getByTestId('ad-studio-selling-points'), { target: { value: 'Stays cold all day' } })
    fireEvent.click(screen.getByTestId('ad-studio-plan-cta'))

    await waitFor(() => expect(screen.getByTestId('ad-studio-confirm').hasAttribute('disabled')).toBe(false))
    expect(getRunCalls).toBeGreaterThanOrEqual(2)
    expect(screen.queryByTestId('ad-studio-poll-recovery')).toBeNull()

    fireEvent.click(screen.getByTestId('ad-studio-confirm'))
    await screen.findByTestId('ad-studio-done', {}, { timeout: 3000 })
    expect(confirmCalls).toBe(1)
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
