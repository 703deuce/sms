import type { AiProducerPhase } from '@/lib/ai-producer-agent/phases'

export type Phase = AiProducerPhase

export type ToolSchema = { name: string; description: string; parameters: Record<string, unknown> }

const int = { type: 'integer', minimum: 0 }
const range = { type: 'array', items: int, minItems: 2, maxItems: 2 }
const sourceId = { type: 'string', minLength: 1 }
const obj = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object',
  additionalProperties: false,
  properties,
  required,
})

export const TOOL_SCHEMAS: ToolSchema[] = [
  {
    name: 'find_moments',
    description: 'Candidate moments from the finder copy.',
    parameters: obj(
      {
        mode: { enum: ['best_moments', 'story_search', 'inventory'] },
        sources: { type: 'array', items: sourceId },
        query: { type: 'string', maxLength: 500 },
        rangeMs: range,
        targetClipLenS: { type: 'integer', minimum: 5, maximum: 600 },
        limit: { type: 'integer', minimum: 1, maximum: 30 },
      },
      ['mode'],
    ),
  },
  {
    name: 'get_transcript',
    description: 'Words with timings for a source range.',
    parameters: obj({ sourceId, rangeMs: range, withSpeakers: { type: 'boolean' } }, ['sourceId', 'rangeMs']),
  },
  {
    name: 'analyze_visual',
    description: 'Laughs, reactions, actions, faces, on-screen text (Gemini, costs $).',
    parameters: obj(
      {
        sourceId,
        rangeMs: range,
        questions: { type: 'array', maxItems: 5, items: { type: 'string', maxLength: 200 } },
      },
      ['sourceId', 'rangeMs'],
    ),
  },
  {
    name: 'get_audio_energy',
    description: 'RMS, valleys, bursts, silences.',
    parameters: obj({ sourceId, rangeMs: range, hopMs: { enum: [5, 10, 20] } }, ['sourceId', 'rangeMs']),
  },
  {
    name: 'get_layout_info',
    description: 'Content type, faces, suggested layout.',
    parameters: obj({ sourceId, rangeMs: range }, ['sourceId', 'rangeMs']),
  },
  {
    name: 'get_beats',
    description: 'BPM + beats of a library music asset.',
    parameters: obj({ musicAssetId: { type: 'string' } }, ['musicAssetId']),
  },
  {
    name: 'create_project',
    description: 'Start this output (new project). Once per output.',
    parameters: obj(
      {
        title: { type: 'string', maxLength: 120 },
        sources: { type: 'array', minItems: 1, items: sourceId },
        aspect: { enum: ['9:16', '1:1', '4:5', '16:9'] },
        outputType: { enum: ['single_payoff', 'montage', 'story'] },
      },
      ['title', 'sources', 'aspect', 'outputType'],
    ),
  },
  {
    name: 'add_clip_segment',
    description: 'Add a kept source span. Returns segmentId.',
    parameters: obj(
      {
        sourceId,
        srcInMs: int,
        srcOutMs: int,
        atIndex: int,
        beat: { enum: ['hook', 'setup', 'build', 'payoff', 'reaction', 'tag', 'bridge'] },
      },
      ['sourceId', 'srcInMs', 'srcOutMs'],
    ),
  },
  {
    name: 'trim_segment',
    description: 'Move a segment in/out.',
    parameters: obj({ segmentId: { type: 'string' }, srcInMs: int, srcOutMs: int }, ['segmentId']),
  },
  {
    name: 'split_segment',
    description: 'Split at a source ms (videoSplits).',
    parameters: obj({ atSrcMs: int }, ['atSrcMs']),
  },
  {
    name: 'cut_range',
    description: 'Remove a span inside kept material (refined to audio valleys).',
    parameters: obj(
      { sourceId, srcInMs: int, srcOutMs: int, kind: { enum: ['gap', 'filler', 'manual'] } },
      ['sourceId', 'srcInMs', 'srcOutMs', 'kind'],
    ),
  },
  {
    name: 'reorder_segments',
    description: 'Set segment order.',
    parameters: obj({ order: { type: 'array', minItems: 1, maxItems: 64, items: { type: 'string' } } }, ['order']),
  },
  {
    name: 'set_transition',
    description: 'Transition INTO segment atSegment.',
    parameters: obj(
      {
        atSegment: { type: 'string' },
        type: { enum: ['cut', 'whip', 'flash', 'zoom', 'dissolve', 'fade_black'] },
        durMs: { type: 'integer', minimum: 100, maximum: 2000 },
      },
      ['atSegment', 'type'],
    ),
  },
  {
    name: 'set_split_edit',
    description: 'J-cut (negative) / L-cut (positive) into atSegment.',
    parameters: obj(
      { atSegment: { type: 'string' }, audioOffsetMs: { type: 'integer', minimum: -10000, maximum: 10000 } },
      ['atSegment', 'audioOffsetMs'],
    ),
  },
  {
    name: 'add_caption_track',
    description: 'Editable captions (never burned).',
    parameters: obj({
      presetId: { type: 'string' },
      wordsPerLine: { type: 'integer', minimum: 1, maximum: 8 },
      animation: { type: 'string' },
      position: { type: 'string' },
      keywordHighlight: { type: 'boolean' },
      activeStyle: { type: 'string' },
    }),
  },
  {
    name: 'set_layout',
    description: 'Layout mode, optionally per output range.',
    parameters: obj({ mode: { enum: ['auto', 'speaker_follow', 'full_frame', 'fit_blur', 'facecam_stack'] } }, ['mode']),
  },
  {
    name: 'add_zoom',
    description: 'Punch-in keyframes on video (output ms).',
    parameters: obj(
      {
        outInMs: int,
        outOutMs: int,
        scale: { type: 'number', minimum: 1, maximum: 1.5 },
        ease: { enum: ['snap', 'smooth'] },
        anchor: { enum: ['face', 'center'] },
      },
      ['outInMs', 'outOutMs', 'scale', 'ease'],
    ),
  },
  {
    name: 'add_text',
    description: 'Text item (hook/label/meme).',
    parameters: obj(
      {
        text: { type: 'string', minLength: 1, maxLength: 200 },
        outInMs: int,
        durMs: { type: 'integer', minimum: 300, maximum: 15000 },
        style: { type: 'string' },
        kind: { enum: ['hook', 'label', 'meme'] },
      },
      ['text', 'outInMs', 'durMs', 'kind'],
    ),
  },
  {
    name: 'add_music',
    description: 'Library music bed. No paid generation.',
    parameters: obj(
      {
        assetId: { type: 'string' },
        outInMs: int,
        outOutMs: int,
        volumeDb: { type: 'number', minimum: -40, maximum: 0 },
        duckUnderSpeech: { const: true },
        fadeInMs: int,
        fadeOutMs: int,
      },
      ['assetId', 'outInMs', 'volumeDb', 'duckUnderSpeech'],
    ),
  },
  {
    name: 'add_sfx',
    description: 'SFX at an output ms.',
    parameters: obj(
      { sfxId: { type: 'string' }, outMs: int, volumeDb: { type: 'number', minimum: -40, maximum: 0 } },
      ['sfxId', 'outMs'],
    ),
  },
  {
    name: 'set_speed',
    description: 'Speed on a source span.',
    parameters: obj(
      { srcInMs: int, srcOutMs: int, rate: { type: 'number', minimum: 0.25, maximum: 4 } },
      ['srcInMs', 'srcOutMs', 'rate'],
    ),
  },
  {
    name: 'set_freeze',
    description: 'Freeze frame.',
    parameters: obj({ atSrcMs: int, durMs: { type: 'integer', minimum: 200, maximum: 10000 } }, ['atSrcMs', 'durMs']),
  },
  {
    name: 'set_loudness',
    description: 'Target loudness.',
    parameters: obj({ lufs: { enum: [-14, -16, -18] } }, ['lufs']),
  },
  {
    name: 'preview_render',
    description: 'Draft render (separate artifact).',
    parameters: obj({ quality: { const: 'draft' }, rangeMs: range }, ['quality']),
  },
  {
    name: 'self_review',
    description: 'Rulebook §14 checks on the render.',
    parameters: obj({ renderId: { type: 'string' } }, ['renderId']),
  },
  {
    name: 'validate_plan',
    description: 'Run the deterministic validator on the current draft.',
    parameters: obj({}),
  },
  {
    name: 'finish_edit',
    description: 'Done with this output.',
    parameters: obj(
      {
        story: { type: 'string', maxLength: 1000 },
        selfReviewExpectations: { type: 'array', items: { type: 'string' }, maxItems: 10 },
        brokenRules: {
          type: 'array',
          items: obj(
            {
              ruleId: { type: 'string' },
              reason: { type: 'string' },
              severity: { enum: ['DEFAULT', 'HEURISTIC'] },
            },
            ['ruleId', 'reason'],
          ),
        },
      },
      ['story'],
    ),
  },
]

const EDIT = [
  'add_clip_segment',
  'trim_segment',
  'split_segment',
  'cut_range',
  'reorder_segments',
  'set_transition',
  'set_split_edit',
  'add_caption_track',
  'set_layout',
  'add_zoom',
  'add_text',
  'add_music',
  'add_sfx',
  'set_speed',
  'set_freeze',
  'set_loudness',
]
const ANALYSIS = [
  'find_moments',
  'get_transcript',
  'analyze_visual',
  'get_audio_energy',
  'get_layout_info',
  'get_beats',
]

export function toolsForPhase(p: Phase, b: 'ok' | 'soft' | 'hard'): ToolSchema[] {
  const pick = (n: string[]) => TOOL_SCHEMAS.filter((t) => n.includes(t.name))
  if (b === 'soft') return pick(['validate_plan', 'finish_edit', 'trim_segment', 'cut_range'])
  if (p === 'self_review') return pick([...EDIT, 'get_transcript', 'get_audio_energy', 'validate_plan', 'finish_edit'])
  return pick([...ANALYSIS, 'create_project', ...EDIT, 'validate_plan', 'finish_edit'])
}

export const AI_PRODUCER_TOOL_NAMES = TOOL_SCHEMAS.map((t) => t.name)
