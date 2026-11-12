import { FACTORY_FAMILY_SEEDS, FACTORY_TREATMENTS,
  type FactoryFamilySeed, type FactoryTreatmentRecipe } from './b8-authoring-catalog'
import { validateTemplateDesign, validateTemplateFamily,
  type TemplateFamilyV1 } from './sequence-contract'
import type { VideoTemplateRelease } from './gallery'
import {
  BATCH9A_ANCHOR_TEXT_DESIGN,
  lastWordBoldMark,
  resolveTemplateTextLayer,
  templateTextAnimPreset,
  templateTextStylePreset,
} from './template-text-presets'

type Direction = readonly [
  recipeId:string, headline:string, closing:string, description:string,
  transition:FactoryTreatmentRecipe['transition'], motionScale:number, motionShift:number, headlineSize:number
]
/** Reference headline size at 1920px frame height (~11% — CapCut-scale hook at 720p/1080p export). */
const BATCH9A_HEADLINE_REF_H = 1920
const BATCH9A_HEADLINE_FRAC = 0.11
/** Hook sits on the vertical center line (closing stays nearer the lower third). */
const BATCH9A_HEADLINE_Y = 50
const batch9aHeadlinePx = (legacySize: number) =>
  Math.round(legacySize * (BATCH9A_HEADLINE_REF_H * BATCH9A_HEADLINE_FRAC) / 76)
const batch9aClosingPx = (legacyHeadline: number) => Math.round(44 * batch9aHeadlinePx(legacyHeadline) / 76)

/** Art direction: display-sans hooks; recipe id picks transition/motion/accent only (not serif body). */
const DIRECTIONS: Readonly<Record<string,Direction>> = {
  f01:['bold','WAIT FOR IT','THE REVEAL','Editorial cold-open reveal with a fast hook and clean final landing.','whip_pan',108,5,76],
  f02:['minimal','BEFORE','AFTER','Transformation-first comparison with restrained typography and a bright reveal beat.','dip_white',103,1,68],
  f03:['tech','NEW DROP','DETAILS THAT HIT','Product-launch rhythm with crisp tech type and punchy zoom accents.','zoom_blur',110,4,64],
  f04:['brush','A SMALL MOMENT','WORTH REMEMBERING','Personal mini-story with warmer typography and softer pacing.','crossfade',104,2,58],
  f05:['cinema','ADD DEPTH','LAYER THE STORY','Cinematic depth stack with deliberate parallax and dimensional pushes.','push_left',112,6,68],
  f06:['party','WEEKEND','ON REPEAT','Energetic lifestyle recap with scrapbook character and rhythmic wipes.','wipe_left',106,3,62],
  f07:['kids',"YOU'RE INVITED",'SAVE THE DATE','Celebratory invitation with a bright entrance and calmer information landing.','push_up',106,3,70],
  f08:['luxury',"TONIGHT'S TABLE",'STAY FOR DESSERT','Premium food atmosphere edit with elegant type and restrained dissolves.','crossfade',105,2,62],
  f09:['sport','DAY ONE','NOW','Athletic progress edit with hard hierarchy and whip-pan momentum.','whip_pan',109,4,72],
  f10:['tutorial','STEP BY STEP','TRY THIS NEXT','Creator tutorial with legible instructional type and steady directional continuity.','push_left',103,2,62],
}

export const BATCH9A_DEFAULT_MUSIC = {
  id: 'batch9a_anchor_groove_v2',
  generator: 'batch9a-groove-v2' as const,
  sha256: 'c418b398ea7dc14a92a16596b7687d190735e1f14947bc954e357d62ba6f1482',
  durationFrames: 480,
  bpm: 150,
  beatEveryFrames: 3,
  author: 'Transovo AI',
  license: 'Transovo first-party original template music',
  revision: 'batch9a-audio-v2',
}

function batch9aPreviewMedia(index: number, spriteSha: string) {
  const n = String(index + 1).padStart(2, '0')
  const base = '/clips/template-previews/f' + n + '_bold'
  return {
    spritePath: base + '.webp',
    frames: 4,
    columns: 4,
    sha256: spriteSha,
    posterPath: base + '_frame0.webp',
    framePosterPaths: [0, 1, 2, 3].map(col => base + '_frame' + col + '.webp'),
    posterWidth: 1080,
  } as const
}

