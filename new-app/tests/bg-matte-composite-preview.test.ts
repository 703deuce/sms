// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { createElement, createRef } from 'react'
import { applyMatteAlpha, fitVideoFrame, BgMatteCompositePreview } from '@/components/clips/editor/g4/bg-matte-composite-preview'

describe('E2 real person matte compositing', () => {
  it('mounts a click-through canvas for the authenticated source even when no pixels have decoded yet', () => {
    const ui = render(createElement(BgMatteCompositePreview, {
      clipId: 'clip-test',
      mediaKind: 'proxy',
      video: createRef<HTMLVideoElement>(),
      outMs: createRef<number>(),
      enabled: true,
      removal: { enabled: true, quality: 'standard', refine: { feather: 10, choke: 0 },
        background: { type: 'blur', amount: 50 } },
    }))

    const canvas = ui.getByTestId('preview-person-cutout')
    expect(canvas.className).toContain('pointer-events-none')
    ui.unmount()
  })

  it('uses identical crop geometry for portrait object-cover video and its mask', () => {
    expect(fitVideoFrame(1920, 1080, 360, 640, 'cover')).toMatchObject({
      sx: 656.25, sy: 0, sw: 607.5, sh: 1080, dx: 0, dy: 0, dw: 360, dh: 640,
    })
    const fit = fitVideoFrame(1280, 720, 360, 640, 'contain')
    expect(fit.dx).toBe(0)
    expect(fit.dw).toBe(360)
    expect(fit.dh).toBe(202.5)
  })


  it('keeps bright subject pixels and removes black background pixels', () => {
    const frame = new Uint8ClampedArray([200, 100, 25, 255, 50, 120, 150, 255])
    const matte = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255])
    applyMatteAlpha(frame, matte)
    expect(Array.from(frame)).toEqual([200, 100, 25, 255, 50, 120, 150, 0])
  })

  it('preserves fractional feathered alpha and existing transparency', () => {
    const frame = new Uint8ClampedArray([255, 200, 0, 128, 0, 0, 0, 255])
    const matte = new Uint8ClampedArray([128, 128, 128, 255, 64, 64, 64, 255])
    applyMatteAlpha(frame, matte)
    expect(frame[3]).toBe(64)
    expect(frame[7]).toBe(64)
  })
})
