import 'server-only'
import { clipsEditorJsonWithGeminiFallback } from '@/lib/server/ai/clips-editor-llm'
import { ANCHORS, EXIT_STYLES, SURFACES, VISUAL_TYPES, WORLD_TYPES, type Blueprint } from '@/lib/motion-studio/director-ops'

/** BE-10: the AI Director turns one chat message into concrete blueprint edits (validated by director-ops). */

const SYSTEM = `You are the AI Director inside Transovo Motion Studio. You direct a narrated motion-graphics documentary made
entirely from code: ONE designed world the camera travels through (a trading screen, a pinned map, an evidence board...),
one hero per narration line, every stamp, number and highlight landing on a SPOKEN word, real footage pushed into
(approach the surface, play the excerpt, return to the world, or a justified hard cut), and a score keyed to the story's beats.

The user asks for a change in plain words. Translate it into the SMALLEST set of concrete edits to the film's blueprint.
Never touch scenes the user did not ask about. Prefer one scene over many. Each item is one edit the user can accept or reject.

Allowed ops (JSON objects in items[].op):
- {"type":"scene","sceneIndex":N,"description"?:str,"visualType"?:one of ${JSON.stringify(VISUAL_TYPES)},"camera"?:str,"note"?:str}
  Redesign one GRAPHICS scene. description = what the frame shows (background, context, foreground hero). camera = the camera
  move for that scene (e.g. "slow push-in on the price tag, then whip pan right to the Reddit panel"). note = any other
  concrete direction for the scene designer (bigger labels, slower reveal, more contrast...).
- {"type":"emphasis","sceneIndex":N,"emphasis":[{"lineId":str,"word":str}]}  The words where visual hits land. Each word MUST be
  spoken in that line (copy it from the line text). Replaces the scene's emphasis list.
- {"type":"world","worldType":one of ${JSON.stringify(WORLD_TYPES)},"reason":str}  Change the whole world (re-renders every graphics scene; use only when asked).
- {"type":"style","palette"?:{"bg","ink","accent","accent2","muted" as #rrggbb},"mood"?:str,"grain"?:0-0.2,"glow"?:0-1,"vignette"?:0-1}  The film's look.
- {"type":"footage","sceneIndex":N,"inS"?:sec,"outS"?:sec,"surface"?:one of ${JSON.stringify(SURFACES)},"exitStyle"?:one of ${JSON.stringify(EXIT_STYLES)},"audioMode"?:"clip"|"mute","assetId"?:str}
  Edit a footage insert: which excerpt plays (inS/outS within the clip, at least 1.5 s), the surface the camera enters, how it
  returns, whether the clip's own sound plays (only when no narration runs over it), or swap to another uploaded clip.
- {"type":"music","anchors"?:{"pulse"|"build"|"peak"|"crash"|"resolve":{"lineId":str,"word":str}|null},"source"?:"generated"|"none"|"upload"}
  Move score cues: pulse = beat enters, build = drums build, peak = biggest hit, crash = everything cuts out (optional, null removes it),
  resolve = final swell. Each cue lands on a spoken word.
- {"type":"story","note":str}  Anything about the script, narration wording, facts, order of the story or adding/removing scenes
  or footage inserts. The plan is rewritten with this note.

Rules: use scene numbers as shown to the user (sceneIndex is 0-based; "scene 3" is sceneIndex 2). items[].text is a short,
specific imperative the user reads, e.g. "Scene 3: land the red stamp on 'arrest' and push the camera in on it". Never use
the dollar sign (write "483 dollars"), never name AI models or vendors, never mention prices or credits. If the request is
unclear, return no items and ask ONE short question in reply. At most 6 items.
Return JSON: {"reply": "one or two plain sentences", "items": [{"text": str, "op": {...}}]}`

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          op: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['scene', 'emphasis', 'world', 'style', 'footage', 'music', 'story'] },
              sceneIndex: { type: 'integer' }, description: { type: 'string' }, visualType: { type: 'string' }, camera: { type: 'string' },
              note: { type: 'string' }, worldType: { type: 'string' }, reason: { type: 'string' }, mood: { type: 'string' },
              grain: { type: 'number' }, glow: { type: 'number' }, vignette: { type: 'number' },
              palette: { type: 'object', properties: { bg: { type: 'string' }, ink: { type: 'string' }, accent: { type: 'string' }, accent2: { type: 'string' }, muted: { type: 'string' } } },
              emphasis: { type: 'array', items: { type: 'object', properties: { lineId: { type: 'string' }, word: { type: 'string' } }, required: ['lineId', 'word'] } },
              inS: { type: 'number' }, outS: { type: 'number' }, surface: { type: 'string' }, exitStyle: { type: 'string' },
              audioMode: { type: 'string' }, assetId: { type: 'string' }, source: { type: 'string' },
              anchors: { type: 'object', properties: Object.fromEntries(ANCHORS.map(k => [k, { type: 'object', nullable: true, properties: { lineId: { type: 'string' }, word: { type: 'string' } } }])) },
            },
            required: ['type'],
          },
        },
        required: ['text', 'op'],
      },
    },
  },
  required: ['reply', 'items'],
}

export type DirectorLlmOut = { reply: string; items: unknown[]; model: string }

export async function askDirector(input: {
  message: string
  focusSceneIndex: number | null
  stage: 'plan' | 'produced'
  blueprint: Blueprint
  recent: { role: string; text: string }[]
}): Promise<DirectorLlmOut> {
  const bp = input.blueprint
  const user = JSON.stringify({
    request: input.message,
    focusScene: input.focusSceneIndex != null ? { sceneIndex: input.focusSceneIndex, shownAs: `scene ${input.focusSceneIndex + 1}` } : null,
    stage: input.stage === 'produced' ? 'film rendered; accepted edits re-render only the affected segments' : 'plan only; nothing rendered yet',
    film: {
      title: bp.title, world: bp.world, style: bp.style, music: { source: bp.musicSource, anchors: bp.musicAnchors, uploadAvailable: bp.musicUploadAvailable },
      scenes: bp.scenes.map(x => ({ sceneIndex: x.index, shownAs: `scene ${x.index + 1}`, kind: x.kind, visualType: x.visualType, description: x.description,
        camera: x.camera, lines: x.lines, emphasis: x.emphasis, ...(x.startMs != null && x.endMs ? { atS: [Math.round(x.startMs / 100) / 10, Math.round(x.endMs / 100) / 10] } : {}),
        ...(x.handoff ? { footage: x.handoff } : {}) })),
      uploadedFootage: bp.footage,
    },
    recentChat: input.recent.slice(-8),
  })
  const r = await clipsEditorJsonWithGeminiFallback<{ reply?: unknown; items?: unknown }>({
    context: 'motion_studio_director', system: SYSTEM, user: user.slice(0, 120_000), responseSchema: RESPONSE_SCHEMA, maxOutputTokens: 4000,
  })
  return { reply: typeof r.data.reply === 'string' ? r.data.reply : '', items: Array.isArray(r.data.items) ? r.data.items : [], model: r.model }
}
