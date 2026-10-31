#!/usr/bin/env node
/**
 * Generate worker/clips_worker/t6_registry.py from JSON registries.
 * Usage: node scripts/gen-t6-registries.mjs [--check]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const templatesDir = path.join(root, 'new-app/lib/clips/templates')
const templateJson = path.join(templatesDir, 'template-registry.json')
const captionV2Json = path.join(templatesDir, 'caption-presets-v2.json')
const titleJson = path.join(templatesDir, 'title-styles.json')
const pyOut = path.join(root, 'worker/clips_worker/t6_registry.py')
const fixturesSrc = path.join(templatesDir, '__fixtures__')
const fixturesDst = path.join(root, 'worker/clips_worker/tests/t6_fixtures')

const LEGACY_MODES = new Set([
  'speaker_follow',
  'fit_blur',
  'fit_top',
  'full_frame',
  'center_crop',
  'fill',
  'facecam_stack',
  'facecam_pip',
  'screen_pip',
  'split',
  'grid3',
  'grid4',
])

function panel(role, y, h, src, fit = 'cover', extra = {}) {
  return { role, y, h, src, fit, focus: 'center', ...extra }
}

function band(y, h, fill) {
  return { y, h, fill }
}

/** Source-of-truth template list (also written to template-registry.json on --write-json). */
export const TEMPLATE_SEED = [
  {
    id: 'G1',
    lane: 'gaming',
    name: 'Cam Stack',
    fallbackMode: 'facecam_stack',
    requires: { facecam: true },
    panels: [
      panel('face', 0, 0.35, 'facecam_box', 'cover', { adjust: { param: 'split', min: 0.25, max: 0.5 } }),
      panel('game', 0.35, 0.65, 'action_box_widened', 'cover'),
    ],
    captions: { anchor: 'seam', y: 0.35 },
    pickWeights: { facecam_conf: 2, action_wide: 1 },
  },
  {
    id: 'G2',
    lane: 'gaming',
    name: 'Title + Stack',
    fallbackMode: 'facecam_stack',
    requires: { facecam: true },
    bands: [band(0, 0.15, 'black')],
    panels: [
      panel('game', 0.15, 0.5, 'action_box_widened', 'cover'),
      panel('face', 0.65, 0.35, 'facecam_box', 'cover'),
    ],
    title: { slot: 'band_top', allowed: ['white_on_black', 'white_on_dark_blur'] },
    captions: { anchor: 'seam', y: 0.65 },
  },
  {
    id: 'G3',
    lane: 'gaming',
    name: 'Game PiP',
    fallbackMode: 'facecam_pip',
    requires: { facecam: true },
    panels: [panel('game', 0, 1, 'action_box', 'cover')],
    pip: { src: 'facecam_box', w: 0.3, shape: 'circle', corner: 'auto_far_from_action' },
    captions: { anchor: 'y', y: 0.72 },
  },
  {
    id: 'G4',
    lane: 'gaming',
    name: 'Full Frame Blur',
    fallbackMode: 'fit_blur',
    panels: [panel('frame', 0.33, 0.32, 'full', 'contain_blur')],
    bands: [band(0, 0.33, 'blur'), band(0.65, 0.35, 'blur')],
    captions: { anchor: 'band_bottom', y: 0.65 },
  },
  {
    id: 'G5',
    lane: 'gaming',
    name: 'Track Action',
    fallbackMode: 'fill',
    panels: [panel('game', 0, 1, 'action_box', 'cover', { track: 'action_box' })],
    motion: { kind: 'track', src: 'action_box' },
    captions: { anchor: 'y', y: 0.65 },
  },
  {
    id: 'G6',
    lane: 'gaming',
    name: 'Face Focus',
    fallbackMode: 'facecam_stack',
    requires: { facecam: true },
    panels: [
      panel('face', 0, 0.55, 'face_tight', 'cover'),
      panel('game', 0.55, 0.45, 'action_box_widened', 'cover'),
    ],
    captions: { anchor: 'seam', y: 0.55 },
  },
  {
    id: 'I1',
    lane: 'irl',
    name: 'Letterbox Black',
    fallbackMode: 'fit_blur',
    bands: [band(0, 0.31, 'black'), band(0.63, 0.37, 'black')],
    panels: [panel('frame', 0.31, 0.32, 'full', 'contain_black')],
    title: { slot: 'band_top', allowed: ['white_on_black'] },
    captions: { anchor: 'band_bottom', y: 0.63 },
  },
  {
    id: 'I2',
    lane: 'irl',
    name: 'Blur Title Box',
    fallbackMode: 'fit_blur',
    bands: [band(0, 0.28, 'blur'), band(0.6, 0.4, 'blur')],
    panels: [panel('frame', 0.28, 0.32, 'full', 'contain_blur')],
    title: { slot: 'on_video_top', allowed: ['white_box_black'] },
    captions: { anchor: 'band_bottom', y: 0.6 },
  },
  {
    id: 'I3',
    lane: 'irl',
    name: 'Full Blur',
    fallbackMode: 'fit_blur',
    bands: [band(0, 0.31, 'blur'), band(0.63, 0.37, 'blur')],
    panels: [panel('frame', 0.31, 0.32, 'full', 'contain_blur')],
    captions: { anchor: 'band_bottom', y: 0.63 },
  },
  {
    id: 'I4',
    lane: 'irl',
    name: '4:5 Action',
    fallbackMode: 'fit_blur',
    bands: [band(0, 0.19, 'black'), band(0.83, 0.17, 'black')],
    panels: [panel('action', 0.19, 0.64, 'trim_sides', 'contain_black', { x: 0, w: 1 })],
    title: { slot: 'band_top', allowed: ['white_on_black'] },
    captions: { anchor: 'y', y: 0.75 },
  },
  {
    id: 'I5',
    lane: 'irl',
    name: 'Single Person',
    fallbackMode: 'speaker_follow',
    requires: { noBackgroundAction: true, maxPersons: 1 },
    panels: [panel('person', 0, 1, 'person:0', 'cover')],
    captions: { anchor: 'y', y: 0.65 },
  },
  {
    id: 'I6',
    lane: 'irl',
    name: 'Split People',
    fallbackMode: 'split',
    requires: { noBackgroundAction: true, personCountMin: 2 },
    panels: [panel('a', 0, 0.5, 'person:0', 'cover'), panel('b', 0.5, 0.5, 'person:1', 'cover')],
    captions: { anchor: 'y', y: 0.65 },
  },
  {
    id: 'C1',
    lane: 'just_chatting',
    families: ['podcast'],
    familyRequires: { podcast: { maxPersons: 1 } },
    name: 'Face Tight',
    fallbackMode: 'center_crop',
    requires: { noBackgroundAction: true },
    panels: [panel('face', 0, 1, 'face_tight', 'cover')],
    captions: { anchor: 'y', y: 0.65 },
  },
  {
    id: 'C2',
    lane: 'just_chatting',
    families: ['podcast'],
    name: 'Active Speaker',
    fallbackMode: 'speaker_follow',
    panels: [panel('speaker', 0, 1, 'active_speaker', 'cover')],
    captions: { anchor: 'y', y: 0.65 },
  },
  {
    id: 'C3',
    lane: 'just_chatting',
    families: ['podcast'],
    name: 'Content + Face',
    fallbackMode: 'facecam_stack',
    requires: { contentBox: true },
    panels: [
      panel('content', 0, 0.55, 'content_box', 'cover'),
      panel('face', 0.55, 0.45, 'facecam_box', 'cover'),
    ],
    captions: { anchor: 'seam', y: 0.55 },
  },
  {
    id: 'C4',
    lane: 'just_chatting',
    families: ['podcast'],
    familyRequires: { podcast: { maxPersons: 1 } },
    name: 'Push In Face',
    fallbackMode: 'center_crop',
    requires: { noBackgroundAction: true, maxDurationSec: 20 },
    panels: [panel('face', 0, 1, 'face_tight', 'cover')],
    motion: { kind: 'push_in', from: 1.0, to: 1.15 },
    captions: { anchor: 'y', y: 0.65 },
  },
  {
    id: 'C5',
    lane: 'just_chatting',
    families: ['podcast'],
    familyRequires: { podcast: { maxPersons: 2 } },
    name: 'Dual Cam',
    fallbackMode: 'split',
    requires: { personCountMin: 2 },
    panels: [panel('a', 0, 0.5, 'person:0', 'cover'), panel('b', 0.5, 0.5, 'person:1', 'cover')],
    captions: { anchor: 'y', y: 0.65 },
  },
  {
    id: 'C6',
    lane: 'just_chatting',
    families: ['podcast'],
    name: 'Blur Frame',
    fallbackMode: 'fit_blur',
    bands: [band(0, 0.33, 'blur'), band(0.65, 0.35, 'blur')],
    panels: [panel('frame', 0.33, 0.32, 'full', 'contain_blur')],
    captions: { anchor: 'band_bottom', y: 0.65 },
  },
  {
    id: 'C7',
    lane: 'podcast',
    name: 'Stage Card',
    fallbackMode: 'fit_blur',
    bands: [band(0, 0.12, 'dark_gradient'), band(0.55, 0.45, 'black')],
    panels: [
      panel('card', 0.12, 0.43, 'active_speaker', 'cover', { x: 0.0625, w: 0.875 }),
    ],
    title: { slot: 'on_video_top', allowed: ['white_on_black', 'white_box_black'] },
    captions: { anchor: 'y', y: 0.58 },
  },
  {
    id: 'C8',
    lane: 'podcast',
    name: 'Grid',
    fallbackMode: 'grid4',
    requires: { personCountMin: 3 },
    panels: [
      panel('p0', 0, 0.5, 'person:0', 'cover', { x: 0, w: 0.5 }),
      panel('p1', 0, 0.5, 'person:1', 'cover', { x: 0.5, w: 0.5 }),
      panel('p2', 0.5, 0.5, 'person:2', 'cover', { x: 0, w: 0.5 }),
      panel('p3', 0.5, 0.5, 'person:3', 'cover', { x: 0.5, w: 0.5 }),
    ],
    captions: { anchor: 'y', y: 0.65 },
  },
  {
    id: 'C9',
    lane: 'podcast',
    name: 'Screen + Speaker',
    fallbackMode: 'screen_pip',
    requires: { contentBox: true },
    panels: [
      panel('screen', 0, 0.6, 'content_box', 'cover'),
      panel('speaker', 0.6, 0.4, 'active_speaker', 'cover'),
    ],
    captions: { anchor: 'seam', y: 0.6 },
  },
]

