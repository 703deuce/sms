import { FACTORY_FAMILY_SEEDS, FACTORY_TREATMENTS,
  type FactoryFamilySeed, type FactoryTreatmentRecipe } from './b8-authoring-catalog'
import { validateTemplateDesign, validateTemplateFamily,
  type TemplateFamilyV1 } from './sequence-contract'
import type { VideoTemplateRelease } from './gallery'

const bold = FACTORY_TREATMENTS.find(recipe => recipe.id === 'bold')
if (!bold) throw new Error('Batch 9A requires the authored bold treatment')

const defaultMusic = {
  id: 'batch9a_anchor_bed_v1',
  generator: 'batch9a-pulse-v1' as const,
  sha256: '4fb1206922f32a40c53ae14780d721541eb1fe0c42259f666016b23d68a11d3e',
  durationFrames: 480,
  bpm: 150,
  beatEveryFrames: 3,
  author: 'Transovo AI',
  license: 'Transovo first-party original template music',
  revision: 'batch9a-audio-v1',
}

function authorAnchorFamily(seed: FactoryFamilySeed, recipe: FactoryTreatmentRecipe): TemplateFamilyV1 {
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
      transition: index === 0 ? 'cut' : { type: recipe.transition, durationFrames: 6 },
      motion: {
        from: { x: 0, scale: 100 },
        to: { x: index % 2 ? -4 : 4, scale: seed.category === 'depth' ? 108 : 103 },
        ease: 'inOut',
      },
    }
    at += durationFrames
    return slot
  })
  const totalFrames = at
  const titleFrames = Math.min(totalFrames,150)
  const outroFrames = Math.min(totalFrames,120)
  const secondaryY = recipe.y > 59 ? recipe.y - 13 : recipe.y + 13
  // The pulse bed exposes an audible subdivision every 3 frames. All F01-F10
  // authored shot lengths are multiples of 3, so every cut lands on a pulse.
  if (slots.some(slot => slot.startFrame % defaultMusic.beatEveryFrames !== 0 ||
      slot.durationFrames % defaultMusic.beatEveryFrames !== 0))
    throw new Error('Batch 9A anchor cut is off the first-party music grid: ' + seed.id)
  return validateTemplateFamily({
    schemaVersion:1,
    familyId:seed.id,
    revision:1,
    title:seed.title,
    tags:[seed.category,'batch9a_anchor','first_party_preview'],
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
      {
        id:'headline',defaultText:'Your story',maxChars:70,startFrame:0,durationFrames:titleFrames,
        x:recipe.x,y:recipe.y,font:recipe.headingFont,size:recipe.x < 40 || recipe.x > 60 ? 60 : 74,
        color:recipe.foreground,
        anim:{in:{type:recipe.enter,unit:'block',durMs:360},out:{type:'fade',unit:'block',durMs:260}},
      },
      {
        id:'closing_line',defaultText:'Make it yours',maxChars:65,
        startFrame:totalFrames-outroFrames,durationFrames:outroFrames,
        x:recipe.x,y:secondaryY,font:recipe.supportFont,size:44,color:recipe.foreground,
        anim:{in:{type:'fade',unit:'block',durMs:440},out:{type:'fade',unit:'block',durMs:260}},
      },
    ],
    graphics:[{
      id:'accent_shape',type:recipe.graphic,startFrame:0,durationFrames:Math.min(totalFrames,120),
      x:recipe.gx,y:recipe.gy,w:110,h:40,color:recipe.accent,
      anim:{in:{type:'slide_up',unit:'block',durMs:420},loop:{type:'pulse',periodMs:1800}},
    }],
  })
}

export const BATCH9A_ANCHOR_RELEASES: readonly VideoTemplateRelease[] =
  FACTORY_FAMILY_SEEDS.slice(0,10).map(seed => {
    const family=authorAnchorFamily(seed,bold)
    const design=validateTemplateDesign({
      schemaVersion:1,designId:seed.id+'_bold',revision:1,stylePackId:'bold',
      familyId:seed.id,familyRevision:1,musicPolicy:'licensed-only',
    },family)
    return {
      id:design.designId,
      title:seed.title,
      category:seed.category,
      description:'Batch 9A first-party anchor: beat-synced cuts, authored transitions, animated text and graphics, with a first-party pulse-bed soundtrack.',
      family,design,
      rights:'Preview release. Slot media remains user-owned; default soundtrack is an original Transovo first-party procedural composition copied into the workspace for preview/export.',
      requiredCapabilities:['clip_edits_v2','source_transforms','text_layers','music_track',
        'cross_source_transitions','frame_accurate_slots'],
      authoredDimensions:['font-hierarchy','text-placement','animation-choreography',
        'graphic-composition','transition-treatment','source-motion'],
      reviewed:false,
      previewRenderVerified:false,
      certificationStatus:'preview' as const,
      musicRequired:true,
      defaultMusic,
      previewStyle:{
        foreground:bold.foreground,accent:bold.accent,headingFont:bold.headingFont,
        supportFont:bold.supportFont,graphic:bold.graphic,enter:bold.enter,
      },
    }
  })

if (BATCH9A_ANCHOR_RELEASES.length !== 10 ||
    BATCH9A_ANCHOR_RELEASES.some((release,index)=>release.id !== 'f'+String(index+1).padStart(2,'0')+'_bold'))
  throw new Error('Batch 9A anchor manifest must contain F01-F10 bold in order')
