import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd().endsWith('/new-app') ? process.cwd() : join(process.cwd(), 'new-app')
const source = (path: string) => readFileSync(join(root, path), 'utf8')
describe('assistant geometry and controls', () => {
  it('mounts rail below toolbar without viewport overlay, keeping protected workspaces untouched', () => {
    const shell = source('components/clips/editor/editor-shell.tsx')
    expect(shell).toContain('data-testid="editor-assistant-workspace"')
    expect(shell).toContain('data-testid="editor-assistant-drawer"')
    expect(shell).not.toContain('fixed bottom-0 right-0 top-11 z-[70]')
    expect(shell).toContain('showStandaloneProducerButton={false}')
    expect(shell).toContain('<EditorChatRail')
  })
  it('preserves escape, stale proposal guards, and save-before-send', () => {
    const rail = source('components/clips/editor/editor-chat-rail.tsx')
    expect(rail).toContain("event.key === 'Escape'")
    expect(rail).toContain('canonicalEditsJson(proposal.before)')
    expect(rail).toContain('onBeforeSend')
    expect(rail).toContain('onAudition(null)')
  })
})
