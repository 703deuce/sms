// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import { LayoutPanel } from '@/components/clips/editor/layout-panel'

vi.mock('@/components/clips/editor/clip-shorten-gaps-panel', () => ({ ClipShortenGapsPanel: () => null }))
vi.mock('@/components/clips/editor/facecam-layout-studio', () => ({ FacecamLayoutStudio: () => null }))
vi.mock('@/components/clips/editor/template-layout-panel', () => ({ TemplateLayoutPanel: () => null }))

const B = { clipStartMs: 0, clipEndMs: 10_000 }

afterEach(() => cleanup())

describe('FV-11 layout panel aspects', () => {
  it('renders 7 aspect controls', () => {
    const edits = defaultEdits(B)
    render(<LayoutPanel edits={edits} shots={[]} onMode={() => {}} onShotFocus={() => {}} onRerunReframe={() => {}} onEdits={vi.fn()} />)
    expect(screen.getByTestId('aspect-9:16')).toBeTruthy()
    expect(screen.getByTestId('aspect-21:9')).toBeTruthy()
    expect(screen.getByTestId('aspect-custom')).toBeTruthy()
  })

  it('21:9 commits on click', () => {
    const onEdits = vi.fn()
    const edits = defaultEdits(B)
    render(<LayoutPanel edits={edits} shots={[]} onMode={() => {}} onShotFocus={() => {}} onRerunReframe={() => {}} onEdits={onEdits} />)
    fireEvent.click(screen.getByTestId('aspect-21:9'))
    expect(onEdits.mock.calls.at(-1)?.[0].aspectRatio).toBe('21:9')
  })

  it('custom blur commits even dimensions', () => {
    const onEdits = vi.fn()
    const edits = normalizeEdits({ ...defaultEdits(B), aspectRatio: 'custom:1440x1080' }, B)
    render(<LayoutPanel edits={edits} shots={[]} onMode={() => {}} onShotFocus={() => {}} onRerunReframe={() => {}} onEdits={onEdits} />)
    const w = screen.getByTestId('aspect-custom-w') as HTMLInputElement
    fireEvent.change(w, { target: { value: '1441' } })
    fireEvent.blur(w)
    expect(onEdits.mock.calls.at(-1)?.[0].aspectRatio).toBe('custom:1440x1080')
  })

  it('invalid ratio shows helper and does not commit bad token', () => {
    const onEdits = vi.fn()
    const edits = normalizeEdits({ ...defaultEdits(B), aspectRatio: 'custom:1440x1080' }, B)
    render(<LayoutPanel edits={edits} shots={[]} onMode={() => {}} onShotFocus={() => {}} onRerunReframe={() => {}} onEdits={onEdits} />)
    const callsBefore = onEdits.mock.calls.length
    const w = screen.getByTestId('aspect-custom-w') as HTMLInputElement
    const h = screen.getByTestId('aspect-custom-h') as HTMLInputElement
    fireEvent.change(w, { target: { value: '3000' } })
    fireEvent.change(h, { target: { value: '500' } })
    fireEvent.blur(w)
    expect(screen.getByText(/Even numbers, 240–3840, ratio up to 4:1/)).toBeTruthy()
    expect(onEdits.mock.calls.length).toBe(callsBefore)
  })
})
