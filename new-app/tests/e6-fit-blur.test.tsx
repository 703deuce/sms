// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import { FIT_BLUR_SIGMA_FRAC, fitBlurCssFilter, fitBlurStrength } from '@/lib/clips/fit-blur'

vi.mock('@/components/clips/editor/clip-shorten-gaps-panel', () => ({ ClipShortenGapsPanel: () => null }))
vi.mock('@/components/clips/editor/facecam-layout-studio', () => ({ FacecamLayoutStudio: () => null }))
vi.mock('@/components/clips/editor/template-layout-panel', () => ({ TemplateLayoutPanel: () => null }))

const B = { clipStartMs: 0, clipEndMs: 10_000 }

describe('E6 fit blur strength', () => {
  it('defaults to strong and survives normalizeEdits', () => {
    const base = defaultEdits(B)
    expect(fitBlurStrength(base)).toBe('strong')
    const n = normalizeEdits({ ...base, layout: { ...base.layout, blurStrength: 'max' } }, B)
    expect(n.layout.blurStrength).toBe('max')
    const bad = normalizeEdits({ ...base, layout: { ...base.layout, blurStrength: 'ultra' } }, B)
    expect(bad.layout.blurStrength).toBeUndefined()
  })

  it('preview css blur scales with stage width and strength', () => {
    expect(fitBlurCssFilter('strong', 400)).toBe('blur(30px) brightness(0.92)')
    expect(fitBlurCssFilter('max', 400)).toBe('blur(52px) brightness(0.9)')
    expect(fitBlurCssFilter('soft', 400)).toMatch(/^blur\(11\.2px\)/)
  })

  it('TS table matches the worker table', () => {
    const py = readFileSync(path.resolve(__dirname, '../../worker/clips_worker/filtergraph.py'), 'utf8')
    const m = py.match(/FIT_BLUR_SIGMA_FRAC = \{"soft": ([0-9.]+), "strong": ([0-9.]+), "max": ([0-9.]+)\}/)
    expect(m).toBeTruthy()
    expect([Number(m![1]), Number(m![2]), Number(m![3])]).toEqual([
      FIT_BLUR_SIGMA_FRAC.soft,
      FIT_BLUR_SIGMA_FRAC.strong,
      FIT_BLUR_SIGMA_FRAC.max,
    ])
  })

  it('layout panel sets blurStrength', async () => {
    const { LayoutPanel } = await import('@/components/clips/editor/layout-panel')
    const onEdits = vi.fn()
    const edits = defaultEdits(B)
    render(
      <LayoutPanel edits={edits} shots={[]} onMode={() => {}} onShotFocus={() => {}} onRerunReframe={() => {}} onEdits={onEdits} />,
    )
    expect(screen.getByRole('button', { name: 'Strong' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Max' }))
    expect(onEdits.mock.calls[0][0].layout.blurStrength).toBe('max')
  })
})
