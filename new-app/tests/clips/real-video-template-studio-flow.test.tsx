// @vitest-environment happy-dom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within, cleanup } from '@testing-library/react'
import type { VideoTemplateRelease } from '@/lib/clips/real-video-templates/gallery'

const { router, released, backend } = vi.hoisted(() => {
  const router = { push: vi.fn(), replace: vi.fn() }
  const release = {
    id: 'fixture_story', title: 'Fixture story', category: 'Editorial',
    description: 'Fixture for standalone studio integration, not a released asset',
    demoPath: '/test-fixtures/layout-main-red.mp4', demoPosterPath: '/placeholder.jpg',
    rights: 'Test-only media; not published', requiredCapabilities: [],
    authoredDimensions: ['font-hierarchy', 'text-placement', 'graphic-composition'],
    reviewed: true, previewRenderVerified: true,
    family: { schemaVersion: 1, familyId: 'two_scene', revision: 1, title: 'Two-scene story',
      tags: ['test'], aspects: ['9:16'], fps: 30, totalFrames: 60,
      slots: [
        { id: 'first', ordinal: 1, role: 'hero', media: 'image', startFrame: 0,
          durationFrames: 30, fit: 'cover', sourceAudio: 'mute', transition: 'cut' },
        { id: 'second', ordinal: 2, role: 'support', media: 'image', startFrame: 30,
          durationFrames: 30, fit: 'cover', sourceAudio: 'mute', transition: 'cut' },
      ],
      texts: [{ id: 'headline', defaultText: 'Original headline', maxChars: 100,
        startFrame: 0, durationFrames: 60, x: 50, y: 20, font: 'Anton',
        size: 48, color: '#ffffff' }],
      beatAnchors: [0, 30],
    },
    design: { schemaVersion: 1, designId: 'two_scene_treatment',
      revision: 1, stylePackId: 'fixture_pack', familyId: 'two_scene',
      familyRevision: 1, musicPolicy: 'none' },
  }
  const backend = {
    project: null as null | Record<string, any>,
    draft: null as null | Record<string, any>,
    renderCalls: 0,
    studioCalls: 0,
    exportCalls: 0,
  }
  return { router, released: [release], backend }
})
vi.mock('next/navigation', () => ({ useRouter: () => router }))
vi.mock('@/lib/clips/real-video-templates/releases', () => ({
  FIRST_PARTY_VIDEO_TEMPLATES: released,
}))
vi.mock('@/lib/clips/upload', () => ({
  uploadClipFile: vi.fn(async () => { throw new Error('Uploads are not needed in this library-media fixture') }),
}))
vi.mock('@/components/clips/editor/preview-stage', () => ({
  PreviewStage: ({ edits }: { edits: { textItems?: Array<{ text?: string }> } }) =>
    <div data-testid="template-native-preview">{edits.textItems?.[0]?.text ?? ''}</div>,
}))
import { VideoTemplatesGallery } from '@/components/clips/templates/video-templates-gallery'
import { VideoTemplateStudio } from '@/components/clips/templates/video-template-studio'

