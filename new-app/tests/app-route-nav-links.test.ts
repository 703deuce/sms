// @ts-expect-error vitest is resolved in new-app; root tsc has no vitest types
import { describe, expect, it } from 'vitest'
import { createMenuItems, buildSidebarNav, isClipEditRoute } from '../lib/sidebar-nav'
import { resolveContext, WORKSPACE, CLIPS } from '../lib/nav'

const ALL = { recording: true, soloRecording: false, scriptEditor: false, t2v: true }

describe('nav links after /app restructure', () => {
  it('sidebar and create menu point at the new destinations', () => {
    const hrefs = Object.fromEntries(buildSidebarNav(ALL).map((i) => [i.id, i.href]))
    expect(hrefs.home).toBe('/app')
    expect(hrefs.editor).toBe('/app/video-editor')
    expect(hrefs['ai-video']).toBe('/app/ai-video/new')
    const create = Object.fromEntries(createMenuItems(ALL).map((i) => [i.id, i.href]))
    expect(create['create-editor']).toBe('/app/video-editor/new')
    expect(create['create-ai-video']).toBe('/app/ai-video/new')
    expect(create['create-clip']).toBe('/app/clips/new')
  })

  it('resolveContext treats dashboard as workspace and editor/t2v as product chrome', () => {
    expect(resolveContext('/app')).toBe(WORKSPACE)
    expect(resolveContext('/app/home')).toBe(WORKSPACE)
    expect(resolveContext('/app/video-editor')).toBe(CLIPS)
    expect(resolveContext('/app/video-editor/p/edit/c')).toBe(CLIPS)
    expect(resolveContext('/app/ai-video/new')).toBe(CLIPS)
    expect(resolveContext('/app/clips')).toBe(CLIPS)
  })

  it('isClipEditRoute covers the moved editor path so chrome stays immersive', () => {
    expect(isClipEditRoute('/app/video-editor/p/edit/c')).toBe(true)
    expect(isClipEditRoute('/app/clips/p/edit/c')).toBe(true)
    expect(isClipEditRoute('/app/video-editor/p/story/c')).toBe(true)
    expect(isClipEditRoute('/app/video-editor/p/templates/c')).toBe(true)
    expect(isClipEditRoute('/app/video-editor/p/generate/c')).toBe(true)
    expect(isClipEditRoute('/app/video-editor/p/chat/c')).toBe(true)
    expect(isClipEditRoute('/app/video-editor/p/studio/c')).toBe(false)
  })
})