function normalizeTemplate(t) {
  return {
    requires: {
      facecam: false,
      maxPersons: null,
      noBackgroundAction: false,
      contentBox: false,
      personCountMin: null,
      maxDurationSec: null,
      ...(t.requires || {}),
    },
    bands: t.bands || [],
    title: t.title || { slot: 'none', allowed: [] },
    captions: t.captions || { anchor: 'y', y: 0.65 },
    pip: t.pip ?? null,
    motion: t.motion ?? null,
    pickWeights: t.pickWeights || {},
    ...t,
  }
}

const CAPTION_V2_SEED = {
  cp1: {
    name: 'Punch',
    lanes: ['just_chatting', 'podcast', 'irl'],
    font: 'Montserrat',
    weight: 900,
    case: 'upper',
    sizePx1920: 92,
    wordsPerChunk: 3,
    maxLines: 2,
    fill: '#FFFFFF',
    stroke: { color: '#000000', px: 9 },
    shadow: { color: '#000000', px: 3, blur: 0 },
    box: null,
    highlight: { mode: 'color', color: '#FFD93D', altColor: '#39FF14', keywordsPerChunk: 1 },
    animation: { kind: 'pop', ms: 200, shake: false, emoji: false },
    position: { anchor: 'y', y: 0.65 },
    titlePair: ['white_on_dark_blur', 'white_box_black'],
  },
  cp2: {
    name: 'Game HUD',
    lanes: ['gaming'],
    font: 'Bangers',
    weight: 400,
    case: 'upper',
    sizePx1920: 88,
    wordsPerChunk: 2,
    maxLines: 2,
    fill: '#FFFFFF',
    stroke: { color: '#000000', px: 10 },
    shadow: { color: '#000000', px: 2, blur: 0 },
    box: null,
    highlight: { mode: 'supersize', color: '#FFD93D', altColor: '#39FF14', keywordsPerChunk: 1 },
    animation: { kind: 'stomp', ms: 180, shake: true, emoji: false },
    position: { anchor: 'y', y: 0.68 },
    titlePair: ['white_on_dark_blur'],
  },
  cp3: {
    name: 'Boxed Bold',
    lanes: ['gaming', 'irl', 'just_chatting', 'podcast'],
    font: 'Montserrat',
    weight: 900,
    case: 'upper',
    sizePx1920: 78,
    wordsPerChunk: 3,
    maxLines: 2,
    fill: '#FFFFFF',
    stroke: { color: '#000000', px: 6 },
    shadow: { color: '#000000', px: 0, blur: 0 },
    box: { color: '#000000', opacity: 0.6, radiusPx: 12, padX: 18, padY: 8 },
    highlight: { mode: 'box', color: '#FFD93D', altColor: '#39FF14', keywordsPerChunk: 1 },
    animation: { kind: 'box_glide', ms: 220, shake: false, emoji: false },
    position: { anchor: 'y', y: 0.65 },
    titlePair: ['white_box_black'],
  },
  cp4: {
    name: 'Reaction',
    lanes: ['irl', 'just_chatting', 'gaming'],
    font: 'Bangers',
    weight: 400,
    case: 'upper',
    sizePx1920: 96,
    wordsPerChunk: 2,
    maxLines: 2,
    fill: '#FFFFFF',
    stroke: { color: '#000000', px: 8 },
    shadow: { color: '#000000', px: 4, blur: 0 },
    box: null,
    highlight: { mode: 'color', color: '#FFD93D', altColor: '#FF6B6B', keywordsPerChunk: 2 },
    animation: { kind: 'flash', ms: 120, shake: false, emoji: true },
    position: { anchor: 'y', y: 0.62 },
    titlePair: ['white_on_dark_blur'],
  },
  cp5: {
    name: 'Soft Podcast',
    lanes: ['podcast', 'just_chatting'],
    font: 'Inter',
    weight: 700,
    case: 'sentence',
    sizePx1920: 72,
    wordsPerChunk: 4,
    maxLines: 2,
    fill: '#FFFFFF',
    stroke: { color: '#000000', px: 4 },
    shadow: { color: '#000000', px: 2, blur: 0 },
    box: null,
    highlight: { mode: 'weight', color: '#FFD93D', altColor: '#39FF14', keywordsPerChunk: 1 },
    animation: { kind: 'fade', ms: 200, shake: false, emoji: false },
    position: { anchor: 'y', y: 0.7 },
    titlePair: ['white_on_black'],
  },
  cp6: {
    name: 'Hype Short',
    lanes: ['gaming'],
    font: 'Luckiest Guy',
    weight: 400,
    case: 'upper',
    sizePx1920: 100,
    wordsPerChunk: 2,
    maxLines: 1,
    fill: '#FFFFFF',
    stroke: { color: '#000000', px: 10 },
    shadow: { color: '#000000', px: 3, blur: 0 },
    box: null,
    highlight: { mode: 'supersize', color: '#39FF14', altColor: '#FFD93D', keywordsPerChunk: 1 },
    animation: { kind: 'stomp', ms: 160, shake: true, emoji: false },
    position: { anchor: 'y', y: 0.66 },
    titlePair: ['white_on_dark_blur'],
  },
  cp7: {
    name: 'Stage',
    lanes: ['podcast'],
    font: 'Archivo Black',
    weight: 400,
    case: 'upper',
    sizePx1920: 80,
    wordsPerChunk: 3,
    maxLines: 2,
    fill: '#FFFFFF',
    stroke: { color: '#000000', px: 8 },
    shadow: { color: '#000000', px: 0, blur: 0 },
    box: { color: '#000000', opacity: 0.55, radiusPx: 10, padX: 16, padY: 6 },
    highlight: { mode: 'underline', color: '#FFD93D', altColor: '#39FF14', keywordsPerChunk: 1 },
    animation: { kind: 'underline_draw', ms: 240, shake: false, emoji: false },
    position: { anchor: 'y', y: 0.58 },
    titlePair: ['white_box_black'],
  },
  cp8: {
    name: 'Karaoke Dim',
    lanes: ['just_chatting', 'podcast'],
    font: 'Montserrat',
    weight: 800,
    case: 'upper',
    sizePx1920: 84,
    wordsPerChunk: 4,
    maxLines: 2,
    fill: '#FFFFFF',
    stroke: { color: '#000000', px: 6 },
    shadow: { color: '#000000', px: 2, blur: 0 },
    box: null,
    highlight: { mode: 'karaoke_dim', color: '#FFD93D', altColor: '#39FF14', keywordsPerChunk: 0 },
    animation: { kind: 'word_fade', ms: 180, shake: false, emoji: false },
    position: { anchor: 'y', y: 0.65 },
    titlePair: ['white_on_dark_blur'],
  },
  cp9: {
    name: 'Alt Pop',
    lanes: ['just_chatting'],
    font: 'Bebas Neue',
    weight: 400,
    case: 'upper',
    sizePx1920: 90,
    wordsPerChunk: 3,
    maxLines: 2,
    fill: '#FFFFFF',
    stroke: { color: '#000000', px: 8 },
    shadow: { color: '#000000', px: 3, blur: 0 },
    box: null,
    highlight: { mode: 'color', color: '#39FF14', altColor: '#FFD93D', keywordsPerChunk: 1 },
    animation: { kind: 'pop', ms: 200, shake: false, emoji: false },
    position: { anchor: 'y', y: 0.65 },
    titlePair: ['white_on_dark_blur'],
  },
  cp10: {
    name: 'Clean IRL',
    lanes: ['irl'],
    font: 'Lato',
    weight: 900,
    case: 'sentence',
    sizePx1920: 76,
    wordsPerChunk: 3,
    maxLines: 2,
    fill: '#FFFFFF',
    stroke: { color: '#000000', px: 7 },
    shadow: { color: '#000000', px: 2, blur: 0 },
    box: null,
    highlight: { mode: 'color', color: '#FFD93D', altColor: '#2563EB', keywordsPerChunk: 1 },
    animation: { kind: 'fade', ms: 180, shake: false, emoji: false },
    position: { anchor: 'y', y: 0.65 },
    titlePair: ['black_on_light_blur'],
  },
  cp11: {
    name: 'Light BG',
    lanes: ['irl'],
    font: 'Inter',
    weight: 800,
    case: 'sentence',
    sizePx1920: 74,
    wordsPerChunk: 3,
    maxLines: 2,
    fill: '#111111',
    stroke: { color: '#FFFFFF', px: 0 },
    shadow: { color: '#000000', px: 0, blur: 0 },
    box: { color: '#FFFFFF', opacity: 0.85, radiusPx: 8, padX: 14, padY: 6 },
    highlight: { mode: 'box', color: '#FFD93D', altColor: '#39FF14', keywordsPerChunk: 1 },
    animation: { kind: 'none', ms: 0, shake: false, emoji: false },
    position: { anchor: 'y', y: 0.65 },
    titlePair: ['black_on_light_blur'],
  },
  cp12: {
    name: 'Deferred',
    lanes: [],
    deferred: true,
    font: 'Montserrat',
    weight: 900,
    case: 'upper',
    sizePx1920: 80,
    wordsPerChunk: 3,
    maxLines: 2,
    fill: '#FFFFFF',
    stroke: { color: '#000000', px: 8 },
    shadow: { color: '#000000', px: 0, blur: 0 },
    box: null,
    highlight: { mode: 'none', color: '#FFD93D', altColor: '#39FF14', keywordsPerChunk: 0 },
    animation: { kind: 'none', ms: 0, shake: false, emoji: false },
    position: { anchor: 'y', y: 0.65 },
    titlePair: [],
  },
}

