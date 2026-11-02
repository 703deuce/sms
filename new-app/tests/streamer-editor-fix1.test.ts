import { describe, expect, it } from 'vitest'
import {
  editorMediaLoadFallbacks,
  resolveEditorClipMedia,
  streamerPrefersClipSegmentMedia,
} from '@/lib/server/clips/editor-clip-media'
import { resolveClipSourceMediaKey } from '@/lib/server/clips/clip-source-media'

const segUrl = 'https://cdn.example/seg.mp4'
const uploadUrl = 'https://cdn.example/upload/source.mp4'
const proxyUrl = 'https://cdn.example/proxy.mp4'

describe('STREAMER_editor_fix1 editor media resolver', () => {
  const base = {
    proxyKey: null as string | null,
    signedProxy: null as string | null,
    sourceKey: 'ws/ws_1/uploads/upl_x/source.mp4',
    signedSource: uploadUrl,
    segmentExists: true,
    signedSourceSeg: segUrl,
    sourceSegStartMs: 142_170,
    sourceSegEndMs: 226_006,
    previewKey: 'ws/ws_1/projects/p/clips/c/preview.mp4',
    signedPreview: 'https://cdn.example/preview.mp4',
    clipStartMs: 172_170,
    clipEndMs: 201_405,
  }

  it('prefers clip segment for stream VOD when upload source is missing', () => {
    expect(
      streamerPrefersClipSegmentMedia({
        hasStreamVod: true,
        bulkyStoragePurged: false,
        proxyKey: null,
        sourceSegKey: 'ws/.../source_seg.mp4',
      }),
    ).toBe(true)

    const media = resolveEditorClipMedia({
      ...base,
      uploadSourcePresent: false,
      preferClipSegment: true,
    })
    expect(media).toEqual({
      url: segUrl,
      kind: 'segment',
      offsetMs: 142_170,
      minMs: 142_170,
      maxMs: 226_006,
    })
  })

  it('uses upload source when present and not forced to segment', () => {
    const media = resolveEditorClipMedia({
      ...base,
      uploadSourcePresent: true,
      preferClipSegment: false,
    })
    expect(media).toEqual({ url: uploadUrl, kind: 'source', offsetMs: 0 })
  })

  it('regular clip with proxy unchanged', () => {
    const media = resolveEditorClipMedia({
      ...base,
      proxyKey: 'ws/ws_1/projects/p/proxy.mp4',
      signedProxy: proxyUrl,
      uploadSourcePresent: true,
      preferClipSegment: false,
    })
    expect(media).toEqual({ url: proxyUrl, kind: 'proxy', offsetMs: 0 })
  })

  it('client fallback from failed source tries segment before composite preview', () => {
    const primary = { url: uploadUrl, kind: 'source' as const, offsetMs: 0 }
    const fallbacks = editorMediaLoadFallbacks(
      primary,
      {
        preview: base.signedPreview,
        poster: null,
        proxy: null,
        source: uploadUrl,
        segment: segUrl,
      },
      {
        sourceSegStartMs: base.sourceSegStartMs,
        sourceSegEndMs: base.sourceSegEndMs,
        clipStartMs: base.clipStartMs,
        clipEndMs: base.clipEndMs,
      },
    )
    expect(fallbacks[0]).toMatchObject({ url: segUrl, kind: 'segment', offsetMs: 142_170 })
    expect(fallbacks[1]?.kind).toBe('composite')
  })

  it('export / studio sound resolves retained segment key first', () => {
    const key = resolveClipSourceMediaKey(
      {
        id: 'clip_1',
        projectId: 'proj_1',
        workspaceId: 'ws_1',
        sourceSegKey: 'ws/ws_1/projects/p/clips/c/source_seg.mp4',
        previewKey: 'preview.mp4',
      },
      'ws/ws_1/uploads/upl_x/source.mp4',
    )
    expect(key).toBe('ws/ws_1/projects/p/clips/c/source_seg.mp4')
  })
})
