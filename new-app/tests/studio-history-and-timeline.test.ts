// @ts-expect-error vitest is resolved in new-app; root tsc has no vitest types
import { describe, expect, it, vi } from 'vitest'

import { createStudioController, visibleHistory } from '../lib/ai-studio/controller'
import { createDevStudioFallback } from '../lib/ai-studio/fallback'
import { editorProjectHref } from '../lib/ai-studio/format'

describe('studio history and send-to-timeline', () => {
  it('merges history, filters it, and sends a done job to a project', async () => {
    const backend = createDevStudioFallback({ knownProjectIds: ['proj_1'] })
    const a = await backend.createJob({ modelId: 'flux-2-pro', mode: 'text_to_image', prompt: 'alpha' })
    const b = await backend.createJob({ modelId: 'seedance-2.0-mini', mode: 'text_to_video', prompt: 'beta' })
    backend.advanceJob(a.id, 'done')
    const ctrl = createStudioController({
      client: backend,
      sleep: async () => {},
      listProjects: async () => [{ id: 'proj_1', title: 'Cut 1' }],
    })
    await ctrl.load()
    expect(ctrl.getState().history.map((j) => j.id).sort()).toEqual([a.id, b.id].sort())
    ctrl.setHistoryFilter({ kind: 'image' })
    expect(visibleHistory(ctrl.getState()).map((j) => j.id)).toEqual([a.id])
    await expect(ctrl.sendToTimeline(b.id, 'proj_1')).resolves.toEqual({ ok: false })
    expect(ctrl.getState().sendError?.kind).toBe('JOB_NOT_READY')
    const sent = await ctrl.sendToTimeline(a.id, 'proj_1')
    expect(sent).toEqual({ ok: true })
    expect(ctrl.getState().sendResult?.href).toBe(editorProjectHref('proj_1', ctrl.getState().sendResult!.clipId))
    const ignored = await Promise.all([ctrl.sendToTimeline(a.id, 'proj_1'), ctrl.sendToTimeline(a.id, 'proj_1')])
    expect(ignored.some((r) => r.ignored)).toBe(true)
    ctrl.destroy()
  })
})
