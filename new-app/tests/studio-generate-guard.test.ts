// @ts-expect-error vitest is resolved in new-app; root tsc has no vitest types
import { describe, expect, it, vi } from 'vitest'

import { createStudioController } from '../lib/ai-studio/controller'
import { createDevStudioFallback } from '../lib/ai-studio/fallback'
import { generateButtonLabel } from '../lib/ai-studio/format'

function readyController(opts?: { sleep?: (ms: number) => Promise<void> }) {
  const backend = createDevStudioFallback()
  const ctrl = createStudioController({
    client: backend,
    pollMs: 5,
    sleep: opts?.sleep ?? (async () => {}),
    listProjects: async () => [{ id: 'proj_1', title: 'Cut 1' }],
  })
  return { backend, ctrl }
}

describe('studio generate guard and settings', () => {
  it('locks a second generate while the first is in flight', async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => {
      release = r
    })
    const { backend, ctrl } = readyController({ sleep: async () => {} })
    await ctrl.load()
    const orig = backend.createJob.bind(backend)
    const spy = vi.fn(async (body: Parameters<typeof orig>[0]) => {
      await gate
      const job = await orig(body)
      return backend.advanceJob(job.id, 'done')
    })
    backend.createJob = spy
    ctrl.setPrompt('A rainy street at night')
    const first = ctrl.generate()
    expect(ctrl.getState().submitLocked).toBe(true)
    const second = await ctrl.generate()
    expect(second).toEqual({ ok: false, ignored: true })
    release()
    await first
    expect(spy).toHaveBeenCalledTimes(1)
    ctrl.destroy()
  })

  it('labels generate with placeholder credits and never $', async () => {
    const { ctrl } = readyController()
    await ctrl.load()
    ctrl.setModel('seedance-2.0-mini')
    const s = ctrl.getState()
    expect(s.generateLabel).toBe(generateButtonLabel(s.creditEstimate))
    expect(s.generateLabel).toMatch(/credits/)
    expect(s.generateLabel).not.toMatch(/\$/)
    expect(s.canSubmit).toBe(false)
    expect(s.submitBlockedReason).toMatch(/prompt/i)
    ctrl.setPrompt('neon alley')
    expect(ctrl.getState().canSubmit).toBe(true)
    ctrl.destroy()
  })

  it('requires a reference for image-to-video and swaps start/end frames', async () => {
    const { ctrl } = readyController()
    await ctrl.load()
    ctrl.setMode('image_to_video')
    ctrl.setPrompt('animate this')
    expect(ctrl.getState().submitBlockedReason).toMatch(/reference or start frame/i)
    const start = new Blob(['a'], { type: 'image/png' })
    const end = new Blob(['b'], { type: 'image/png' })
    ctrl.setAsset('start_frame', start, { name: 'start.png', type: 'image/png' })
    ctrl.setAsset('end_frame', end, { name: 'end.png', type: 'image/png' })
    expect(ctrl.getState().form.assets.start_frame?.name).toBe('start.png')
    ctrl.swapFrames()
    expect(ctrl.getState().form.assets.start_frame?.name).toBe('end.png')
    expect(ctrl.getState().form.assets.end_frame?.name).toBe('start.png')
    expect(ctrl.getState().canSubmit).toBe(true)
    ctrl.destroy()
  })

  it('persists valid settings across model switches and clamps invalid ones', async () => {
    const { ctrl } = readyController()
    await ctrl.load()
    ctrl.setModel('seedance-2.0-mini')
    ctrl.setAspect('1:1')
    ctrl.setDurationSec(15)
    ctrl.setResolution('720p')
    ctrl.setModel('veo-3.1-lite')
    const form = ctrl.getState().form
    expect(form.aspect).toBe('9:16') // 1:1 not on Veo; clamp to first supported
    expect(form.durationSec).toBe(4) // 15s is not on Veo; clamp to first supported
    expect(form.resolution).toBe('720p')
    ctrl.destroy()
  })

  it('reuse settings fills the form and does not create a job', async () => {
    const { backend, ctrl } = readyController()
    await ctrl.load()
    const created = await backend.createJob({
      modelId: 'flux-2-pro',
      mode: 'text_to_image',
      prompt: 'studio lamp',
      aspect: '1:1',
      resolution: '1K',
    })
    const spy = vi.spyOn(backend, 'createJob')
    ctrl.setPrompt('something else')
    ctrl.reuseSettings(created)
    const form = ctrl.getState().form
    expect(form.prompt).toBe('studio lamp')
    expect(form.modelId).toBe('flux-2-pro')
    expect(form.mode).toBe('text_to_image')
    expect(spy).not.toHaveBeenCalled()
    ctrl.destroy()
  })
})
