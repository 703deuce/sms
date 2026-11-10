/**
 * Shared Phase 1 editor command registry (PR-B1, #1115).
 *
 * Frontend should import from `@/lib/clips/editor-commands`.
 * Production editor hooks are not wired here (that is PR-F1); apply is a thin
 * wrapper around the existing manual operations so UI and AI can share one path.
 */
import { canonicalEditsJson, type ClipEditsV2 } from '../edits'
import { editorCommandDefinitions } from './apply'
import { editorCommandJsonSchemas, validateEditorCommand } from './schemas'
import {
  PHASE_1_COMMAND_NAMES,
  isEditorCommandName,
  type EditorCommandContext,
  type EditorCommandDefinition,
  type EditorCommandErr,
  type EditorCommandName,
  type EditorCommandOk,
  type EditorCommandParams,
  type EditorCommandResult,
} from './types'

export { canonicalEditsJson }

/** Serializer used by parity tests: two ClipEditsV2 states compare equal iff this string matches. */
export function serializeEditorState(edits: ClipEditsV2): string {
  return canonicalEditsJson(edits)
}

export function getEditorCommand<K extends EditorCommandName>(name: K): EditorCommandDefinition<K>
export function getEditorCommand(name: string): EditorCommandDefinition | undefined
export function getEditorCommand(name: string): EditorCommandDefinition | undefined {
  if (!isEditorCommandName(name)) return undefined
  return editorCommandDefinitions[name]
}

export function listEditorCommands(): EditorCommandDefinition[] {
  return PHASE_1_COMMAND_NAMES.map((name) => editorCommandDefinitions[name])
}

export function invertEditorCommand(result: EditorCommandOk): ClipEditsV2 {
  return result.before
}

export function applyEditorCommand(
  edits: ClipEditsV2,
  input: { name: string; params?: unknown },
  ctx: EditorCommandContext,
): EditorCommandResult {
  const checked = validateEditorCommand(input)
  if (!checked.ok) {
    const err: EditorCommandErr = { ok: false, code: checked.code, message: checked.message, name: checked.name }
    return err
  }
  const def = editorCommandDefinitions[checked.name]
  const params = checked.params as EditorCommandParams[typeof checked.name]
  const after = def.apply(edits, params, ctx)
  if (after == null) {
    return {
      ok: false,
      code: 'precondition',
      name: checked.name,
      message: `${checked.name}: nothing to apply (precondition failed or no-op)`,
    }
  }
  if (serializeEditorState(after) === serializeEditorState(edits)) {
    return {
      ok: false,
      code: 'no_change',
      name: checked.name,
      message: `${checked.name}: no change`,
    }
  }
  const bulk = def.bulk || Boolean(def.bulkFor?.(params, ctx, edits))
  const ok: EditorCommandOk = {
    ok: true,
    name: checked.name,
    edits: after,
    before: edits,
    diffSummary: def.summarize(params, edits, after),
    destructive: def.destructive,
    bulk,
    metering: {
      workspaceId: ctx.workspaceId,
      projectId: ctx.projectId,
      clipId: ctx.clipId,
      commandName: checked.name,
    },
  }
  return ok
}

export {
  PHASE_1_COMMAND_NAMES,
  isEditorCommandName,
  editorCommandDefinitions,
  editorCommandJsonSchemas,
  validateEditorCommand,
}

export type {
  CommandPreconditions,
  DiffSummary,
  EditorCommandContext,
  EditorCommandDefinition,
  EditorCommandErr,
  EditorCommandFailureCode,
  EditorCommandMeteringHooks,
  EditorCommandName,
  EditorCommandOk,
  EditorCommandParams,
  EditorCommandResult,
  JsonSchema,
} from './types'
