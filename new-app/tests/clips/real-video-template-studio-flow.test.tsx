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
const provisionedMusic = {
  id: 'tpl_audio_fixture',
  kind: 'audio' as const,
  durationFrames: 480,
  license: { id: 'batch9a_first_party', provenance: 'first-party' as const, reference: 'batch9a-audio-v2' },
}
vi.mock('@/components/clips/editor/preview-stage', () => ({
  PreviewStage: ({ edits }: { edits: { textItems?: Array<{ text?: string }> } }) =>
    <div data-testid="template-native-preview">{edits.textItems?.[0]?.text ?? ''}</div>,
}))
import { VideoTemplatesGallery } from '@/components/clips/templates/video-templates-gallery'
import { VideoTemplateStudio } from '@/components/clips/templates/video-template-studio'
import { uploadClipFile } from '@/lib/clips/upload'

const license = { id: 'owned', provenance: 'user-owned', reference: 'workspace_upload' }
const BATCH9A_HASH = 'c418b398ea7dc14a92a16596b7687d190735e1f14947bc954e357d62ba6f1482'
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
  edits: { v: 2, trim: { in: 0, out: 2000 }, audio: { music: backend.draft?.music ? {
      generationId: backend.draft.music.id, uploadId: backend.draft.music.id,
      startMs: 0, endMs: 2000, loop: false, volume: 0.35, fadeInMs: 200, fadeOutMs: 300,
    } : null },
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
  vi.mocked(uploadClipFile).mockImplementation(async () => { throw new Error('Uploads are not needed in this library-media fixture') })
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
    if (url === '/api/clips/video-templates/drafts/proj_fixture/default-music' && method === 'POST') {
      backend.draft = {
        ...(backend.draft ?? {}),
        music: provisionedMusic,
        templateMusic: {
          v: 1,
          choice: 'keep-timing',
          acceptLoop: false,
          rights: {
            assetId: provisionedMusic.id,
            origin: 'first-party-generated',
            author: 'Transovo AI',
            license: 'Transovo first-party original template music',
            revision: 'batch9a-audio-v2',
            sha256: BATCH9A_HASH,
            commercialUse: true,
            exportAllowed: true,
            redistributionAllowed: true,
            verifiedDurationFrames: 480,
            verifiedAt: 'batch9a-audio-v2',
          },
          schedule: {
            v: 1,
            mode: 'beat-time',
            musicAssetId: provisionedMusic.id,
            sha256: BATCH9A_HASH,
            bpm: 150,
            confidence: 'manual',
            offsetFrames: 0,
            durationFrames: 480,
            beats: [0, 3, 6, 9],
            phrases: [],
            protectedAnchors: [],
          },
        },
        musicRightsConfirmed: true,
        musicTiming: 'keep',
      }
      backend.project = { ...backend.project!, draft: backend.draft, version: (backend.project?.version ?? 0) + 1 }
      return ok(backend.project)
    }
    if (url === '/api/clips/video-templates/drafts/proj_fixture' && method === 'PATCH') {
      const project = backend.project
      if (!project || body.expectedVersion !== project.version) return Response.json({ error: 'Conflict' }, { status: 409 })
      backend.draft = body.draft
      backend.project = { ...project, draft: body.draft, version: project.version + 1 }
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
      const project = backend.project
      if (!project || body.expectedVersion !== project.version ||
          body.expectedEditsSaveVersion !== project.editsSaveVersion)
        return Response.json({ error: 'Conflict' }, { status: 409 })
      backend.studioCalls++
      backend.draft = body.draft
      backend.project = { ...project, draft: body.draft,
        version: project.version + 1,
        editsSaveVersion: project.editsSaveVersion + 1 }
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
    expect(screen.getByTestId('video-template-preview-frame')).toBeTruthy()
    expect(backend.project?.id).toBe('proj_fixture')
    expect(backend.draft?.slots.first.asset.id).toBe('photo_a')
    expect(backend.draft?.slots.second.asset.id).toBe('photo_b')

    fireEvent.change(screen.getByLabelText(/headline.*maximum 100 characters/), {
      target: { value: 'An edited headline' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^Save$/ }))
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
    fireEvent.click(screen.getByRole('button', { name: /^Save$/ }))
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

  it('provisions the Batch 9A first-party beat bed before composed preview and worker export', async () => {
    const release = released[0] as any
    const previous = {
      policy: release.design.musicPolicy,
      defaultMusic: release.defaultMusic,
      musicRequired: release.musicRequired,
      certificationStatus: release.certificationStatus,
      reviewed: release.reviewed,
      verified: release.previewRenderVerified,
    }
    const hash='c418b398ea7dc14a92a16596b7687d190735e1f14947bc954e357d62ba6f1482'
    const audio = {
      asset:{id:'generated_audio',kind:'audio',durationFrames:480,license},
      label:'Batch 9A pulse bed',durationMs:16000,width:null,height:null,
      url:'/batch9a-groove.wav',available:true,
    }
    release.design.musicPolicy='licensed-only'
    release.defaultMusic={
      id:'batch9a_anchor_groove_v2',generator:'batch9a-groove-v2',sha256:hash,
      durationFrames:480,bpm:150,beatEveryFrames:3,author:'Transovo AI',
      license:'Transovo first-party original template music',revision:'batch9a-audio-v2',
    }
    release.musicRequired=true
    release.certificationStatus='preview'
    release.reviewed=false
    release.previewRenderVerified=false
    media.push(audio as any)
    media.push({
      asset: provisionedMusic,
      label: 'Batch 9A groove bed',
      durationMs: 16000,
      width: null,
      height: null,
      url: '/batch9a-groove-v2.wav',
      available: true,
    } as any)
    try {
      render(<VideoTemplateStudio release={release as VideoTemplateRelease} />)
      await screen.findByText('First-party beat-synced soundtrack ready')
      expect(uploadClipFile).not.toHaveBeenCalled()
      await screen.findByRole('button',{name:'Use Photo A'})
      fireEvent.click(screen.getByRole('button',{name:'Use Photo A'}))
      const slots=within(screen.getByRole('group',{name:'Select a template slot'})).getAllByRole('button')
      fireEvent.click(slots[1]!)
      fireEvent.click(screen.getByRole('button',{name:'Use Photo B'}))
      await waitFor(()=>expect(screen.getByRole('button',{name:'Prepare full preview and project'}).hasAttribute('disabled')).toBe(false))
      fireEvent.click(screen.getByRole('button',{name:'Prepare full preview and project'}))
      expect(await screen.findByTestId('template-native-preview')).toBeTruthy()
      expect(backend.draft?.templateMusic?.rights.sha256).toBe(hash)
      expect(backend.draft?.templateMusic?.schedule.beats.slice(0,4)).toEqual([0,3,6,9])
      expect(screen.getByLabelText('Template soundtrack preview')).toBeTruthy()
      fireEvent.click(screen.getByRole('button',{name:/Save and export video/}))
      expect((await screen.findByRole('link',{name:'Download video'})).getAttribute('href'))
        .toBe('/signed-template.mp4')
      expect(backend.exportCalls).toBe(1)
    } finally {
      media.pop()
      release.design.musicPolicy=previous.policy
      release.defaultMusic=previous.defaultMusic
      release.musicRequired=previous.musicRequired
      release.certificationStatus=previous.certificationStatus
      release.reviewed=previous.reviewed
      release.previewRenderVerified=previous.verified
    }
  })
})