const BATCH9A_PREVIEW_SPRITE_SHA = [
  '58ef2a887bda559f694d9e4672959a1ef75f7fb0af1dcbf6ce41f1efd2c122e5',
  '7a8145775fa34ceddf8c47e2c839cae871adffc43a5ae1a73c958fc193ac5c63',
  '279d895fb616d1f84a51214d771ce952fee78966a8a70cf5a319ffd69af38606',
  '3ed78acee0174b631acf0d065ab535ed3038d9fdd10438a5d30c06f2c2a5bac1',
  '26b57939e0f759966163379d39d9aa558cc9db18dd30b7e3b772af8418142e26',
  'ccd5f1e9f987b9d2c2097cf5f0a58eb9ae74ce578e1f94f276efd26f01917fa1',
  '03e79394ded98bbc6768bb05467c075894ff8ea4c072b0c9dcb936f7d3b69bb5',
  '17e030a72dcb7d710a596d0caa52e89cb4b60f3c7cd4916eaa0ce812637500e1',
  '45c9052aa72c277a00590dd1c8ca1ee54835643e088cc88fa219ba8a2f3af264',
  'bde7dc5f35299e825341937fcc8861c49fa7b05bac54eade599994a63ec65de9',
] as const

const BATCH9A_PREVIEW_MEDIA = BATCH9A_PREVIEW_SPRITE_SHA.map((sha, index) => batch9aPreviewMedia(index, sha))

function directionFor(seed:FactoryFamilySeed): {direction:Direction;recipe:FactoryTreatmentRecipe} {
  const direction=DIRECTIONS[seed.id]
  if(!direction) throw new Error('Missing Batch 9A art direction: '+seed.id)
  const recipe=FACTORY_TREATMENTS.find(item=>item.id===direction[0])
  if(!recipe) throw new Error('Missing Batch 9A style recipe: '+direction[0])
  return {direction,recipe}
}

function authorAnchorFamily(seed: FactoryFamilySeed, recipe: FactoryTreatmentRecipe, direction: Direction): TemplateFamilyV1 {
  const [,headline,closing,,transition,motionScale,motionShift,legacyHeadlineSize]=direction
  const headlineSize = batch9aHeadlinePx(legacyHeadlineSize)
  const closingSize = batch9aClosingPx(legacyHeadlineSize)
  const design = BATCH9A_ANCHOR_TEXT_DESIGN[seed.id]
  if (!design) throw new Error('Missing Batch 9A text design: ' + seed.id)
  if (!templateTextStylePreset(design.headline.stylePresetId) ||
      !templateTextAnimPreset(design.headline.animPresetId))
    throw new Error('Invalid Batch 9A headline presets: ' + seed.id)
  let at = 0
  const slots: TemplateFamilyV1['slots'] = seed.frames.map((durationFrames,index) => {
    const slot: TemplateFamilyV1['slots'][number] = {
      id: 'slot_' + String(index + 1).padStart(2,'0'),
      ordinal: index + 1,
      role: seed.roles[index]!,
      media: 'either',
      startFrame: at,
      durationFrames,
      fit: 'cover',
      sourceAudio: 'mute',
      handles: { headFrames: 6, tailFrames: 6 },
      transition: index === 0 ? 'cut' : {
        type: index === seed.frames.length - 1 ? 'crossfade' : transition,
        durationFrames: index === seed.frames.length - 1 ? 8 : 5,
      },
      motion: {
        from: { x: index % 2 ? motionShift : -motionShift, scale: 100 },
        to: { x: index % 2 ? -motionShift : motionShift, scale: motionScale },
        ease: 'inOut',
      },
      fx: seed.category === 'food' ? { contrast: 3, saturation: 9 } :
        seed.category === 'fitness' ? { contrast: 8, saturation: 5 } :
        seed.category === 'product' ? { contrast: 6, saturation: 6 } : { contrast: 3, saturation: 3 },
    }
    at += durationFrames
    return slot
  })
  const totalFrames = at
  const titleFrames = Math.min(totalFrames,Math.max(66,Math.round(seed.frames[0]! * 1.5)))
  const outroFrames = Math.min(totalFrames,Math.max(72,seed.frames[seed.frames.length-1]!))
  if (slots.some(slot => slot.startFrame % BATCH9A_DEFAULT_MUSIC.beatEveryFrames !== 0 ||
      slot.durationFrames % BATCH9A_DEFAULT_MUSIC.beatEveryFrames !== 0))
    throw new Error('Batch 9A anchor cut is off the first-party music grid: ' + seed.id)
  const headlineMarks = design.headline.marks ?? lastWordBoldMark(headline)
  return validateTemplateFamily({
    schemaVersion:1,
    familyId:seed.id,
    revision:3,
    title:seed.title,
    tags:[seed.category,'batch9a_anchor','first_party_preview',direction[0]],
    aspects:['9:16'],
    fps:30,
    totalFrames,
    slots,
    beatAnchors:slots.map(slot=>slot.startFrame),
    phraseAnchors:[
      {id:'opening',frame:0,textFieldId:'headline'},
      {id:'closing',frame:totalFrames-outroFrames,textFieldId:'closing_line'},
    ],
    texts:[
      resolveTemplateTextLayer({
        id:'headline',defaultText:headline,maxChars:40,startFrame:0,durationFrames:titleFrames,
        x:recipe.x,y:BATCH9A_HEADLINE_Y,font:design.headline.font,size:headlineSize,
        color:recipe.foreground,
        stylePresetId:design.headline.stylePresetId,
        animPresetId:design.headline.animPresetId,
        anim:{out:{type:'fade',unit:'block',durMs:260}},
        ...(headlineMarks ? { marks: headlineMarks } : {}),
      }, recipe.accent),
      resolveTemplateTextLayer({
        id:'closing_line',defaultText:closing,maxChars:44,
        startFrame:totalFrames-outroFrames,durationFrames:outroFrames,
        x:recipe.x,y:design.closing.y,font:design.closing.font,size:closingSize,
        color: design.closing.colorFromAccent ? '__accent__' : recipe.foreground,
        stylePresetId:design.closing.stylePresetId,
        animPresetId:design.closing.animPresetId,
        colorFromAccent: design.closing.colorFromAccent,
      }, recipe.accent),
    ],
    graphics:[{
      id:'accent_shape',type:recipe.graphic,startFrame:0,durationFrames:Math.min(totalFrames,120),
      x:recipe.gx,y:recipe.gy,w:['circle','star','heart','triangle'].includes(recipe.graphic)?44:124,
      h:['circle','star','heart','triangle'].includes(recipe.graphic)?44:16,color:recipe.accent,
      anim:{in:{type:'slide_up',unit:'block',durMs:420},loop:{type:'pulse',periodMs:1800}},
    }],
  })
}

