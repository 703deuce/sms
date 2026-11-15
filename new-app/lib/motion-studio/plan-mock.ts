import { MS_DIRECTIONS } from './config'
import type {
  MsAsset,
  MsChapter,
  MsMissingVisual,
  MsScene,
  MsSelectionKind,
  MsSettings,
  MsVisualType,
  MsWorkflow,
} from './types'

/** Deterministic plan used by the mock adapter (no AI, no network, no paid calls). */

const CHAPTER_TITLES = ['The setup', 'The spark', 'The turning point', 'The fallout', 'What it means']

type Treatment = {
  visualType: MsVisualType
  kind: MsSelectionKind
  treatment: string
  tags: string[]
  graphicName: string
  camera: string
  source: string
}

const TREATMENTS: Treatment[] = [
  { visualType: 'photo', kind: 'photo', treatment: 'Documentary photo reveal', tags: ['Photo', 'Code-rendered camera'], graphicName: 'Photo surface', camera: 'Slow push-in', source: 'Your uploads' },
  { visualType: 'text', kind: 'text', treatment: 'Animated interface', tags: ['Graphic', 'Original composition'], graphicName: 'Hero type', camera: 'Locked off', source: 'Script' },
  { visualType: 'chart', kind: 'chart', treatment: 'Custom motion graphic', tags: ['Code animation', 'Word-synced'], graphicName: 'Chart animation', camera: 'Push in / orbit', source: 'Research data' },
  { visualType: 'map', kind: 'scene', treatment: 'Map sequence', tags: ['Map', 'Code-rendered camera'], graphicName: 'World map', camera: 'Drift and settle', source: 'Research' },
  { visualType: 'diagram', kind: 'scene', treatment: 'Explainer diagram', tags: ['Diagram', 'Framework block'], graphicName: 'Connector diagram', camera: 'Pull out', source: 'Script' },
]

const FOOTAGE: Treatment = {
  visualType: 'footage',
  kind: 'clip',
  treatment: 'Cinematic Media Handoff',
  tags: ['Footage', 'Approach · Play · Return'],
  graphicName: 'Photo-to-footage handoff',
  camera: 'Camera enters photo',
  source: 'Your footage',
}

export function topicFromPrompt(prompt: string): string {
  const clean = prompt.replace(/\s+/g, ' ').trim()
  const about = /about (.+?)(?:[.!?]|,| make | in the style|$)/i.exec(clean)
  const raw = (about?.[1] ?? clean).trim()
  return raw.length > 64 ? `${raw.slice(0, 61).trim()}…` : raw || 'Untitled documentary'
}

export function titleFromPrompt(prompt: string, workflow: MsWorkflow): string {
  const topic = topicFromPrompt(prompt)
  if (!prompt.trim()) return workflow === 'footage' ? 'Untitled footage documentary' : 'Untitled documentary'
  const cased = topic.replace(/^the /i, '').replace(/^\w/, (c) => c.toUpperCase())
  return cased
}

