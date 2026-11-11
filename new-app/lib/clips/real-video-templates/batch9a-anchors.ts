import { FACTORY_FAMILY_SEEDS, FACTORY_TREATMENTS,
  type FactoryFamilySeed, type FactoryTreatmentRecipe } from './b8-authoring-catalog'
import { validateTemplateDesign, validateTemplateFamily,
  type TemplateFamilyV1 } from './sequence-contract'
import type { VideoTemplateRelease } from './gallery'

type Direction = readonly [
  recipeId:string, headline:string, closing:string, description:string,
  transition:FactoryTreatmentRecipe['transition'], motionScale:number, motionShift:number, headlineSize:number
]
const DIRECTIONS: Readonly<Record<string,Direction>> = {
  f01:['magazine','WAIT FOR IT','THE REVEAL','Editorial cold-open reveal with a fast hook and clean final landing.','whip_pan',108,5,76],
  f02:['minimal','BEFORE','AFTER','Transformation-first comparison with restrained typography and a bright reveal beat.','dip_white',103,1,68],
  f03:['tech','NEW DROP','DETAILS THAT HIT','Product-launch rhythm with crisp tech type and punchy zoom accents.','zoom_blur',110,4,64],
  f04:['warm','A SMALL MOMENT','WORTH REMEMBERING','Personal mini-story with warmer typography and softer pacing.','crossfade',104,2,58],
  f05:['cinema','ADD DEPTH','LAYER THE STORY','Cinematic depth stack with deliberate parallax and dimensional pushes.','push_left',112,6,68],
  f06:['scrapbook','WEEKEND','ON REPEAT','Energetic lifestyle recap with scrapbook character and rhythmic wipes.','wipe_left',106,3,62],
  f07:['party',"YOU'RE INVITED",'SAVE THE DATE','Celebratory invitation with a bright entrance and calmer information landing.','push_up',106,3,70],
  f08:['luxury',"TONIGHT'S TABLE",'STAY FOR DESSERT','Premium food atmosphere edit with elegant type and restrained dissolves.','crossfade',105,2,62],
  f09:['sport','DAY ONE','NOW','Athletic progress edit with hard hierarchy and whip-pan momentum.','whip_pan',109,4,72],
  f10:['tutorial','STEP BY STEP','TRY THIS NEXT','Creator tutorial with legible instructional type and steady directional continuity.','push_left',103,2,62],
}
function directionFor(seed:FactoryFamilySeed): {direction:Direction;recipe:FactoryTreatmentRecipe} {
  const direction=DIRECTIONS[seed.id]
  if(!direction) throw new Error('Missing Batch 9A art direction: '+seed.id)
  const recipe=FACTORY_TREATMENTS.find(item=>item.id===direction[0])
  if(!recipe) throw new Error('Missing Batch 9A style recipe: '+direction[0])
  return {direction,recipe}
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
  if (slots.some(slot => slot.startFrame % BATCH9A_DEFAULT_MUSIC.beatEveryFrames !== 0 ||
      slot.durationFrames % BATCH9A_DEFAULT_MUSIC.beatEveryFrames !== 0))
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
      defaultMusic:BATCH9A_DEFAULT_MUSIC,
      previewStyle:{
        foreground:bold.foreground,accent:bold.accent,headingFont:bold.headingFont,
        supportFont:bold.supportFont,graphic:bold.graphic,enter:bold.enter,
      },
    }
  })

if (BATCH9A_ANCHOR_RELEASES.length !== 10 ||
    BATCH9A_ANCHOR_RELEASES.some((release,index)=>release.id !== 'f'+String(index+1).padStart(2,'0')+'_bold'))
  throw new Error('Batch 9A anchor manifest must contain F01-F10 bold in order')
