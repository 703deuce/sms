/**
 * Batch 8 canonical first-party authoring source. Explicit family timing/role
 * schedules and curated visible treatments. These are CANDIDATES, not released
 * templates. The checked-in F01-F50 table is the source-controlled schedule
 * authority for Batch 8 v1; F01-F10 are independently cross-checked against the
 * Batch 9A worker contract. Never count these rows as released without render QA.
 */
import type { TemplateGraphic, TemplateSlot } from './sequence-contract'
import type { TextAnimType } from '@/lib/clips/render-plan/text-anim'

export type FactoryFamilySeed = {
  id: string
  title: string
  category: string
  roles: readonly TemplateSlot['role'][]
  frames: readonly number[]
  status: 'canonical'
  scheduleRevision: 'batch8-canonical-v1'
}
type RoleChar = 'H' | 'S' | 'D' | 'C'
const roleMap: Record<RoleChar, TemplateSlot['role']> = {
  H: 'hero', S: 'support', D: 'detail', C: 'closing',
}
const authoredFamilyData: readonly [string, string, string, string, readonly number[]][] = [
  ['F01','Hook Reveal','story','HSDC',[45,45,60,60]],
  ['F02','Before After','transform','HDSC',[60,60,45,75]],
  ['F03','Fast Product Reveal','product','HSDDC',[36,45,45,54,60]],
  ['F04','Personal Mini Story','story','HSSDC',[60,60,48,48,84]],
  ['F05','Layered Depth','depth','HSDDC',[60,45,45,60,90]],
  ['F06','Weekend Recap','lifestyle','HSSSDC',[30,36,42,48,54,60]],
  ['F07','Event Invitation','event','HDSC',[75,60,45,60]],
  ['F08','Restaurant Atmosphere','food','HSSDC',[48,48,60,60,84]],
  ['F09','Fitness Progress','fitness','HSDDC',[48,48,48,60,96]],
  ['F10','Creator Tutorial','tutorial','HSDDSC',[60,75,75,75,60,75]],
  ['F11','Wedding Vows','wedding','HSSDDC',[90,90,60,60,60,120]],
  ['F12','Travel Postcards','travel','HSSSDC',[45,45,45,45,60,60]],
  ['F13','Real Estate Tour','realestate','HSDDDC',[60,75,75,75,75,90]],
  ['F14','Podcast Quote','podcast','HDSC',[75,90,60,75]],
  ['F15','Music Visualizer','music','HSSDC',[48,48,48,48,48]],
  ['F16','Gaming Highlight','gaming','HSSDDSC',[36,42,48,54,42,48,60]],
  ['F17','Birthday Tribute','celebration','HSSSDC',[60,60,60,60,60,90]],
  ['F18','Product Unboxing','product','HDSDDC',[45,60,60,60,60,75]],
  ['F19','School Memories','memories','HSSSDDC',[48,48,48,48,48,48,72]],
  ['F20','Chef Recipe Steps','food','HDDDSC',[60,75,75,75,60,75]],
  ['F21','Fashion Editorial','fashion','HSDDC',[75,45,60,75,105]],
  ['F22','Car Walkaround','automotive','HSDDDC',[45,60,60,60,60,75]],
  ['F23','Graduation Story','memories','HSSDC',[75,75,75,75,120]],
  ['F24','Pet Moments','lifestyle','HSSSDC',[42,42,42,42,54,78]],
  ['F25','Meet the Team','business','HSDDSC',[60,90,90,60,60,90]],
  ['F26','Local Business Promo','business','HSDDC',[45,75,75,75,90]],
  ['F27','App Feature Tour','technology','HDDDSC',[60,60,75,75,60,90]],
  ['F28','Holiday Greeting','holiday','HSSDC',[75,75,60,60,90]],
  ['F29','Photo Timeline','memories','HSSSSDC',[60,60,60,60,60,60,90]],
  ['F30','Art Portfolio','art','HSSDDC',[75,75,75,75,75,90]],
  ['F31','News Explainer','news','HDDDSC',[45,60,75,75,60,75]],
  ['F32','How It Works','tutorial','HDDDDC',[60,60,60,60,60,90]],
  ['F33','Home Renovation','transform','HSSDDC',[75,60,60,75,75,105]],
  ['F34','Makeup Lookbook','beauty','HSDDC',[60,60,60,60,90]],
  ['F35','Sports Scoreboard','sport','HSSDDSC',[36,42,42,42,42,42,54]],
  ['F36','Festival Recap','event','HSSSSDC',[30,36,42,48,48,54,72]],
  ['F37','Interview Answer','podcast','HDSC',[90,105,105,120]],
  ['F38','Sneaker Showcase','fashion','HSSDC',[45,45,60,60,90]],
  ['F39','Coffee Shop Loop','food','HSDC',[75,75,75,75]],
  ['F40','Book Review','education','HDSDC',[60,75,75,75,105]],
  ['F41','Nonprofit Mission','story','HSSDDC',[90,90,90,90,90,120]],
  ['F42','Road Trip Map','travel','HSSSDC',[60,60,60,60,60,90]],
  ['F43','Conference Highlights','business','HSSDDSC',[45,45,45,45,60,60,90]],
  ['F44','Community Spotlight','story','HSSSDC',[90,75,75,75,105,120]],
  ['F45','Baby Milestones','memories','HSSSSDC',[60,60,60,60,60,60,90]],
  ['F46','House Listing','realestate','HSDDDC',[60,75,75,75,75,120]],
  ['F47','Tech Product Specs','technology','HDDDSC',[60,75,75,75,60,105]],
  ['F48','Adventure Montage','travel','HSSSSDC',[36,42,48,48,54,60,72]],
  ['F49','Small Business Story','business','HSSDDC',[75,75,75,75,75,105]],
  ['F50','Thirty-Shot Rhythm','montage','HSSSSSSSSSSSSSSSSSSSSSSSSSSSSC',
    [18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18]],
]
export const FACTORY_FAMILY_SEEDS: readonly FactoryFamilySeed[] = authoredFamilyData.map(([id,title,category,roles,frames]) => {
  if (roles.length !== frames.length || !roles.startsWith('H') || !roles.endsWith('C') ||
      frames.some(n => !Number.isSafeInteger(n) || n < 9))
    throw new Error('Invalid canonical family sequence: ' + id)
  return { id: id.toLowerCase(), title, category,
    roles: [...roles].map(c => roleMap[c as RoleChar]), frames, status: 'canonical',
    scheduleRevision: 'batch8-canonical-v1' as const }
})
export const B8_CANONICAL_SCHEDULE_REVISION = 'batch8-canonical-v1' as const

