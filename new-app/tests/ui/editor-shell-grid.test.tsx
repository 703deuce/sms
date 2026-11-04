// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render } from '@testing-library/react'
import { bandForWidth, EDITOR_GRID, aspectCssToNumber, EditorLayout } from '@/components/clips/editor/editor-layout'
import { clampTimelineHeight, TIMELINE_MIN_H } from '@/lib/clips/editor/timeline-opts'
import { EDITOR_RAIL_ITEMS, EDITOR_RAIL_GROUPS } from '@/components/clips/editor/editor-rail'

const ROOT = join(import.meta.dirname, '..', '..')

describe('editor shell grid', () => {
  it('bandForWidth breakpoints', () => {
    expect(bandForWidth(1023)).toBe('mobile')
    expect(bandForWidth(1024)).toBe('compact')
    expect(bandForWidth(1279)).toBe('compact')
    expect(bandForWidth(1280)).toBe('desktop')
    expect(bandForWidth(1535)).toBe('desktop')
    expect(bandForWidth(1536)).toBe('wide')
  })
  it('EDITOR_GRID tokens', () => {
    expect(EDITOR_GRID.root).toContain('h-full')
    expect(EDITOR_GRID.root).toContain('min-h-0')
    expect(EDITOR_GRID.root).toContain('overflow-hidden')
    expect(EDITOR_GRID.root).toContain('lg:grid-rows-[minmax(0,1fr)_auto]')
    expect(EDITOR_GRID.root).toContain('xl:grid-cols-[64px_var(--editor-panel-w,360px)_minmax(0,1fr)]')
    expect(EDITOR_GRID.root).toContain('2xl:grid-cols-[64px_var(--editor-panel-w,360px)_minmax(0,1fr)_minmax(280px,320px)]')
    expect(EDITOR_GRID.rootScript).toContain('lg:grid-cols-[minmax(0,1fr)]')
    expect(EDITOR_GRID.rootScript).not.toContain('var(--editor-panel-w')
    expect(EDITOR_GRID.previewScript).toContain('lg:col-start-1')
    expect(EDITOR_GRID.previewScript).not.toContain('lg:col-start-2')
    expect(EDITOR_GRID.timelineScript).toContain('h-[148px]')
    expect(EDITOR_GRID.timelineScript).not.toContain('max-h-[clamp')
    expect(EDITOR_GRID.properties).toContain('hidden')
    expect(EDITOR_GRID.properties).toContain('2xl:flex')
    expect(EDITOR_GRID.timeline).toContain('max-h-[clamp(160px,45dvh,560px)]')
    expect(EDITOR_GRID.timeline).toContain('lg:col-[2/-1]')
    expect(EDITOR_GRID.panelMobile).toContain('max-lg:fixed')
  })
  it('EditorLayout desktop panel visible', () => {
    const { container } = render(
      <EditorLayout
        band="desktop"
        rail={<span>r</span>}
        panel={<span>p</span>}
        panelOpen
        onClosePanel={() => {}}
        preview={<span>v</span>}
        properties={<span>i</span>}
        timeline={<span>t</span>}
      />,
    )
    const regions = [...container.querySelectorAll('[data-region]')].map((el) => el.getAttribute('data-region'))
    expect(regions).toEqual(['rail', 'panel', 'preview', 'properties', 'timeline'])
    expect(container.querySelector('[data-testid="editor-grid"]')?.getAttribute('data-band')).toBe('desktop')
    expect(container.querySelector('[data-region="panel"]')?.hasAttribute('hidden')).toBe(false)
  })
  it('EditorLayout compact panel hidden until open', () => {
    const { container, rerender } = render(
      <EditorLayout
        band="compact"
        rail={<span>r</span>}
        panel={<span>p</span>}
        panelOpen={false}
        onClosePanel={() => {}}
        preview={<span>v</span>}
        properties={null}
        timeline={<span>t</span>}
      />,
    )
    expect(container.querySelector('[data-region="panel"]')?.hasAttribute('hidden')).toBe(true)
    rerender(
      <EditorLayout
        band="compact"
        rail={<span>r</span>}
        panel={<span>p</span>}
        panelOpen
        onClosePanel={() => {}}
        preview={<span>v</span>}
        properties={null}
        timeline={<span>t</span>}
      />,
    )
    expect(container.querySelector('[data-testid="editor-panel-backdrop"]')).toBeTruthy()
  })
  it('EditorLayout script view grid tokens (no Tailwind override conflicts)', () => {
    const { container } = render(
      <EditorLayout
        band="desktop"
        rail={<span>r</span>}
        panel={<span>p</span>}
        panelOpen
        onClosePanel={() => {}}
        preview={<span>v</span>}
        properties={<span>i</span>}
        timeline={<span data-testid="script-timeline-slot">t</span>}
        hidePanelColumn
        hidePropertiesColumn
      />,
    )
    const root = container.querySelector('[data-testid="editor-grid"]')
    expect(root?.getAttribute('data-script-view')).toBe('true')
    const rootClass = root?.className ?? ''
    expect(rootClass).toContain('lg:grid-cols-[minmax(0,1fr)]')
    expect(rootClass).not.toContain('var(--editor-panel-w')
    const previewClass = container.querySelector('[data-region="preview"]')?.className ?? ''
    expect(previewClass).toContain('lg:col-start-1')
    expect(previewClass).not.toContain('lg:col-start-2')
    const timelineClass = container.querySelector('[data-region="timeline"]')?.className ?? ''
    expect(timelineClass).toContain('h-[148px]')
    expect(timelineClass).not.toContain('max-h-[clamp')
  })
  it('clampTimelineHeight', () => {
    expect(clampTimelineHeight(5000, 800)).toBe(360)
    expect(clampTimelineHeight(10, 800)).toBe(TIMELINE_MIN_H)
    expect(clampTimelineHeight(5000, 2000)).toBe(560)
  })
  it('aspectCssToNumber', () => {
    expect(aspectCssToNumber('9 / 16')).toBeCloseTo(0.5625)
    expect(aspectCssToNumber('16:9')).toBeCloseTo(1.778, 2)
    expect(aspectCssToNumber('bad')).toBeCloseTo(16 / 9)
  })
  it('editor-shell source guards', () => {
    const shell = readFileSync(join(ROOT, 'components/clips/editor/editor-shell.tsx'), 'utf8')
    expect(shell).not.toContain('h-[calc(100dvh-3.5rem)]')
    expect(shell).not.toContain('lg:grid-cols-[minmax(0,1fr)_56px')
    expect(shell).toContain('<EditorLayout')
    expect(shell).toContain('onOpenAiVoiceover')
    expect(shell).toContain('[container-type:size]')
    const chips = readFileSync(join(ROOT, 'components/clips/editor/preview-chip-row.tsx'), 'utf8')
    expect(chips).not.toContain('absolute inset-x-2 bottom-2')
    for (const rel of [
      'timeline/timeline-lane-header.tsx',
      'player-controls.tsx',
      'preview-chip-row.tsx',
      'editor-rail.tsx',
    ]) {
      const t = readFileSync(join(ROOT, 'components/clips/editor', rel), 'utf8')
      expect(t).not.toMatch(/text-\[(6|7|8|9)px\]/)
    }
    const timeline = readFileSync(join(ROOT, 'components/clips/editor/timeline.tsx'), 'utf8')
    expect(timeline).not.toMatch(/text-\[8px\]/)
  })
  it('EDITOR_RAIL_GROUPS cover all items', () => {
    const grouped = EDITOR_RAIL_GROUPS.flatMap((g) => g.ids).sort()
    const items = EDITOR_RAIL_ITEMS.map((i) => i.id).sort()
    expect(grouped).toEqual(items)
  })
})
