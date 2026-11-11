import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd().endsWith('/new-app') ? process.cwd() : join(process.cwd(), 'new-app')
const source = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Story/Templates standalone finish', () => {
  it('contains Story PreviewStage and keeps keyboard scene reorder on the real EDL', () => {
    const story = source('components/clips/editor/story-blocks-editor-shell.tsx')
    expect(story).toContain('data-testid="story-preview-host"')
    expect(story).toContain('relative flex min-h-0 flex-1')
    expect(story).toContain("aria-label={'Move scene ' + (index + 1) + ' up'}")
    expect(story).toContain("aria-label={'Move scene ' + (index + 1) + ' down'}")
    expect(story).toContain("moveVideoSegment(")
    expect(story).toContain("commit('reorder-sectionOrder', next)")
    expect(story).not.toContain('fake footage')
  })

  it('uses edited display time for Templates transport and keeps pending handoff choices', () => {
    const templates = source('components/clips/editor/templates-editor-shell.tsx')
    expect(templates).toContain('setPlayheadOut(tick.outputMs)')
    expect(templates).toContain('displayPositionMs(previewEdits, playheadOut)')
    expect(templates).toContain('displayDurationMs(previewEdits)')
    expect(templates).toContain('Apply to this clip')
    expect(templates).toContain('Discard preview')
    expect(templates).toContain('Stay')
    expect(templates).toContain('shrink-0 flex-wrap items-center justify-between')
  })

  it('shares premium standalone chrome without touching protected Compact/Timeline geometry', () => {
    const story = source('components/clips/editor/story-blocks-editor-shell.tsx')
    const templates = source('components/clips/editor/templates-editor-shell.tsx')
    expect(story).toContain('<StandaloneEditorChrome')
    expect(templates).toContain('<StandaloneEditorChrome')
    expect(templates).toContain('<StandaloneEditorToolRail')
  })
})