function splitScript(script: string): string[] {
  return script
    .split(/\n\s*\n|(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function buildChapters(opts: { prompt: string; workflow: MsWorkflow; script?: string | null; seed: string }): MsChapter[] {
  const topic = topicFromPrompt(opts.prompt)
  const userLines = opts.workflow !== 'idea' && opts.script ? splitScript(opts.script) : []
  const count = userLines.length ? Math.min(5, Math.max(1, Math.ceil(userLines.length / 2))) : 5
  const chapters: MsChapter[] = []
  for (let c = 0; c < count; c++) {
    const id = `${opts.seed}_ch${c + 1}`
    let lines: MsChapter['lines']
    if (userLines.length) {
      const per = Math.ceil(userLines.length / count)
      lines = userLines.slice(c * per, c * per + per).map((text, i) => ({ id: `${id}_l${i + 1}`, text, sources: [] }))
    } else {
      const base = [
        `This chapter sets up ${topic} and the people at the center of it.`,
        `The narration explains why ${topic} mattered at this moment, with each claim tied to a source.`,
      ]
      lines = base.map((text, i) => ({
        id: `${id}_l${i + 1}`,
        text,
        sources: i === 1 ? [{ title: 'Research source (attached after grounded research)', url: 'https://en.wikipedia.org/wiki/Special:Search' }] : [],
      }))
    }
    chapters.push({
      id,
      index: c,
      title: CHAPTER_TITLES[c] ?? `Chapter ${c + 1}`,
      summary: userLines.length ? 'Organized from your script. Your words are kept exactly as written.' : `How ${topic} unfolds, part ${c + 1}.`,
      lines,
    })
  }
  return chapters
}

export function buildScenes(opts: {
  chapters: MsChapter[]
  settings: MsSettings
  assets: MsAsset[]
  seed: string
}): MsScene[] {
  const total = opts.settings.lengthMin * 60_000
  const perChapter = 3
  const count = opts.chapters.length * perChapter
  const sceneMs = Math.floor(total / count)
  const videos = opts.assets.filter((a) => a.kind === 'video')
  const photos = opts.assets.filter((a) => a.kind === 'photo')
  const style = MS_DIRECTIONS.find((d) => d.value === opts.settings.visualDirection)?.label ?? 'Cinematic documentary'
  const scenes: MsScene[] = []
  let v = 0
  let p = 0
  opts.chapters.forEach((ch, ci) => {
    for (let k = 0; k < perChapter; k++) {
      const index = ci * perChapter + k
      const useFootage = videos.length > 0 && k === 1
      const t = useFootage ? FOOTAGE : TREATMENTS[(index + ci) % TREATMENTS.length]!
      const startMs = index * sceneMs
      const endMs = index === count - 1 ? total : startMs + sceneMs
      const footage = useFootage ? videos[v++ % videos.length]! : null
      const photo = t.visualType === 'photo' && photos.length ? photos[p++ % photos.length]! : null
      const firstLine = ch.lines[k % Math.max(1, ch.lines.length)]?.text ?? ch.summary
      scenes.push({
        id: `${opts.seed}_s${index + 1}`,
        chapterId: ch.id,
        index,
        startMs,
        endMs,
        title: k === 0 ? ch.title : firstLine.length > 56 ? `${firstLine.slice(0, 53).trim()}…` : firstLine,
        treatment: t.treatment,
        description: describe(t, firstLine),
        visualType: t.visualType,
        kind: t.kind,
        reason: reasonFor(t, Boolean(photo)),
        tags: t.tags,
        graphicName: t.graphicName,
        style: `${style} · ${t.visualType === 'chart' ? 'data' : 'story'} variant`,
        camera: t.camera,
        source: footage ? footage.label : photo ? photo.label : t.source,
        text: t.kind === 'text' || t.kind === 'chart' ? ch.title : '',
        status: 'planned',
        thumbnailUrl: null,
        assetIds: [footage?.id, photo?.id].filter((x): x is string => Boolean(x)),
        handoff: footage
          ? { assetId: footage.id, approachMs: 1500, footageMs: Math.max(2000, sceneMs - 3000), returnMs: 1500, exit: 'return' }
          : null,
        version: 1,
      })
    }
  })
  return scenes
}

function describe(t: Treatment, line: string): string {
  switch (t.visualType) {
    case 'photo':
      return 'Your photo becomes a layered surface; the camera drifts in as the narrator sets the scene.'
    case 'chart':
      return 'Chart rises as the narrator reaches the key figure.'
    case 'text':
      return `Key line animates on: “${line.length > 60 ? `${line.slice(0, 57)}…` : line}”`
    case 'map':
      return 'A custom map frames where this part of the story takes place.'
    case 'footage':
      return 'Camera enters a photo, your clip plays, then the camera resumes its journey.'
    default:
      return 'A diagram connects the ideas in this beat.'
  }
}

function reasonFor(t: Treatment, hasPhoto: boolean): string {
  switch (t.visualType) {
    case 'footage':
      return 'Real footage carries the most weight here, so the director hands off from the world into your clip and back.'
    case 'photo':
      return hasPhoto ? 'A matching upload exists, so the director uses it as the anchor image.' : 'No matching photo was uploaded, so this becomes a code-rendered surface.'
    case 'chart':
      return 'The narration states a figure; a word-synced chart makes it land.'
    case 'map':
      return 'Location matters in this beat, so a map orients the viewer.'
    case 'text':
      return 'A strong line deserves typography rather than stock imagery.'
    default:
      return 'Abstract idea; a diagram explains it faster than footage.'
  }
}

export function buildMissingVisuals(chapters: MsChapter[], assets: MsAsset[], seed: string): MsMissingVisual[] {
  const visuals = assets.filter((a) => a.kind === 'photo' || a.kind === 'video').length
  if (visuals >= chapters.length) return []
  return chapters.slice(visuals).map((ch, i) => ({
    id: `${seed}_mv${i + 1}`,
    chapterId: ch.id,
    description: `No upload matches “${ch.title}”. A code-rendered graphic fills this beat unless you add a photo or clip.`,
  }))
}
