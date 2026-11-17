/** Video categories guide the director; they are NOT scene templates. */
export const MS_VIDEO_TYPES = [
  { id: 'anything', label: 'Anything / Custom', group: 'General', guidance: 'Follow the requested creative direction without imposing a genre or scene template.' },
  { id: 'documentary', label: 'Documentary', group: 'Stories & Content', guidance: 'Research and verify factual claims; tell an original, coherent story with sourced visual evidence.' },
  { id: 'social_video', label: 'Social Media Video', group: 'Stories & Content', guidance: 'Start with a compelling hook, keep pacing intentional, and consider platform safe areas.' },
  { id: 'explainer', label: 'Explainer Video', group: 'Stories & Content', guidance: 'Make complex ideas understandable through clear and original visual storytelling.' },
  { id: 'educational', label: 'Educational Video', group: 'Stories & Content', guidance: 'Teach accurately, progressively, and clearly with examples and visual explanations.' },
  { id: 'faq', label: 'FAQ Video', group: 'Stories & Content', guidance: 'Answer the requested questions accurately and succinctly, with readable supporting visuals.' },
  { id: 'testimonial', label: 'Testimonial Video', group: 'Stories & Content', guidance: 'Represent real customer statements faithfully; never invent quotes or endorsements.' },
  { id: 'video_ad', label: 'Video Ad', group: 'Marketing', guidance: 'Develop an original advertising concept with a clear benefit, visual hook and call to action; do not invent product claims.' },
  { id: 'animated_ad', label: 'Animated Video Ad', group: 'Marketing', guidance: 'Use original animated storytelling to highlight benefits and finish with a clear call to action.' },
  { id: 'product_demo', label: 'Product Demo', group: 'Marketing', guidance: 'Demonstrate only verified product functionality and actual supplied interfaces or assets.' },
  { id: 'animated_typography', label: 'Animated Typography', group: 'Motion Design', guidance: 'Let custom kinetic typography carry the message; synchronize motion with narration or music.' },
  { id: 'animated_design', label: 'Animated Static Design', group: 'Motion Design', guidance: 'Transform supplied still designs into original, deliberate motion while honoring their content.' },
  { id: 'logo_animation', label: 'Logo Animation', group: 'Motion Design', guidance: 'Preserve the uploaded logo identity, develop an original reveal and avoid unintended distortion.' },
  { id: 'cinemagraph', label: 'Cinemagraph', group: 'Motion Design', guidance: 'Create a subtle, localized repeating motion while the rest of the picture remains still.' },
  { id: 'display_loop', label: 'Digital Display Loop', group: 'Motion Design', guidance: 'Design a visually clear, seamlessly looping display suitable for repeated playback.' },
  { id: 'ui_animation', label: 'UI/UX Animation', group: 'Motion Design', guidance: 'Respect supplied interface states and demonstrate accurate, meaningful interactions.' },
  { id: 'nft_design', label: 'NFT Design', group: 'Motion Design', guidance: 'Create original digital collectible designs and animations; never copy protected artwork.' },
  { id: 'gif', label: 'GIF / Short Loop', group: 'Motion Design', guidance: 'Create a short self-contained animation with a clear loop; output format depends on supported export options.' },
  { id: 'video_editing', label: 'Edit Existing Video', group: 'Editing & Repurposing', guidance: 'Preserve user footage and meaning while improving structure, pacing and presentation.' },
  { id: 'audiogram', label: 'Audiogram', group: 'Editing & Repurposing', guidance: 'Keep uploaded audio accurate and synchronize original visual elements to it.' },
  { id: 'text_overlay', label: 'Text Overlays', group: 'Editing & Repurposing', guidance: 'Add accurate and legible text to the supplied media without obscuring important visual content.' },
  { id: 'template_customization', label: 'Customize Supplied Design', group: 'Editing & Repurposing', guidance: 'Respect the customer-provided design assets and instructions; do not impose built-in scene templates.' },
] as const
export type MsVideoType = (typeof MS_VIDEO_TYPES)[number]['id']
export const MS_CREATIVE_STYLES = ['automatic', 'minimalist', 'modern', 'cinematic', 'bold', 'luxury', 'playful', 'editorial', 'retro', 'futuristic', 'custom'] as const
export type MsCreativeStyle = (typeof MS_CREATIVE_STYLES)[number]
export type MsBrandMode = 'none' | 'project' | 'saved'
export type MsBrandConsistency = 'guided' | 'strict' | 'creative'
export type MsLogoPlacement = 'ai_decides' | 'intro' | 'outro' | 'watermark' | 'none'
export type MsBrandProfile = {
  name?: string
  primaryColor?: string
  secondaryColor?: string
  accentColor?: string
  fontPreference?: string
  tone?: string
  guidelines?: string
  logoUploadId?: string
  logoPlacement?: MsLogoPlacement
  consistency?: MsBrandConsistency
}
export type MsCreativeBrief = {
  videoType: MsVideoType
  style: MsCreativeStyle
  customStyle?: string
  instructions?: string
  brandMode: MsBrandMode
  brandKitId?: string
  brand?: MsBrandProfile
  referenceUploadIds?: string[]
}
export type MsSavedBrandKit = { id: string; name: string; profile: MsBrandProfile; createdAt: string; updatedAt: string }
const s = (value: unknown, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : ''
const hex = (value: unknown) => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.trim()) ? value.trim().toUpperCase() : undefined
export function sanitizeBrandProfile(value: unknown): MsBrandProfile {
  const o = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  return {
    name: s(o.name, 120) || undefined,
    primaryColor: hex(o.primaryColor), secondaryColor: hex(o.secondaryColor), accentColor: hex(o.accentColor),
    fontPreference: s(o.fontPreference, 120) || undefined, tone: s(o.tone, 240) || undefined,
    guidelines: s(o.guidelines, 3000) || undefined,
    logoUploadId: s(o.logoUploadId, 100) || undefined,
    logoPlacement: (['ai_decides','intro','outro','watermark','none'] as unknown[]).includes(o.logoPlacement) ? o.logoPlacement as MsLogoPlacement : 'ai_decides',
    consistency: (['guided','strict','creative'] as unknown[]).includes(o.consistency) ? o.consistency as MsBrandConsistency : 'guided',
  }
}
export function sanitizeCreativeBrief(value: unknown): MsCreativeBrief {
  const o = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  return {
    videoType: MS_VIDEO_TYPES.some(t => t.id === o.videoType) ? o.videoType as MsVideoType : 'anything',
    style: (MS_CREATIVE_STYLES as readonly string[]).includes(String(o.style)) ? o.style as MsCreativeStyle : 'automatic',
    customStyle: s(o.customStyle, 500) || undefined,
    instructions: s(o.instructions, 4000) || undefined,
    brandMode: ['none','project','saved'].includes(String(o.brandMode)) ? o.brandMode as MsBrandMode : 'none',
    brandKitId: s(o.brandKitId, 100) || undefined,
    brand: o.brand ? sanitizeBrandProfile(o.brand) : undefined,
    referenceUploadIds: Array.isArray(o.referenceUploadIds) ? [...new Set(o.referenceUploadIds.map(x => s(x, 100)).filter(Boolean))].slice(0, 12) : [],
  }
}
export function directorCategoryGuidance(type: MsVideoType): string {
  return MS_VIDEO_TYPES.find(t => t.id === type)?.guidance ?? 'Follow the requested direction without imposing a fixed scene design.'
}
