import { describe, expect, it } from 'vitest'
import { rebaseOpsForTarget, applyOpsLocally } from '@/lib/clips/script-editor/composition-sync'
import { emptyDocument } from '@/lib/clips/script-edl/ops'

describe('composition sync rebase', () => {
  it('rebase sends delete ops when local removed a word', () => {
    const ids = ['a:0', 'a:1', 'a:2']
    const server = emptyDocument(ids)
    const local = emptyDocument(ids)
    local.deletedWordIds = ['a:1']
    local.keptWordIds = ['a:0', 'a:2']
    const ops = rebaseOpsForTarget(server, local)
    expect(ops.some((o) => o.type === 'delete_words' && o.wordIds.includes('a:1'))).toBe(true)
    const merged = applyOpsLocally(server, ops)
    expect(merged.deletedWordIds).toContain('a:1')
  })

  it('concurrent revision: server ahead then rebase local undo', () => {
    const ids = ['a:0', 'a:1']
    let server = emptyDocument(ids)
    server = applyOpsLocally(server, [{ type: 'delete_words', wordIds: ['a:1'] }])
    const local = emptyDocument(ids)
    local.deletedWordIds = []
    local.keptWordIds = ids
    const ops = rebaseOpsForTarget(server, local)
    expect(ops.some((o) => o.type === 'restore_words')).toBe(true)
  })
})