const TITLE_STYLES = {
  white_on_black: {
    text: '#FFFFFF',
    bg: { kind: 'band', color: '#000000' },
    stroke: 0,
    shadow: 0,
    font: 'Anton',
    case: 'upper',
  },
  white_on_dark_blur: {
    text: '#FFFFFF',
    bg: { kind: 'blur' },
    stroke: 0,
    shadow: { px: 4, color: '#000000A0' },
    font: 'Anton',
    case: 'upper',
  },
  black_on_light_blur: {
    text: '#111111',
    bg: { kind: 'blur' },
    stroke: 0,
    shadow: 0,
    font: 'Anton',
    case: 'upper',
  },
  white_box_black: {
    text: '#000000',
    bg: { kind: 'box', color: '#FFFFFF', radiusPx: 18, padX: 28, padY: 14 },
    font: 'Anton',
    case: 'upper',
  },
}

function ensureJsonFiles() {
  if (!fs.existsSync(templateJson)) {
    fs.writeFileSync(templateJson, JSON.stringify(TEMPLATE_SEED.map(normalizeTemplate), null, 2))
  }
  if (!fs.existsSync(captionV2Json)) {
    fs.writeFileSync(captionV2Json, JSON.stringify(CAPTION_V2_SEED, null, 2))
  }
  if (!fs.existsSync(titleJson)) {
    fs.writeFileSync(titleJson, JSON.stringify(TITLE_STYLES, null, 2))
  }
}

