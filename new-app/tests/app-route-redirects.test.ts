// @ts-expect-error vitest is resolved in new-app; root tsc has no vitest types
import { describe, expect, it } from 'vitest'
import { applyAppRouteRedirect, STAY_PATHS } from '../lib/app-route-redirects.mjs'

describe('applyAppRouteRedirect', () => {
  it('maps the §9 table to 308 destinations', () => {
    const cases: Array<[string, string, string]> = [
      ['/app/home', '', '/app'],
      ['/app/editor', '', '/app/video-editor'],
      ['/app/editor/proj_1/edit/clip_1', '', '/app/video-editor/proj_1/edit/clip_1'],
      ['/app/clips/proj_1/edit/clip_1', '', '/app/video-editor/proj_1/edit/clip_1'],
      ['/app/clips/proj_1/studio/clip_1', '', '/app/video-editor/proj_1/studio/clip_1'],
      ['/app/clips/proj_1/script', '', '/app/video-editor/proj_1/script'],
      ['/app/clips/new', 'intent=full', '/app/video-editor/new?intent=full'],
      ['/app/clips/video/new', '', '/app/ai-video/new'],
      ['/app/clips/video/templates', '', '/app/ai-video/templates'],
      ['/app/clips/video', '', '/app/ai-video/new'],
      ['/app/clips/proj_t2v/video', '', '/app/ai-video/proj_t2v'],
    ]
    for (const [path, search, location] of cases) {
      expect(applyAppRouteRedirect(path, search), `${path}?${search}`).toEqual({ status: 308, location })
    }
  })

  it('preserves extra query keys and leftover intent=full', () => {
    expect(applyAppRouteRedirect('/app/home', 'tab=recents')).toEqual({
      status: 308,
      location: '/app?tab=recents',
    })
    expect(applyAppRouteRedirect('/app/clips/proj_1/edit/clip_1', 't=1200&panel=captions')).toEqual({
      status: 308,
      location: '/app/video-editor/proj_1/edit/clip_1?t=1200&panel=captions',
    })
    expect(applyAppRouteRedirect('/app/clips/new', 'intent=full&source=drive')).toEqual({
      status: 308,
      location: '/app/video-editor/new?intent=full&source=drive',
    })
  })

  it('lets more-specific sources win over /app/clips/:projectId/video', () => {
    expect(applyAppRouteRedirect('/app/clips/video/new')).toEqual({
      status: 308,
      location: '/app/ai-video/new',
    })
    expect(applyAppRouteRedirect('/app/clips/video/templates')).toEqual({
      status: 308,
      location: '/app/ai-video/templates',
    })
    expect(applyAppRouteRedirect('/app/clips/video')).toEqual({
      status: 308,
      location: '/app/ai-video/new',
    })
    expect(applyAppRouteRedirect('/app/clips/abc/video')).toEqual({
      status: 308,
      location: '/app/ai-video/abc',
    })
  })

  it('does not redirect /app itself or stay paths', () => {
    expect(applyAppRouteRedirect('/app')).toBeNull()
    expect(applyAppRouteRedirect('/app/clips/new')).toBeNull()
    expect(applyAppRouteRedirect('/app/clips/new', 'source=drive')).toBeNull()
    for (const path of STAY_PATHS) {
      expect(applyAppRouteRedirect(path), path).toBeNull()
    }
  })
})