export type FactoryTreatmentRecipe = {
  id: string
  kind: 'core' | 'alternate'
  parentId?: string
  headingFont: string
  supportFont: string
  x: number
  y: number
  enter: TextAnimType
  graphic: TemplateGraphic['type']
  gx: number
  gy: number
  transition: Exclude<TemplateSlot['transition'], 'cut'>['type']
  foreground: string
  accent: string
}
/** Manual, deliberately different pairings, hierarchy, placement and choreography. */
const core: readonly (readonly [string,string,string,number,number,TextAnimType,TemplateGraphic['type'],number,number,FactoryTreatmentRecipe['transition'],string,string])[] = [
  ['bold','Anton','Montserrat',50,22,'pop','rounded',17,78,'push_left','#FFFFFF','#FACC15'],
  ['editorial','Playfair Display','Inter',30,18,'fade','rect',78,78,'crossfade','#FFF7ED','#A3A3A3'],
  ['cinema','DM Serif Display','Lato',50,26,'slide_up','rounded',75,81,'dip_white','#FFFFFF','#C4A484'],
  ['scrapbook','Caveat','Poppins',26,28,'rotate_in','star',77,17,'wipe_left','#FFF1F2','#FDBA74'],
  ['pastel','Quicksand','Poppins',67,24,'slide_right','circle',20,74,'crossfade','#FFF7ED','#FDB4D2'],
  ['neon','Monoton','Space Mono',50,16,'zoom','triangle',80,74,'glitch','#67E8F9','#F0ABFC'],
  ['sport','Fira Sans Condensed','Rubik',42,19,'bounce_in','arrow',75,79,'whip_pan','#FFFFFF','#FDE047'],
  ['party','Bangers','Baloo 2',56,29,'pop','star',17,15,'wipe_right','#FEF08A','#FB7185'],
  ['mono','Roboto Mono','Inter',27,66,'fade','rect',83,21,'push_up','#F5F5F5','#737373'],
  ['warm','Lora','Caveat',36,72,'slide_up','heart',74,17,'crossfade','#FFEDD5','#FDBA74'],
  ['luxury','Bodoni Moda','Montserrat',50,22,'zoom','rounded',82,70,'dip_white','#FEF3C7','#D6B573'],
  ['noir','Special Elite','Roboto Mono',25,74,'fade','rect',82,18,'wipe_down','#FAFAFA','#78716C'],
  ['retro_arcade','Press Start 2P','Space Mono',50,20,'pop','star',80,72,'glitch','#BEF264','#F472B6'],
  ['retro_print','Abril Fatface','Lato',35,27,'slide_left','rect',73,76,'wipe_left','#FDE68A','#D97706'],
  ['graffiti','Permanent Marker','Bangers',54,69,'rotate_in','arrow',20,17,'whip_pan','#FDE047','#F43F5E'],
  ['brush','Pacifico','Quicksand',61,32,'slide_right','heart',19,76,'crossfade','#FFF7ED','#FDBA74'],
  ['journal','Kalam','Montserrat',30,72,'fade','rounded',78,18,'wipe_up','#F1F5F9','#A7F3D0'],
  ['magazine','Bodoni Moda','Inter',43,18,'slide_up','rect',15,81,'push_right','#FFFFFF','#FB7185'],
  ['rounded','Baloo 2','Nunito Sans',56,28,'pop','circle',78,80,'crossfade','#FFFFFF','#86EFAC'],
  ['kids','Fredoka','Quicksand',47,23,'bounce_in','star',18,81,'wipe_right','#FFFFFF','#FDE047'],
  ['tech','Rajdhani','Space Mono',50,70,'slide_left','triangle',82,20,'zoom_blur','#BAE6FD','#38BDF8'],
  ['minimal','Inter','Lato',28,20,'fade','rect',77,84,'crossfade','#FFFFFF','#94A3B8'],
  ['wedding','Great Vibes','DM Serif Display',50,32,'slide_up','heart',18,76,'dip_white','#FFF7ED','#E9D5FF'],
  ['news','Archivo Black','Roboto Mono',34,69,'slide_right','rounded',80,18,'push_left','#FFFFFF','#F87171'],
  ['tutorial','Gabarito','Space Grotesk',60,24,'pop','arrow',17,77,'wipe_left','#FFFFFF','#34D399'],
]
const alternates: readonly (readonly [string,string,string,string,number,number,TextAnimType,TemplateGraphic['type'],number,number,FactoryTreatmentRecipe['transition'],string,string])[] = [
  ['bold_alt','bold','Bebas Neue','Inter',26,72,'slide_left','arrow',75,18,'wipe_up','#FFFFFF','#FB7185'],
  ['editorial_alt','editorial','Fraunces','Roboto',65,70,'zoom','circle',17,18,'push_right','#FFF7ED','#A7F3D0'],
  ['cinema_alt','cinema','Cinzel','Space Grotesk',25,70,'fade','star',18,23,'wipe_down','#FFFFFF','#E9D5FF'],
  ['scrapbook_alt','scrapbook','Indie Flower','Lato',67,16,'pop','rounded',19,81,'crossfade','#FFFFFF','#F9A8D4'],
  ['pastel_alt','pastel','Comfortaa','Caveat',30,74,'bounce_in','heart',79,18,'wipe_down','#FFF7ED','#F9A8D4'],
  ['neon_alt','neon','Rubik Glitch','Inter',32,74,'slide_up','arrow',20,16,'push_down','#67E8F9','#F472B6'],
  ['sport_alt','sport','Russo One','Space Mono',69,71,'pop','star',19,17,'wipe_left','#FFFFFF','#4ADE80'],
  ['party_alt','party','Lobster','Inter',24,16,'slide_right','heart',81,76,'push_up','#FFF7ED','#FDBA74'],
  ['mono_alt','mono','Space Mono','DM Serif Display',68,20,'slide_down','triangle',17,82,'crossfade','#F5F5F5','#A3A3A3'],
  ['warm_alt','warm','Merriweather','Roboto',64,21,'pop','rounded',18,79,'wipe_right','#FFF7ED','#FBBF24'],
  ['luxury_alt','luxury','Cinzel','Lora',31,73,'slide_left','circle',17,17,'push_up','#FEF3C7','#B45309'],
  ['noir_alt','noir','Bodoni Moda','Space Mono',69,25,'zoom','star',15,76,'crossfade','#FAFAFA','#A3A3A3'],
  ['retro_arcade_alt','retro_arcade','Bungee','Roboto Mono',25,72,'slide_up','arrow',75,18,'wipe_left','#FEF08A','#F9A8D4'],
  ['retro_print_alt','retro_print','Alfa Slab One','Poppins',63,70,'pop','circle',19,21,'push_down','#FDE68A','#EAB308'],
  ['graffiti_alt','graffiti','Rubik Dirt','Inter',28,24,'bounce_in','star',78,77,'wipe_right','#FFFFFF','#A3E635'],
]
export const FACTORY_TREATMENTS: readonly FactoryTreatmentRecipe[] = [
  ...core.map(([id,headingFont,supportFont,x,y,enter,graphic,gx,gy,transition,foreground,accent]) => ({
    id, kind: 'core' as const, headingFont,supportFont,x,y,enter,graphic,gx,gy,transition,foreground,accent,
  })),
  ...alternates.map(([id,parentId,headingFont,supportFont,x,y,enter,graphic,gx,gy,transition,foreground,accent]) => ({
    id,parentId,kind: 'alternate' as const,headingFont,supportFont,x,y,enter,graphic,gx,gy,transition,foreground,accent,
  })),
]