export const BATCH9A_ANCHOR_RELEASES: readonly VideoTemplateRelease[] =
  FACTORY_FAMILY_SEEDS.slice(0,10).map((seed,index) => {
    const {direction,recipe}=directionFor(seed)
    const family=authorAnchorFamily(seed,recipe,direction)
    const design=validateTemplateDesign({
      schemaVersion:1,designId:seed.id+'_bold',revision:3,stylePackId:'batch9a_'+recipe.id,
      familyId:seed.id,familyRevision:3,musicPolicy:'licensed-only',
    },family)
    return {
      id:design.designId,
      title:seed.title,
      category:seed.category,
      description:direction[3],
      family,design,
      rights:'Preview release. Gallery preview imagery is first-party sample media; slot media remains user-owned. The default soundtrack is an original Transovo first-party procedural composition copied into the workspace for preview/export.',
      requiredCapabilities:['clip_edits_v2','source_transforms','text_layers','music_track',
        'cross_source_transitions','frame_accurate_slots'],
      authoredDimensions:['font-hierarchy','text-placement','animation-choreography',
        'graphic-composition','transition-treatment','source-motion'],
      reviewed:false,
      previewRenderVerified:false,
      certificationStatus:'preview' as const,
      musicRequired:true,
      defaultMusic:BATCH9A_DEFAULT_MUSIC,
      previewMedia:BATCH9A_PREVIEW_MEDIA[index]!,
      previewStyle:{
        foreground:recipe.foreground,accent:recipe.accent,
        headingFont:BATCH9A_ANCHOR_TEXT_DESIGN[seed.id]!.headline.font,
        supportFont:BATCH9A_ANCHOR_TEXT_DESIGN[seed.id]!.closing.font,
        graphic:recipe.graphic,enter:recipe.enter,
      },
    }
  })

if (BATCH9A_PREVIEW_MEDIA.length !== 10 ||
    BATCH9A_ANCHOR_RELEASES.length !== 10 ||
    BATCH9A_ANCHOR_RELEASES.some((release,index)=>release.id !== 'f'+String(index+1).padStart(2,'0')+'_bold'))
  throw new Error('Batch 9A anchor manifest must contain F01-F10 bold in order')
