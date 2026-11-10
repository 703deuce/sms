// @ts-expect-error vitest is resolved in new-app; root tsc has no vitest types
import { describe, expect, it, vi } from 'vitest'

import { createStudioController } from '../lib/ai-studio/controller'
import { createDevStudioFallback } from '../lib/ai-studio/fallback'

describe('studio job polling', () => {
  it('polls until done and stops, mapping a failed job error honestly', async () => {
    const backend = createDevStudioFallback()
    const ticks: Array<() => void> = []
    const sleep = () => new Promise<void>((r) => ticks.push(r))
    const ctrl = createStudioController({ client: backend, pollMs: 1, sleep, listProjects: async () => [] })
    await ctrl.load()
    ctrl.setPrompt('a forest path')
    const run = ctrl.generate()
    await vi.waitFor(() => expect(ctrl.getState().activeJob).toBeTruthy())
    const id = ctrl.getState().activeJob!.id
    expect(ctrl.getState().phase).toBe('polling')
    backend.advanceJob(id, 'running')
    ticks.shift()?.()
    await vi.waitFor(() => expect(ctrl.getState().activeJob?.status).toBe('running'))
    backend.advanceJob(id, 'done')
    ticks.shift()?.()
    await run
    expect(ctrl.getState().activeJob?.status).toBe('done')
    expect(ctrl.getState().phase).toBe('done')
    expect(ctrl.getState().submitLocked).toBe(false)

    const failed = await backend.createJob({ modelId: 'flux-2-pro', mode: 'text_to_image', prompt: 'xxy' })
    backend.advanceJob(failed.id, 'failed')
    const latest = await backend.getJob(failed.id)
    expect(latest.error?.code).toBe('KIE_ERROR')
    ctrl.destroy()
  })
})
