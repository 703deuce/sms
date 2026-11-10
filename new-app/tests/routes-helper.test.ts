// @ts-expect-error vitest is resolved in new-app; root tsc has no vitest types
import { describe, expect, it } from 'vitest'
import { routes, withQuery } from '../lib/routes'

describe('routes helper', () => {
  it('builds canonical SaaS hrefs', () => {
    expect(routes.app()).toBe('/app')
    expect(routes.clips()).toBe('/app/clips')
    expect(routes.clipsNew()).toBe('/app/clips/new')
    expect(routes.project('proj_1')).toBe('/app/clips/proj_1')
    expect(routes.videoEditor()).toBe('/app/video-editor')
    expect(routes.videoEditorNew()).toBe('/app/video-editor/new')
    expect(routes.edit('proj_1', 'clip_1')).toBe('/app/video-editor/proj_1/edit/clip_1')
    expect(routes.studio('proj_1', 'clip_1')).toBe('/app/video-editor/proj_1/studio/clip_1')
    expect(routes.script('proj_1')).toBe('/app/video-editor/proj_1/script')
    expect(routes.aiVideo('proj_1')).toBe('/app/ai-video/proj_1')
    expect(routes.aiVideoNew()).toBe('/app/ai-video/new')
    expect(routes.aiVideoTemplates()).toBe('/app/ai-video/templates')
  })

  it('withQuery preserves keys on helpers', () => {
    expect(withQuery(routes.app(), { tab: 'recents' })).toBe('/app?tab=recents')
    expect(routes.edit('p', 'c', { t: '12' })).toBe('/app/video-editor/p/edit/c?t=12')
    expect(routes.script('p', 'comment=thr_1')).toBe('/app/video-editor/p/script?comment=thr_1')
    expect(routes.aiVideoNew({ template: 't1' })).toBe('/app/ai-video/new?template=t1')
  })
})
