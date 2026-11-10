import { describe, expect, it } from 'vitest'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '../lib/clips/edits'
import {
  PHASE_1_COMMAND_NAMES,
  applyEditorCommand,
  editorCommandJsonSchemas,
  invertEditorCommand,
  listEditorCommands,
  serializeEditorState,
  validateEditorCommand,
} from '../lib/clips/editor-commands'

const bounds = { clipStartMs: 0, clipEndMs: 10000, trimMinMs: 0, trimMaxMs: 20000 }
const ctx = { bounds }

function base(patch: Partial<ClipEditsV2> = {}): ClipEditsV2 {
  return { ...normalizeEdits(defaultEdits(bounds), bounds), loopFriendlyEnd: false, ...patch }
}

describe('Phase 1 editor command registry', () => {
  it('registers every Phase 1 command and validates representative params', () => {
    expect(listEditorCommands().map((command) => command.name)).toEqual([...PHASE_1_COMMAND_NAMES])
    const fixtures: Record<(typeof PHASE_1_COMMAND_NAMES)[number], unknown> = {
      trim: { inMs: 1000, outMs: 8000 },
      split: { atMs: 4000 },
      delete_range: { startMs: 2000, endMs: 3000 },
      apply_cleanup: { proposals: [{ id: 'p1', kind: 'filler', range: [1000, 1400], label: 'um' }] },
      restore_cut: { startMs: 1000, endMs: 1400 },
      set_captions: { enabled: true, presetId: 'bold_pop' },
      set_layout: { mode: 'fit_blur' },
      add_or_edit_text: { text: 'Hello', startMs: 0, durationMs: 2000, kind: 'title_card' },
      apply_brand: { id: 'brand_1', settings: { defaultLayoutMode: 'speaker_follow' } },
      reorder_segment: { segId: 'seg:0', beforeId: null },
    }
    for (const name of PHASE_1_COMMAND_NAMES) {
      expect(editorCommandJsonSchemas[name]).toBeTruthy()
      expect(validateEditorCommand({ name, params: fixtures[name] }).ok).toBe(true)
    }
  })

  it('applies trim through the shared registry and can invert to the exact before state', () => {
    const start = base()
    const result = applyEditorCommand(start, { name: 'trim', params: { inMs: 1200, outMs: 7600 } }, ctx)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.edits.trim).toEqual({ in: 1200, out: 7600 })
    expect(result.diffSummary.text).toContain('1200')
    expect(serializeEditorState(invertEditorCommand(result))).toBe(serializeEditorState(start))
  })

  it('marks destructive range deletion and exposes metering context without debiting', () => {
    const result = applyEditorCommand(
      base(),
      { name: 'delete_range', params: { startMs: 2000, endMs: 3500 } },
      { ...ctx, workspaceId: 'ws_test', projectId: 'proj_test', clipId: 'clip_test' },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.destructive).toBe(true)
    expect(result.metering).toEqual({
      workspaceId: 'ws_test',
      projectId: 'proj_test',
      clipId: 'clip_test',
      commandName: 'delete_range',
    })
  })

  it('rejects unknown, invalid, and no-op commands with stable error codes', () => {
    const start = base()
    const unknown = applyEditorCommand(start, { name: 'generate_music', params: {} }, ctx)
    expect(unknown.ok).toBe(false)
    if (!unknown.ok) expect(unknown.code).toBe('unknown_command')

    const invalid = applyEditorCommand(start, { name: 'trim', params: { inMs: 8000, outMs: 1000 } }, ctx)
    expect(invalid.ok).toBe(false)
    if (!invalid.ok) expect(invalid.code).toBe('invalid_params')

    const noChange = applyEditorCommand(
      start,
      { name: 'trim', params: { inMs: start.trim.in, outMs: start.trim.out } },
      ctx,
    )
    expect(noChange.ok).toBe(false)
    if (!noChange.ok) expect(noChange.code).toBe('no_change')
  })
})
