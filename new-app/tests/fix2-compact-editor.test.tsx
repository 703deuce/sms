// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { EditorLayout } from '@/components/clips/editor/editor-layout'
import { readTimelineOpen, TIMELINE_OPEN_KEY, writeTimelineOpen } from '@/lib/clips/editor/compact-editor'

function mem() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      m.set(k, v)
    },
  }
}

describe('FIX2 R7 compact editor', () => {
  it('timeline open flag round-trips and defaults closed', () => {
    const s = mem()
    expect(readTimelineOpen(s)).toBe(false)
    writeTimelineOpen(s, true)
    expect(s.getItem(TIMELINE_OPEN_KEY)).toBe('1')
    expect(readTimelineOpen(s)).toBe(true)
    writeTimelineOpen(s, false)
    expect(readTimelineOpen(s)).toBe(false)
    expect(readTimelineOpen(null)).toBe(false)
  })
  it('storage that throws -> closed, no crash', () => {
    const bad = {
      getItem: (): string | null => {
        throw new Error('x')
      },
      setItem: (): void => {
        throw new Error('x')
      },
    }
    expect(readTimelineOpen(bad)).toBe(false)
    expect(() => writeTimelineOpen(bad, true)).not.toThrow()
  })
  it('compact layout drops the properties column', () => {
    const base = {
      band: 'wide' as const,
      rail: null,
      panel: null,
      panelOpen: true,
      onClosePanel: () => {},
      preview: null,
      timeline: null,
    }
    const full = render(<EditorLayout {...base} properties={<span>props</span>} />)
    expect(full.container.querySelector('[data-region="properties"]')).not.toBeNull()
    full.unmount()
    const c = render(<EditorLayout {...base} compact properties={<span>props</span>} />)
    expect(c.container.querySelector('[data-region="properties"]')).toBeNull()
    expect(c.container.querySelector('[data-compact="true"]')).not.toBeNull()
  })
})
