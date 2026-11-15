// @vitest-environment happy-dom
// @ts-ignore vitest is resolved in new-app; root tsc has no vitest types
import { afterEach, describe, expect, it, vi } from 'vitest'
// @ts-ignore testing-library is resolved in new-app; root tsc does not include its test types
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }), usePathname: () => '/app/motion-studio' }))

import { motionStudioLiveEnabled, withLocalExample, MS_EXAMPLE_PROJECT_ID } from '../../lib/motion-studio'
import { createLiveMotionStudioClient, type MotionStudioClient } from '../../lib/motion-studio/client'
import { createMockMotionStudioClient, MOCK_TIMING } from '../../lib/motion-studio/mock-client'
import type { MsProject } from '../../lib/motion-studio/types'
import { MotionStudioCreate } from '../../components/motion-studio/motion-studio-create'
import { MotionStudioWorkspace } from '../../components/motion-studio/motion-studio-workspace'
import { DirectorChat } from '../../components/motion-studio/director-chat'
import { ProductionActivity } from '../../components/motion-studio/production-activity'
import { AllowancePanel } from '../../components/motion-studio/allowance-panel'
import { SetupStep } from '../../components/motion-studio/setup-step'

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

const json = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
const live401 = () => createLiveMotionStudioClient({ fetcher: json(401, { error: 'Unauthorized' }) as unknown as typeof fetch })

describe('live is the default client', () => {
  it('only NEXT_PUBLIC_MOTION_STUDIO_LIVE=0 falls back to the mock', () => {
    vi.stubEnv('NEXT_PUBLIC_MOTION_STUDIO_LIVE', '')
    expect(motionStudioLiveEnabled()).toBe(true)
    vi.stubEnv('NEXT_PUBLIC_MOTION_STUDIO_LIVE', '1')
    expect(motionStudioLiveEnabled()).toBe(true)
    vi.stubEnv('NEXT_PUBLIC_MOTION_STUDIO_LIVE', '0')
    expect(motionStudioLiveEnabled()).toBe(false)
  })

  it('serves the Example locally and read-only, everything else from the live backend', async () => {
    const f = json(200, { projects: [] })
    const client = withLocalExample(createLiveMotionStudioClient({ fetcher: f as unknown as typeof fetch }))
    expect(client.mode).toBe('live')
    const list = await client.listProjects()
    expect(list.map((p) => p.id)).toEqual([MS_EXAMPLE_PROJECT_ID])
    expect((f.mock.calls[0] as unknown as [string])[0]).toBe('/api/motion-studio/projects')
    const ex = await client.getProject(MS_EXAMPLE_PROJECT_ID)
    expect(ex.isExample).toBe(true)
    expect(f.mock.calls.length).toBe(1) // example never hits the network
    await expect(client.startExport(MS_EXAMPLE_PROJECT_ID, 'k')).rejects.toMatchObject({ status: 403, code: 'EXAMPLE_READ_ONLY' })
    await expect(client.regenerateScene(MS_EXAMPLE_PROJECT_ID, 's', null, 'k')).rejects.toMatchObject({ status: 403 })
    expect(f.mock.calls.length).toBe(1)
  })

  it('signed out: /app/motion-studio shows the session-ended state, not mock data', async () => {
    render(<MotionStudioCreate client={withLocalExample(live401())} initialView="projects" />)
    await waitFor(() => expect(screen.getByTestId('ms-projects-error')).toBeTruthy())
    expect(screen.getByText('Your session has ended. Refresh the page to sign in again.')).toBeTruthy()
    expect(screen.getByText('Refresh')).toBeTruthy()
    expect(screen.queryByTestId('motion-studio-mock-notice')).toBeNull()
    expect(screen.queryByText('GameStop: The Short Squeeze')).toBeNull()
  })

  it('live Example workspace: Example notice instead of the preview-data banner', async () => {
    render(<MotionStudioWorkspace projectId={MS_EXAMPLE_PROJECT_ID} client={withLocalExample(live401())} pollMs={0} />)
    await waitFor(() => expect(screen.getByTestId('motion-studio-example-notice')).toBeTruthy())
    expect(screen.queryByTestId('motion-studio-mock-notice')).toBeNull()
    expect(screen.queryByTestId('ms-cancel')).toBeNull()
    fireEvent.click(screen.getByTestId('ms-bottom-timeline'))
    expect((screen.getByTestId('ms-open-editor-timeline') as HTMLButtonElement).disabled).toBe(true)
  })
})

function withProject(base: MotionStudioClient, mutate: (p: MsProject) => MsProject): MotionStudioClient {
  return { ...base, getProject: async (id) => mutate(await base.getProject(id)) }
}

