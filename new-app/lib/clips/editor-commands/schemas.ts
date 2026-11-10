import {
  PHASE_1_COMMAND_NAMES,
  isEditorCommandName,
  type EditorCommandName,
  type EditorCommandParams,
  type JsonSchema,
} from './types'

const LAYOUT_MODES = [
  'speaker_follow',
  'fit_blur',
  'fit_top',
  'full_frame',
  'center_crop',
  'subject_follow',
  'split',
  'fill',
  'fit',
  'grid3',
  'grid4',
  'dynamic',
  'auto',
  'screen_pip',
  'facecam_stack',
  'facecam_pip',
] as const

const num = (description: string, extra: Partial<JsonSchema> = {}): JsonSchema => ({
  type: 'number',
  description,
  ...extra,
})
const str = (description: string, extra: Partial<JsonSchema> = {}): JsonSchema => ({
  type: 'string',
  description,
  ...extra,
})

export const editorCommandJsonSchemas: { [K in EditorCommandName]: JsonSchema } = {
  trim: {
    type: 'object',
    required: ['inMs', 'outMs'],
    additionalProperties: false,
    properties: {
      inMs: num('Trim in-point, source ms'),
      outMs: num('Trim out-point, source ms'),
    },
  },
  split: {
    type: 'object',
    required: ['atMs'],
    additionalProperties: false,
    properties: {
      atMs: num('Split time, output ms (playhead or given time)'),
      item: {
        type: 'object',
        required: ['lane', 'id'],
        additionalProperties: false,
        properties: {
          lane: str('Timeline lane'),
          id: str('Item id (empty string for the main video lane)'),
        },
      },
    },
  },
  delete_range: {
    type: 'object',
    required: ['startMs', 'endMs'],
    additionalProperties: false,
    properties: {
      startMs: num('Range start, output ms'),
      endMs: num('Range end, output ms'),
      mode: { type: 'string', enum: ['ripple', 'main'], description: 'ripple = all tracks; main = main track only' },
    },
  },
  apply_cleanup: {
    type: 'object',
    required: ['proposals'],
    additionalProperties: false,
    properties: {
      proposals: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'kind', 'range', 'label'],
          properties: {
            id: str('Proposal id'),
            kind: str('Proposal kind (filler, silence, retake, manual, …)'),
            label: str('Human label'),
            range: { type: 'array', items: { type: 'number' }, description: '[startMs, endMs] source cut' },
          },
        },
      },
    },
  },
  restore_cut: {
    type: 'object',
    required: ['startMs', 'endMs'],
    additionalProperties: false,
    properties: {
      startMs: num('Cut start, source ms'),
      endMs: num('Cut end, source ms'),
    },
  },
  set_captions: {
    type: 'object',
    additionalProperties: true,
    properties: {
      enabled: { type: 'boolean' },
      presetId: str('Caption style preset'),
      animation: str('Caption animation'),
      size: num('Caption size'),
      position: str('Caption position'),
      case: str('Caption case (upper | sentence)'),
      wordsPerLine: num('Words per line'),
    },
  },
  set_layout: {
    type: 'object',
    required: ['mode'],
    additionalProperties: false,
    properties: {
      mode: { type: 'string', enum: LAYOUT_MODES, description: 'Layout / aspect mode' },
      facecam: { type: 'object', additionalProperties: true, description: 'Optional facecam layout patch' },
    },
  },
  add_or_edit_text: {
    type: 'object',
    additionalProperties: false,
    properties: {
      id: str('Existing text item id; omit to add'),
      text: str('Overlay text', { minLength: 1 }),
      kind: { type: 'string', enum: ['title_card', 'lower_third'] },
      startMs: num('Start, output ms'),
      endMs: num('End, output ms'),
      durationMs: num('Duration if endMs is omitted', { minimum: 500 }),
      x: num('Anchor x, percent'),
      y: num('Anchor y, percent'),
    },
  },
  apply_brand: {
    type: 'object',
    required: ['settings'],
    additionalProperties: true,
    properties: {
      settings: { type: 'object', additionalProperties: true, description: 'Brand template settings' },
      id: str('Template id'),
      logoKey: { type: ['string', 'null'] },
      introVideoKey: { type: ['string', 'null'] },
      outroVideoKey: { type: ['string', 'null'] },
    },
  },
  reorder_segment: {
    type: 'object',
    required: ['segId'],
    additionalProperties: false,
    properties: {
      segId: str('Video segment id (seg:<srcIn>)'),
      beforeId: { type: ['string', 'null'], description: 'Segment to insert before, or null for last' },
    },
  },
}

