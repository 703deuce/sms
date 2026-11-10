import { describe, it, expect } from 'vitest'
import {
  buildSidebarNav,
  createMenuItems,
  activeSidebarId,
  clipsProjectId,
  isClipEditRoute,
  SIDEBAR_HIDDEN_HREFS,
} from '@/lib/sidebar-nav'
import { resolveSidebarOpen } from '@/lib/sidebar-open-state'

const ALL = { recording: true, soloRecording: false, scriptEditor: false, t2v: true }

describe('sidebar model', () => {
  it('order and groups', () => {
    expect(buildSidebarNav(ALL).map((i) => i.id)).toEqual([
      'home',
      'clips',
      'streamer',
      'editor',
      'youtube-video',
      'captions',
      'record',
      'ai-video',
      'studio',
      'ad-studio',
      'media',
      'brand',
      'templates',
      'exports',
      'learn',
      'settings',
    ])
  })
  it('hrefs', () => {
    const h = Object.fromEntries(buildSidebarNav(ALL).map((i) => [i.id, i.href]))
    expect(h).toMatchObject({
      home: '/app',
      clips: '/app/clips/new',
      editor: '/app/video-editor',
      'youtube-video': '/app/youtube-video',
      captions: '/app/captions',
      studio: '/app/studio',
      'ad-studio': '/app/ad-studio',
      record: '/app/rooms/new',
      'ai-video': '/app/ai-video/new',
      templates: '/app/clips/templates',
      brand: '/app/clips/brand',
      exports: '/app/exports',
      media: '/app/clips/media',
    })
  })
  it('record merges rooms; solo wins', () => {
    expect(buildSidebarNav({ ...ALL, soloRecording: true }).find((i) => i.id === 'record')?.href).toBe('/app/record')
    expect(buildSidebarNav({ ...ALL, recording: false, soloRecording: false }).some((i) => i.id === 'record')).toBe(
      false,
    )
  })
  it('t2v off hides AI Video', () => {
    expect(buildSidebarNav({ ...ALL, t2v: false }).some((i) => i.id === 'ai-video')).toBe(false)
  })
  it('exactly one Templates and no hidden hrefs', () => {
    const items = buildSidebarNav(ALL)
    expect(items.filter((i) => /templates/i.test(i.label))).toHaveLength(1)
    for (const h of SIDEBAR_HIDDEN_HREFS) expect(items.some((i) => i.href === h)).toBe(false)
  })
  it('create menu', () => {
    const items = createMenuItems(ALL)
    expect(items.map((i: { label: string }) => i.label)).toEqual([
      'Clip',
      'Stream clip',
      'Editor project',
      'YouTube Video',
      'Recording',
      'AI Video',
      'AI Studio',
    ])
    expect(Object.fromEntries(items.map((i: { id: string; href: string }) => [i.id, i.href]))).toMatchObject({
      'create-clip': '/app/clips/new',
      'create-editor': '/app/video-editor/new',
      'create-youtube-video': '/app/youtube-video',
      'create-ai-video': '/app/ai-video/new',
      'create-studio': '/app/studio',
    })
    expect(createMenuItems({ ...ALL, scriptEditor: true }).find((i: { id: string; href: string }) => i.id === 'create-editor')?.href).toBe(
      '/app/video-editor',
    )
  })
  it.each([
    ['/app', '', 'home'],
    ['/app/home', '', 'home'],
    ['/app/dashboard', '', 'home'],
    ['/app/clips', '', 'clips'],
    ['/app/clips', 'kind=video', 'ai-video'],
    ['/app/clips', 'view=recents', 'clips'],
    ['/app/clips/trash', '', 'clips'],
    ['/app/clips/abc123', '', 'clips'],
    ['/app/clips/new', '', 'clips'],
    ['/app/clips/abc/edit/c1', '', 'editor'],
    ['/app/clips/abc/script', '', 'editor'],
    ['/app/captions', '', 'captions'],
    ['/app/editor', '', 'editor'],
    ['/app/video-editor', '', 'editor'],
    ['/app/video-editor/abc/edit/c1', '', 'editor'],
    ['/app/video-editor/abc/studio/c1', '', 'editor'],
    ['/app/video-editor/abc/script', '', 'editor'],
    ['/app/ai-video/new', '', 'ai-video'],
    ['/app/ai-video/proj_t2v', 'mode=storyboard', 'ai-video'],
    ['/app/clips/templates', 'tab=layouts&sub=mine', 'templates'],
    ['/app/clips/templates', 'tab=ai-video', 'templates'],
    ['/app/clips/video/templates', '', 'templates'],
    ['/app/clips/brand', 'tab=templates', 'brand'],
    ['/app/clips/brand', 'id=t1', 'brand'],
    ['/app/clips/media', '', 'media'],
    ['/app/clips/exports', '', 'exports'],
    ['/app/exports', '', 'exports'],
    ['/app/clips/video/new', '', 'ai-video'],
    ['/app/ai-video/templates', '', 'templates'],
    ['/app/rooms', '', 'record'],
    ['/app/record', '', 'record'],
    ['/app/youtube-video', '', 'youtube-video'],
    ['/app/studio', '', 'studio'],
    ['/app/ad-studio', '', 'ad-studio'],
    ['/app/streamer', '', 'streamer'],
    ['/app/settings/billing', '', 'settings'],
    ['/app/help', '', 'learn'],
    ['/app/sw', '', null],
  ])('active %s?%s -> %s', (p, q, id) => {
    expect(activeSidebarId(p, q)).toBe(id)
  })
  it('clipsProjectId ignores reserved segments', () => {
    for (const s of ['new', 'templates', 'media', 'trash', 'brand', 'exports', 'video']) {
      expect(clipsProjectId(`/app/clips/${s}`)).toBeNull()
    }
    expect(clipsProjectId('/app/clips/cm123')).toBe('cm123')
  })
  it('isClipEditRoute', () => {
    expect(isClipEditRoute('/app/clips/p/edit/c')).toBe(true)
    expect(isClipEditRoute('/app/video-editor/p/edit/c')).toBe(true)
    expect(isClipEditRoute('/app/clips/p')).toBe(false)
    expect(isClipEditRoute('/app/video-editor/p/studio/c')).toBe(false)
  })
  it('open state: forced rail never persists, toggle still works', () => {
    expect(resolveSidebarOpen({ pref: true, override: null, forcedRail: true })).toBe(false)
    expect(resolveSidebarOpen({ pref: true, override: true, forcedRail: true })).toBe(true)
    expect(resolveSidebarOpen({ pref: false, override: null, forcedRail: false })).toBe(false)
    expect(resolveSidebarOpen({ pref: true, override: null, forcedRail: false })).toBe(true)
  })
})
