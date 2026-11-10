/**
 * Shared editor command registry types (PR-B1, #1115 / epic #1114).
 *
 * This is the contract Frontend's chat panel and the later AI endpoint both call.
 * Apply wrappers reuse existing manual editor operations — they do not fork them.
 * No LLM, billing, or production hook wiring in this module.
 *
 * Relative imports only so the official root tsc job does not gain new `@/` errors.
 */
import type { BrandTemplatePayload } from '../apply-brand'
import type { ClipBounds, ClipEditsV2, CutRange } from '../edits'
import type { CleanupProposal } from '../editor/cleanup-proposals'
import type { ItemRef, OpCtx } from '../editor/clip-timeline'
import type { TextItem } from '../editor/text-items'

/** Contract version for this registry. Bump when a breaking param/result change ships. */
export const EDITOR_COMMAND_REGISTRY_VERSION = 1 as const
export type EditorCommandRegistryVersion = typeof EDITOR_COMMAND_REGISTRY_VERSION

export const PHASE_1_COMMAND_NAMES = [
  'trim',
  'split',
  'delete_range',
  'apply_cleanup',
  'restore_cut',
  'set_captions',
  'set_layout',
  'add_or_edit_text',
  'apply_brand',
  'reorder_segment',
] as const

export type EditorCommandName = (typeof PHASE_1_COMMAND_NAMES)[number]

export function isEditorCommandName(name: string): name is EditorCommandName {
  return (PHASE_1_COMMAND_NAMES as readonly string[]).includes(name)
}

export type EditorCommandParams = {
  trim: { inMs: number; outMs: number }
  split: { atMs: number; item?: ItemRef }
  delete_range: { startMs: number; endMs: number; mode?: 'ripple' | 'main' }
  apply_cleanup: { proposals: CleanupProposal[] }
  restore_cut: { startMs: number; endMs: number }
  set_captions: Partial<ClipEditsV2['captions']>
  set_layout: {
    mode: ClipEditsV2['layout']['mode']
    facecam?: ClipEditsV2['layout']['facecam']
  }
  add_or_edit_text: {
    id?: string
    text?: string
    kind?: 'title_card' | 'lower_third'
    startMs?: number
    endMs?: number
    durationMs?: number
    x?: number
    y?: number
  }
  apply_brand: BrandTemplatePayload
  reorder_segment: { segId: string; beforeId: string | null }
}

/** Preconditions the confirm / apply gate can check before mutation. */
export type CommandPreconditions = {
  selectionRequired?: boolean
  playheadInRange?: boolean
  brandKitRequired?: boolean
  rangeRequired?: boolean
  itemRequired?: boolean
}

/**
 * Room for later metering. Do not debit here.
 * A later hook can record workspace / project / clip / command name.
 */
export type EditorCommandMeteringHooks = {
  workspaceId?: string
  projectId?: string
  clipId?: string
  commandName: EditorCommandName
}

export type EditorCommandContext = {
  bounds: ClipBounds
  previewEdits?: ClipEditsV2
  playheadMs?: number
  wordSpans?: { s: number; e: number; w?: string }[]
  workspaceId?: string
  projectId?: string
  clipId?: string
}

export type DiffSummary = {
  text: string
  ranges?: Array<{ startMs: number; endMs: number }>
}

export type EditorCommandFailureCode =
  | 'unknown_command'
  | 'invalid_params'
  | 'precondition'
  | 'no_change'

export type EditorCommandOk = {
  ok: true
  name: EditorCommandName
  edits: ClipEditsV2
  /** Before-state so the existing editor undo stack can invert the apply exactly. */
  before: ClipEditsV2
  diffSummary: DiffSummary
  destructive: boolean
  bulk: boolean
  metering: EditorCommandMeteringHooks
}

export type EditorCommandErr = {
  ok: false
  code: EditorCommandFailureCode
  message: string
  name?: string
}

export type EditorCommandResult = EditorCommandOk | EditorCommandErr

export type JsonSchema = {
  type?: string | string[]
  properties?: Record<string, JsonSchema>
  required?: string[]
  additionalProperties?: boolean | JsonSchema
  enum?: readonly unknown[]
  items?: JsonSchema
  minimum?: number
  minLength?: number
  nullable?: boolean
  description?: string
}

export type EditorCommandDefinition<K extends EditorCommandName = EditorCommandName> = {
  name: K
  paramsSchema: JsonSchema
  preconditions: CommandPreconditions
  /** Static flag; `bulkFor` may raise it from params. */
  destructive: boolean
  bulk: boolean
  apply: (
    edits: ClipEditsV2,
    params: EditorCommandParams[K],
    ctx: EditorCommandContext,
  ) => ClipEditsV2 | null
  summarize: (params: EditorCommandParams[K], before: ClipEditsV2, after: ClipEditsV2) => DiffSummary
  bulkFor?: (params: EditorCommandParams[K], ctx: EditorCommandContext, before: ClipEditsV2) => boolean
}

export type { BrandTemplatePayload, ClipBounds, ClipEditsV2, CutRange, CleanupProposal, ItemRef, OpCtx, TextItem }