export type EditorCommandValidation =
  | { ok: true; name: EditorCommandName; params: EditorCommandParams[EditorCommandName] }
  | { ok: false; code: 'unknown_command' | 'invalid_params'; message: string; name?: string }

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v != null && !Array.isArray(v)
}

function typeOk(schema: JsonSchema, value: unknown): boolean {
  if (schema.enum && !schema.enum.includes(value)) return false
  const types = schema.type == null ? [] : Array.isArray(schema.type) ? schema.type : [schema.type]
  if (!types.length) return true
  if (value === null) return types.includes('null')
  if (types.includes('array') && Array.isArray(value)) return true
  if (types.includes('object') && isObject(value)) return true
  if (types.includes('string') && typeof value === 'string') return true
  if (types.includes('number') && typeof value === 'number' && Number.isFinite(value)) return true
  if (types.includes('boolean') && typeof value === 'boolean') return true
  if (types.includes('null') && value == null) return false
  return false
}

function validateSchema(schema: JsonSchema, value: unknown, path: string): string | null {
  if (schema.nullable && value == null) return null
  if (schema.type && (schema.type === 'null' || (Array.isArray(schema.type) && schema.type.includes('null'))) && value == null) {
    return null
  }
  if (!typeOk(schema, value)) return `${path}: unexpected type`
  if (typeof value === 'number' && schema.minimum != null && value < schema.minimum) {
    return `${path}: must be >= ${schema.minimum}`
  }
  if (typeof value === 'string' && schema.minLength != null && value.length < schema.minLength) {
    return `${path}: too short`
  }
  if (Array.isArray(value)) {
    if (path.endsWith('range') && (value.length !== 2 || value.some((n) => typeof n !== 'number' || !Number.isFinite(n)))) {
      return `${path}: expected [startMs, endMs]`
    }
    if (schema.items) {
      for (let i = 0; i < value.length; i++) {
        const err = validateSchema(schema.items, value[i], `${path}[${i}]`)
        if (err) return err
      }
    }
    return null
  }
  if (!isObject(value)) return null
  if (schema.required) {
    for (const key of schema.required) {
      if (value[key] === undefined) return `${path}: missing ${key}`
    }
  }
  if (schema.properties) {
    for (const [key, child] of Object.entries(schema.properties)) {
      if (value[key] === undefined) continue
      const err = validateSchema(child, value[key], path ? `${path}.${key}` : key)
      if (err) return err
    }
  }
  if (schema.additionalProperties === false) {
    const allowed = new Set(Object.keys(schema.properties ?? {}))
    for (const key of Object.keys(value)) {
      if (!allowed.has(key)) return `${path}: unexpected property ${key}`
    }
  }
  return null
}

/** Unknown names are rejected. Valid Phase 1 names are checked against their JSON schema. */
export function validateEditorCommand(input: { name: string; params?: unknown }): EditorCommandValidation {
  const name = input.name
  if (!isEditorCommandName(name)) {
    return {
      ok: false,
      code: 'unknown_command',
      name,
      message: `Unknown or unregistered command: ${name}`,
    }
  }
  const params = input.params ?? {}
  const err = validateSchema(editorCommandJsonSchemas[name], params, name)
  if (err) {
    return { ok: false, code: 'invalid_params', name, message: err }
  }
  if (name === 'trim') {
    const p = params as EditorCommandParams['trim']
    if (!(p.outMs > p.inMs)) {
      return { ok: false, code: 'invalid_params', name, message: 'trim: outMs must be greater than inMs' }
    }
  }
  if (name === 'delete_range' || name === 'restore_cut') {
    const p = params as EditorCommandParams['delete_range']
    if (!(p.endMs > p.startMs)) {
      return { ok: false, code: 'invalid_params', name, message: `${name}: endMs must be greater than startMs` }
    }
  }
  if (name === 'apply_cleanup') {
    const p = params as EditorCommandParams['apply_cleanup']
    if (!Array.isArray(p.proposals) || p.proposals.length === 0) {
      return { ok: false, code: 'invalid_params', name, message: 'apply_cleanup: proposals must be a non-empty array' }
    }
  }
  if (name === 'add_or_edit_text') {
    const p = params as EditorCommandParams['add_or_edit_text']
    if (!p.id && !(p.text && p.text.trim())) {
      return { ok: false, code: 'invalid_params', name, message: 'add_or_edit_text: text is required when adding' }
    }
  }
  return { ok: true, name, params: params as EditorCommandParams[EditorCommandName] }
}

export const registeredCommandNames: readonly EditorCommandName[] = PHASE_1_COMMAND_NAMES
