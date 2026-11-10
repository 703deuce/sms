// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { EditorModeSwitcher } from '@/components/clips/editor/editor-mode-switcher'

afterEach(() => cleanup())

const root = process.cwd().endsWith('/new-app') ? process.cwd() : join(process.cwd(), 'new-app')
const source = (path: string) => readFileSync(join(root, path), 'utf8')

describe('finished editor modes', () => {
  it('shared mode switcher never advertises the legacy Text editor', () => {
    const onSelect = vi.fn()
    render(<EditorModeSwitcher current="story" onSelect={onSelect} />)
    expect(screen.queryByText(/text editor/i)).toBeNull()
    expect(screen.getByTestId('editor-mode-story').getAttribute('aria-current')).toBe('page')
    fireEvent.click(screen.getByTestId('editor-mode-templates'))
    expect(onSelect).toHaveBeenCalledWith('templates')
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

  it('opens AI Producer on the shared clip editor instead of the Text shell', () => {
    const shell = source('components/clips/editor/editor-shell.tsx')
    const chatPage = source('app/app/video-editor/[projectId]/chat/[clipId]/page.tsx')
    expect(shell).toContain('onOpenProducer={() => void toggleProducerRail()}')
    expect(shell).toContain('<EditorChatRail')
    expect(chatPage).toContain("../../edit/[clipId]/editor-payload-section")
    expect(chatPage).toContain('initialProducerOpen')
    expect(chatPage).not.toContain("../../text/[clipId]/editor-payload-section")
  })

  it.each([
    ['Templates', 'components/clips/editor/templates-editor-shell.tsx'],
    ['Story', 'components/clips/editor/story-blocks-editor-shell.tsx'],
    ['Generate', 'components/clips/editor/generate-shot-editor-shell.tsx'],
  ])('%s keeps the same clip edit state and flushes before handoff', (_name, path) => {
    const text = source(path)
    expect(text).toContain('useEditorState(clipId')
    expect(text).toContain('await flushSave()')
    expect(text).toContain('<EditorModeSwitcher')
    expect(text).not.toContain('routes.text(')
  })

  it('keeps the verified source-video edit guard in Change this shot', () => {
    const generate = source('components/clips/editor/generate-shot-editor-shell.tsx')
    expect(generate).toContain("!selectedModel.modes.includes('source_video_edit')")
    expect(generate).toContain('No verified source-video edit model is available.')
    expect(generate).toContain('generateBlockedReason ||')
    expect(generate).toContain("mode: 'source_video_edit'")
  })

  it('keeps Text deep links but hides the clips-list Text entry', () => {
    const textPayload = source('app/app/video-editor/[projectId]/text/[clipId]/editor-payload-section.tsx')
    const card = source('components/clips/clip-card.tsx')
    expect(textPayload).toContain('TextSceneEditorShell')
    expect(card).toContain('data-testid="clip-card-text-editor"')
    expect(card).toContain('{false ? <DropdownMenuItem data-testid="clip-card-text-editor"')
    expect(card).toContain('data-testid="clip-card-story-editor"')
    expect(card).toContain('data-testid="clip-card-templates-editor"')
  })
})
