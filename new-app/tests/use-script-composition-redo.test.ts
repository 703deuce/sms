import { describe, expect, it } from 'vitest'
import { emptyDocument } from '@/lib/clips/script-edl/ops'
import { runCompositionUndoRedoScenario } from '@/components/script-editor/use-script-composition'

describe('composition undo/redo (mixed keyboard + button)', () => {
  it('redo restores full stack after two undos then Ctrl+Shift+Z and Redo button', () => {
    const ids = ['a:0', 'a:1', 'a:2', 'a:3']
    const initial = emptyDocument(ids)

    const final = runCompositionUndoRedoScenario(initial, [
      { delete: ['a:1'] },
      { delete: ['a:2'] },
      'undo',
      'undo',
      'redo',
      'redo',
    ])

    expect(final.deletedWordIds.sort()).toEqual(['a:1', 'a:2'])
  })
})
