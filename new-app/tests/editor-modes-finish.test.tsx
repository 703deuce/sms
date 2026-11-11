// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  EDITOR_MODE_SWITCHER_ITEMS,
  EditorModeSwitcher,
} from '@/components/clips/editor/editor-mode-switcher'

afterEach(() => cleanup())

const root = process.cwd().endsWith('/new-app') ? process.cwd() : join(process.cwd(), 'new-app')
const source = (path: string) => readFileSync(join(root, path), 'utf8')

describe('finished editor modes', () => {
  it('shows six destinations, calls Templates Layouts, and never advertises the legacy Text editor', () => {
    const onSelect = vi.fn()
    render(<EditorModeSwitcher current="story" onSelect={onSelect} />)

    expect(EDITOR_MODE_SWITCHER_ITEMS.map((item) => [item.id, item.label])).toEqual([
      ['clip', 'Clip editor'],
      ['full-video', 'Full video'],
      ['producer', 'AI Producer'],
      ['story', 'Story blocks'],
      ['templates', 'Layouts'],
      ['generate', 'Change this shot'],
    ])
    expect(screen.queryByText(/text editor/i)).toBeNull()
    expect(screen.getByTestId('editor-mode-story').getAttribute('aria-current')).toBe('page')
    expect(screen.getByTestId('editor-mode-full-video').textContent).toBe('Full video')
    expect(screen.getByTestId('editor-mode-templates').textContent).toBe('Layouts')

    fireEvent.click(screen.getByTestId('editor-mode-templates'))
    expect(onSelect).toHaveBeenCalledWith('templates')
    fireEvent.click(screen.getByTestId('editor-mode-full-video'))
    expect(onSelect).toHaveBeenCalledWith('full-video')
  })

  it('keeps the Templates URL/id contract while visible editor navigation says Layouts', () => {
    const routes = source('lib/routes.ts')
    const tabMeta = source('components/clips/editor/editor-tab-meta.ts')
    const railNav = source('lib/clips/editor/editor-rail-navigation.ts')
    const routePage = source('app/app/video-editor/[projectId]/templates/[clipId]/page.tsx')
    const routeError = source('app/app/video-editor/[projectId]/templates/[clipId]/error.tsx')

    expect(routes).toContain("templateMode: (projectId: string, clipId: string")
    expect(routes).toContain("'/app/video-editor/' + projectId + '/templates/' + clipId")
    expect(tabMeta).toContain("templates: { label: 'Layouts'")
    expect(railNav).toContain("id: 'templates'")
    expect(railNav).toContain("label: 'Layouts'")
    expect(railNav).toContain("{ id: 'templates', tabLabel: 'Layouts' }")
    expect(railNav).toContain("Templates: 'templates'")
    expect(railNav).toContain("Layouts: 'templates'")
    expect(routePage).toContain("title: 'Layouts editor'")
    expect(routeError).toContain('Layouts could not load')
  })

  it('wires the shared Full video handoff into every active mode-shell consumer', () => {
    for (const path of [
      'components/clips/editor/editor-shell.tsx',
      'components/clips/editor/story-blocks-editor-shell.tsx',
      'components/clips/editor/templates-editor-shell.tsx',
      'components/clips/editor/generate-shot-editor-shell.tsx',
    ]) {
      const text = source(path)
      expect(text, path).toContain('useFullVideoModeHandoff')
      expect(text, path).toContain('fullVideoMode.open()')
    }
  })

  it('keeps Compact / Timeline / Focus, Inspector rail, and Captions code paths intact', () => {
    const unified = source('components/clips/editor/unified-editor-workspace.tsx')
    const rail = source('components/clips/editor/script-view-tool-rail.tsx')
    const shell = source('components/clips/editor/editor-shell.tsx')
    expect(unified).toContain('data-testid="unified-mode-compact"')
    expect(unified).toContain('data-testid="unified-mode-expanded"')
    expect(unified).toContain('data-testid="unified-mode-focus"')
    expect(rail).toContain('data-testid="unified-inspector-tool-rail"')
    expect(shell).toContain('<CaptionsPanel')
    expect(shell).toContain("openToolPanel('captions')")
  })

  it('keeps AI Producer on the one shared docked clip-editor rail', () => {
    const shell = source('components/clips/editor/editor-shell.tsx')
    const chatPage = source('app/app/video-editor/[projectId]/chat/[clipId]/page.tsx')
    expect(shell).toContain('onOpenProducer={() => void toggleProducerRail()}')
    expect(shell).toContain('<EditorChatRail')
    expect(shell).toContain('showStandaloneProducerButton={false}')
    expect(chatPage).toContain("../../edit/[clipId]/editor-payload-section")
    expect(chatPage).toContain('initialProducerOpen')
    expect(chatPage).not.toContain("../../text/[clipId]/editor-payload-section")
  })

  it.each([
    ['Layouts', 'components/clips/editor/templates-editor-shell.tsx'],
    ['Story', 'components/clips/editor/story-blocks-editor-shell.tsx'],
    ['Generate', 'components/clips/editor/generate-shot-editor-shell.tsx'],
  ])('%s keeps the same clip edit state and flushes before handoff', (_name, path) => {
    const text = source(path)
    expect(text).toContain('useEditorState(clipId')
    expect(text).toContain('await flushSave()')
    expect(text).toContain('<StandaloneEditorChrome')
    expect(text).not.toContain('routes.text(')
  })

  it('keeps the verified source-video edit guard in Change this shot', () => {
    const generate = source('components/clips/editor/generate-shot-editor-shell.tsx')
    expect(generate).toContain("!selectedModel.modes.includes('source_video_edit')")
    expect(generate).toContain('No verified source-video edit model is available.')
    expect(generate).toContain('generateBlockedReason ||')
    expect(generate).toContain("mode: 'source_video_edit'")
  })

  it('keeps Text deep links hidden and clip-card Edit on the existing Compact entry route', () => {
    const textPayload = source('app/app/video-editor/[projectId]/text/[clipId]/editor-payload-section.tsx')
    const card = source('components/clips/clip-card.tsx')
    expect(textPayload).toContain('TextSceneEditorShell')
    expect(card).toContain('data-testid="clip-card-text-editor"')
    expect(card).toContain('{false ? <DropdownMenuItem data-testid="clip-card-text-editor"')
    expect(card).toContain('data-testid="clip-card-story-editor"')
    expect(card).toContain('data-testid="clip-card-templates-editor"')
    expect(card).toContain('}}>Layouts</DropdownMenuItem>')
    expect(card).toContain(': `/app/video-editor/${projectId}/edit/${clip.id}`')
    expect(card).toContain('render={<Link href={editorHref} prefetch={false} />}')
  })

  it('snapshots protected editor destination baseline contracts', () => {
    const unified = source('components/clips/editor/unified-editor-workspace.tsx')
    const shell = source('components/clips/editor/editor-shell.tsx')
    const clipShell = source('components/clips/editor/editor-clip-shell.tsx')
    const story = source('components/clips/editor/story-blocks-editor-shell.tsx')
    const layouts = source('components/clips/editor/templates-editor-shell.tsx')
    const generate = source('components/clips/editor/generate-shot-editor-shell.tsx')
    const fullVideoHandoff = source('components/clips/editor/full-video-mode-handoff.ts')

    expect({
      compactClosed: shell.includes('unifiedTimelineHidden={compact && !timelineOpen && !timelineFocused}') &&
        shell.includes("{timelineOpen ? 'Hide timeline' : 'Show timeline'}"),
      compactOpen: shell.includes('data-testid="compact-timeline-toggle"') &&
        shell.includes("'Hide timeline'"),
      timeline: unified.includes('data-testid="unified-mode-expanded"'),
      focus: unified.includes('data-testid="unified-mode-focus"'),
      fullVideoTimeline: clipShell.includes('compact={!props.fullVideo || props.initialPanel === \'captions\'}') &&
        fullVideoHandoff.includes("writeClipEditorLayoutView('timeline')"),
      story: story.includes('data-testid="story-blocks-editor"'),
      layouts: layouts.includes('data-testid="templates-editor"') &&
        layouts.includes('<h2 className="text-sm font-semibold">Layouts</h2>'),
      generate: generate.includes('data-testid="generate-shot-editor"'),
    }).toMatchInlineSnapshot(`
      {
        "compactClosed": true,
        "compactOpen": true,
        "focus": true,
        "fullVideoTimeline": true,
        "generate": true,
        "layouts": true,
        "story": true,
        "timeline": true,
      }
    `)
  })
})