function copyFixtures() {
  if (!fs.existsSync(fixturesSrc)) return
  fs.mkdirSync(fixturesDst, { recursive: true })
  for (const sub of ['geometry', 'pick', 'caption-model']) {
    const src = path.join(fixturesSrc, sub)
    const dst = path.join(fixturesDst, sub)
    if (!fs.existsSync(src)) continue
    fs.mkdirSync(dst, { recursive: true })
    for (const f of fs.readdirSync(src)) {
      if (f.endsWith('.json')) {
        fs.copyFileSync(path.join(src, f), path.join(dst, f))
      }
    }
  }
}

function pyLiteral(obj, indent = 0) {
  const sp = '  '.repeat(indent)
  if (obj === null) return 'None'
  if (typeof obj === 'boolean') return obj ? 'True' : 'False'
  if (typeof obj === 'number') return String(obj)
  if (typeof obj === 'string') return JSON.stringify(obj)
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]'
    return '[\n' + obj.map((v) => sp + '  ' + pyLiteral(v, indent + 1)).join(',\n') + '\n' + sp + ']'
  }
  const keys = Object.keys(obj)
  if (keys.length === 0) return '{}'
  return (
    '{\n' +
    keys
      .map((k) => `${sp}  ${JSON.stringify(k)}: ${pyLiteral(obj[k], indent + 1)}`)
      .join(',\n') +
    '\n' +
    sp +
    '}'
  )
}