const license = { id: 'owned', provenance: 'user-owned', reference: 'workspace_upload' }
const media = [
  { asset: { id: 'photo_a', kind: 'image', license }, label: 'Photo A', durationMs: null,
    width: 800, height: 1200, url: '/photo-a.png', available: true },
  { asset: { id: 'photo_b', kind: 'image', license }, label: 'Photo B', durationMs: null,
    width: 800, height: 1200, url: '/photo-b.png', available: true },
  { asset: { id: 'photo_c', kind: 'image', license }, label: 'Photo C', durationMs: null,
    width: 800, height: 1200, url: '/photo-c.png', available: true },
]
const ok = (data: unknown) => Response.json({ data })
const detail = () => ({
  clip: { editsSaveVersion: backend.project?.editsSaveVersion ?? 0 },
  edits: { v: 2, trim: { in: 0, out: 2000 }, audio: { music: null },
    textItems: [{ text: backend.draft?.texts.headline || 'Original headline' }] },
  mediaUrls: { source: '/silent-carrier.mp4', proxy: null, preview: null, poster: null },
  media: null, crop: { track: null },
})
beforeEach(() => {
  backend.project = null
  backend.draft = null
  backend.renderCalls = 0
  backend.studioCalls = 0
  backend.exportCalls = 0
  router.push.mockClear()
  router.replace.mockClear()
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, any> : {}
    if (url.includes('/api/clips/video-templates/media?')) return ok({
      items: media, total: media.length, pages: 1, page: 1,
    })
    if (url === '/api/clips/video-templates/drafts' && method === 'POST') {
      backend.draft = { v: 1, releaseId: released[0].id,
        draftId: body.idempotencyKey, slots: {}, texts: {}, musicTiming: 'keep' }
      backend.project = { id: 'proj_fixture', version: 0, status: 'DRAFT',
        clipId: null, draft: backend.draft }
      return ok(backend.project)
    }
    if (url === '/api/clips/video-templates/drafts/proj_fixture' && method === 'GET')
      return ok({ ...backend.project, draft: backend.draft })
    if (url === '/api/clips/video-templates/drafts/proj_fixture' && method === 'PATCH') {
      if (body.expectedVersion !== backend.project?.version) return Response.json({ error: 'Conflict' }, { status: 409 })
      backend.draft = body.draft
      backend.project = { ...backend.project, draft: body.draft, version: backend.project.version + 1 }
      return ok(backend.project)
    }
    if (url === '/api/clips/video-templates/drafts/proj_fixture/publish' && method === 'POST') {
      backend.project = { ...backend.project, status: 'READY', clipId: 'clip_fixture',
        editsSaveVersion: 0 }
      return ok({ projectId: 'proj_fixture', clipId: 'clip_fixture', status: 'READY' })
    }
    if (url === '/api/clips/clips/clip_fixture' && method === 'GET') return ok(detail())
    if (url === '/api/clips/projects/proj_fixture/library' && method === 'GET')
      return ok({ items: media.map(item => ({ refId: item.asset.id, url: item.url })) })
    if (url === '/api/clips/video-templates/drafts/proj_fixture/studio' && method === 'PATCH') {
      if (body.expectedVersion !== backend.project?.version ||
          body.expectedEditsSaveVersion !== backend.project.editsSaveVersion)
        return Response.json({ error: 'Conflict' }, { status: 409 })
      backend.studioCalls++
      backend.draft = body.draft
      backend.project = { ...backend.project, draft: body.draft,
        version: backend.project.version + 1,
        editsSaveVersion: backend.project.editsSaveVersion + 1 }
      return ok({ version: backend.project.version,
        editsSaveVersion: backend.project.editsSaveVersion })
    }
    if (url === '/api/clips/clips/clip_fixture/export' && method === 'POST') {
      backend.exportCalls++
      expect(body).toMatchObject({ resolution: '720p', format: 'mp4', aspect: '9:16' })
      return ok({ renderId: 'render_fixture', status: 'QUEUED' })
    }
    if (url === '/api/clips/renders/render_fixture' && method === 'GET') {
      backend.renderCalls++
      return ok({ id: 'render_fixture', status: 'READY', progress: 100,
        phase: null, error: null, filename: 'template.mp4',
        downloadUrl: '/signed-template.mp4' })
    }
    throw new Error('Unexpected request ' + method + ' ' + url)
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Batch 4 standalone gallery → slots → preview → save/reload → export', () => {
  it('preserves slot neighbors, persisted text and render state through a complete UI journey', async () => {
    const gallery = render(<VideoTemplatesGallery />)
    expect(screen.getByRole('link', { name: 'Use template' }).getAttribute('href'))
      .toBe('/app/clips/video-templates/fixture_story')
    expect(screen.getByText(/0 video ·/).textContent).toContain('2 photos')
    fireEvent.click(screen.getByText('Exact slot lengths and editable fields'))
    expect(screen.getByText(/Slot 1: image/).textContent).toContain('1.00s output')
    gallery.unmount()
    const first = render(<VideoTemplateStudio release={released[0] as unknown as VideoTemplateRelease} />)
    await screen.findByRole('button', { name: 'Use Photo A' })
    fireEvent.click(screen.getByRole('button', { name: 'Use Photo A' }))
    const slots = within(screen.getByRole('group', { name: 'Select a template slot' }))
      .getAllByRole('button')
    fireEvent.click(slots[1]!)
    fireEvent.click(screen.getByRole('button', { name: 'Use Photo B' }))
    expect(screen.getByText('2 of 2 filled')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Prepare full preview and project' }))
    expect(await screen.findByTestId('template-native-preview')).toBeTruthy()
    expect(backend.project?.id).toBe('proj_fixture')
    expect(backend.draft?.slots.first.asset.id).toBe('photo_a')
    expect(backend.draft?.slots.second.asset.id).toBe('photo_b')

    fireEvent.change(screen.getByLabelText(/headline.*maximum 100 characters/), {
      target: { value: 'An edited headline' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }))
    await waitFor(() => expect(backend.draft?.texts.headline).toBe('An edited headline'))
    await waitFor(() => expect(screen.getByTestId('template-native-preview').textContent)
      .toBe('An edited headline'))
    first.unmount()

    const resumed = render(<VideoTemplateStudio
      release={released[0] as unknown as VideoTemplateRelease} initialProjectId="proj_fixture" />)
    await waitFor(() => expect(screen.getByTestId('template-native-preview').textContent)
      .toBe('An edited headline'))
    expect((screen.getByLabelText(/headline.*maximum 100 characters/) as HTMLInputElement).value)
      .toBe('An edited headline')

    const reloadedSlots = within(screen.getByRole('group', { name: 'Select a template slot' }))
      .getAllByRole('button')
    fireEvent.click(reloadedSlots[1]!)
    fireEvent.click(screen.getByRole('button', { name: 'Use Photo C' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }))
    await waitFor(() => expect(backend.draft?.slots.second.asset.id).toBe('photo_c'))
    expect(backend.draft?.slots.first.asset.id).toBe('photo_a')
    expect(backend.studioCalls).toBeGreaterThanOrEqual(2)

    fireEvent.click(screen.getByRole('button', { name: /Save and export video/ }))
    expect((await screen.findByRole('link', { name: 'Download video' })).getAttribute('href'))
      .toBe('/signed-template.mp4')
    expect(backend.exportCalls).toBe(1)
    expect(backend.renderCalls).toBeGreaterThan(0)
    resumed.unmount()
  })
})