describe('contract v1.1 caveats', () => {
  it('per-scene error state in storyboard, inspector and preview', async () => {
    const mock = createMockMotionStudioClient({ storage: null })
    const client = withProject(mock, (p) => ({ ...p, scenes: p.scenes.map((s, i) => (i === 0 ? { ...s, status: 'failed', error: 'This scene failed to render. Regenerate it to try again.' } : s)) }))
    render(<MotionStudioWorkspace projectId={MS_EXAMPLE_PROJECT_ID} client={client} pollMs={0} />)
    await waitFor(() => expect(screen.getAllByTestId('ms-scene-failed').length).toBe(1))
    fireEvent.click(screen.getAllByTestId('ms-scene-card')[0]!)
    await waitFor(() => expect(screen.getAllByTestId('ms-inspector-scene-error').length).toBeGreaterThan(0))
    expect(screen.getAllByText('Regenerate scene').length).toBeGreaterThan(0)
    expect(screen.getByTestId('ms-preview-scene-failed').textContent).toContain('Scene 1 failed')
  })

  it('cancel asks for confirmation, then stops production (no automatic retry)', async () => {
    let t = 1_700_000_000_000
    const client = createMockMotionStudioClient({ storage: null, seedExample: false, now: () => t })
    const p = await client.createProject({ workflow: 'idea', prompt: 'Apollo program', uploads: [], mediaPolicy: 'uploads_only', idempotencyKey: 'c1' })
    await client.createPlan(p.id, 'p')
    render(<MotionStudioWorkspace projectId={p.id} client={client} pollMs={0} />)
    fireEvent.click(await screen.findByTestId('ms-cancel'))
    expect(screen.getByText('Cancel production?')).toBeTruthy()
    const spy = vi.spyOn(client, 'cancelProject')
    fireEvent.click(screen.getByTestId('ms-cancel-confirm'))
    await waitFor(() => expect(screen.getByTestId('ms-project-failed')).toBeTruthy())
    expect(spy).toHaveBeenCalledTimes(1)
    t += MOCK_TIMING.plan * 3
    expect((await client.getProject(p.id)).status).toBe('failed')
  })

  it('single-item proposals: one Accept / Reject, no "all" buttons, no empty bubbles', () => {
    const base = { id: 'x', title: 't', director: [
      { id: 'm1', role: 'user', text: 'Make the chart bigger', at: '2026-11-15T00:00:00Z' },
      { id: 'm2', role: 'director', text: '', at: '2026-11-15T00:00:01Z', proposalId: 'p1' },
      { id: 'm3', role: 'director', text: '   ', at: '2026-11-15T00:00:02Z' },
    ], proposals: [{ id: 'p1', request: 'Make the chart bigger', createdAt: '2026-11-15T00:00:00Z', items: [{ id: 'i1', text: 'Regenerate this scene with: “Make the chart bigger”', status: 'pending' }] }] } as unknown as MsProject
    const onDecide = vi.fn()
    const { container } = render(<DirectorChat project={base} scene={null} busy={null} onSend={vi.fn()} onDecide={onDecide} />)
    expect(screen.queryByText('Accept all')).toBeNull()
    expect(screen.queryByText('Reject all')).toBeNull()
    fireEvent.click(screen.getByTestId('ms-proposal-accept'))
    expect(onDecide).toHaveBeenCalledWith('p1', ['i1'], 'accept')
    const bubbles = Array.from(container.querySelectorAll('p.rounded-xl')).map((n) => n.textContent?.trim())
    expect(bubbles).toEqual(['Make the chart bigger'])
  })

  it('no empty Director’s reasoning box before anything happened', async () => {
    const client = createMockMotionStudioClient({ storage: null, seedExample: false })
    const p = await client.createProject({ workflow: 'idea', prompt: 'x', uploads: [], mediaPolicy: 'uploads_only', idempotencyKey: 'r1' })
    render(<ProductionActivity project={p} events={[{ id: 'e', at: p.createdAt, stage: 'story', kind: 'reasoning', text: '  ' }]} onRetry={vi.fn()} busy={null} />)
    expect(screen.queryByText('Director’s reasoning')).toBeNull()
  })

  it('credits read "Included" while charging is off, with no provider names and no $', () => {
    const { container } = render(
      <AllowancePanel allowance={{ estimateCredits: null, minutes: 5, items: [
        { id: 'music', label: 'Generated music (ElevenLabs)', included: true, thirdParty: true, credits: null },
        { id: 'render', label: 'Render, mix and QA', included: true, thirdParty: false, credits: null },
      ] }} />,
    )
    expect(container.textContent).toContain('Included · 5 min')
    expect(container.textContent).not.toMatch(/ElevenLabs|Credits TBD|\$/)
  })

  it('setup offers the optional premium music tier from the contract', async () => {
    const client = createMockMotionStudioClient({ storage: null, seedExample: false })
    const p = await client.createProject({ workflow: 'idea', prompt: 'x', uploads: [], mediaPolicy: 'uploads_only', idempotencyKey: 'm1' })
    const onChange = vi.fn()
    const { rerender } = render(<SetupStep project={p} busy={null} onChange={onChange} onPlan={vi.fn()} />)
    fireEvent.click(screen.getByText('Premium score'))
    expect(onChange).toHaveBeenCalledWith({ music: 'elevenlabs' })
    const patched = await client.updateProject(p.id, { settings: { music: 'elevenlabs' } })
    rerender(<SetupStep project={patched} busy={null} onChange={onChange} onPlan={vi.fn()} />)
    expect(screen.getByTestId('ms-music-premium-note').textContent).toContain('never retries automatically')
  })

  it('timing note shows while scene times are estimates', async () => {
    const client = createMockMotionStudioClient({ storage: null, seedExample: false })
    const p = await client.createProject({ workflow: 'idea', prompt: 'Apollo', uploads: [], mediaPolicy: 'uploads_only', idempotencyKey: 't1' })
    await client.createPlan(p.id, 'p')
    render(<MotionStudioWorkspace projectId={p.id} client={client} pollMs={0} />)
    await waitFor(() => expect(screen.getAllByTestId('ms-timing-note').length).toBeGreaterThan(0))
  })
})
