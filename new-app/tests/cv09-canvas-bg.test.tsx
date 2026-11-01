// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { defaultEdits, editsPayloadForSave, isDefaultEdits, normalizeEdits } from '@/lib/clips/edits'
import { normalizeCanvasBg, resolveCanvasBg, withCanvasBg } from '@/lib/clips/canvas-bg'
import { CanvasBgFill } from '@/components/clips/editor/canvas-bg-fill'

vi.mock('@/components/clips/editor/clip-shorten-gaps-panel', () => ({ ClipShortenGapsPanel: () => null }))
vi.mock('@/components/clips/editor/facecam-layout-studio', () => ({ FacecamLayoutStudio: () => null }))
vi.mock('@/components/clips/editor/template-layout-panel', () => ({ TemplateLayoutPanel: () => null }))

const bounds = { clipStartMs: 0, clipEndMs: 10_000 }

describe('CV-09 canvasBg', () => {
  it('normalizes and round-trips canvasBg', () => {
    const e = normalizeEdits(
      { ...defaultEdits(bounds), canvasBg: { type: 'color', color: '#3b82f6', imageId: 'x' } },
      bounds,
    )
    expect(e.canvasBg).toEqual({ type: 'color', color: '#3B82F6' })
    expect(normalizeCanvasBg({ type: 'image' })).toBeUndefined()
    expect(normalizeCanvasBg({ type: 'color', color: 'red' })).toEqual({ type: 'color', color: '#000000' })
    expect(editsPayloadForSave(defaultEdits(bounds)).canvasBg).toBeNull()
  })

  it('legacy stays legacy; blur mirrors layout; flat fill blocks preview reuse', () => {
    const d = defaultEdits(bounds)
    expect(resolveCanvasBg(d)).toEqual({ kind: 'legacy' })
    const b = withCanvasBg(d, { type: 'blur', blur: 'max' })
    expect(b.layout.blurStrength).toBe('max')
    expect(isDefaultEdits(d, bounds)).toBe(true)
    expect(isDefaultEdits(withCanvasBg(d, { type: 'color', color: '#FFFFFF' }), bounds)).toBe(false)
    expect(isDefaultEdits({ ...d, layout: { ...d.layout, blurStrength: 'soft' } }, bounds)).toBe(false)
  })

  it('preview color fill test id and background', () => {
    render(<CanvasBgFill bg={{ kind: 'color', hex: '#FF0000' }} />)
    const el = screen.getByTestId('preview-canvas-bg')
    expect(el.getAttribute('style')).toContain('#FF0000')
  })

  it('PreviewStage fit_blur shows canvas bg for color', async () => {
    const { PreviewStage } = await import('@/components/clips/editor/preview-stage')
    const edits = withCanvasBg(
      { ...defaultEdits(bounds), layout: { ...defaultEdits(bounds).layout, mode: 'fit_blur' } },
      { type: 'color', color: '#FF0000' },
    )
    const videoRef = { current: null }
    render(
      <PreviewStage
        videoUrl="https://example.com/v.mp4"
        edits={edits}
        words={[]}
        cropTrack={null}
        videoRef={videoRef}
        onTick={() => {}}
        testBoxSize={{ w: 360, h: 640 }}
      />,
    )
    const fills = screen.getAllByTestId('preview-canvas-bg')
    expect(fills.some((el) => el.getAttribute('style')?.includes('#FF0000'))).toBe(true)
  })
})