function generatePy(templates, captions, titles) {
  return `"""DO NOT EDIT — generated by scripts/gen-t6-registries.mjs"""
from __future__ import annotations

TEMPLATES: dict[str, dict] = ${pyLiteral(Object.fromEntries(templates.map((t) => [t.id, t])))}

CAPTION_PRESETS_V2: dict[str, dict] = ${pyLiteral(captions)}

TITLE_STYLES: dict[str, dict] = ${pyLiteral(titles)}

TEMPLATE_IDS: tuple[str, ...] = tuple(TEMPLATES.keys())

LEGACY_LAYOUT_MODES: frozenset[str] = frozenset(${JSON.stringify([...LEGACY_MODES])})
`
}

ensureJsonFiles()
const templates = JSON.parse(fs.readFileSync(templateJson, 'utf8'))
const captions = JSON.parse(fs.readFileSync(captionV2Json, 'utf8'))
const titles = JSON.parse(fs.readFileSync(titleJson, 'utf8'))
const py = generatePy(templates, captions, titles)

const check = process.argv.includes('--check')
if (check) {
  const existing = fs.existsSync(pyOut) ? fs.readFileSync(pyOut, 'utf8') : ''
  if (existing !== py) {
    console.error('t6_registry.py is out of date; run node scripts/gen-t6-registries.mjs')
    process.exit(1)
  }
  console.log('gen-t6-registries: OK')
  process.exit(0)
}

fs.writeFileSync(pyOut, py)
copyFixtures()
console.log('Wrote', pyOut)
