/**
 * T2V draft document (authoring truth for the storyboard editor). Stored in T2vDraft.document.
 */
export type T2vAspect = '16:9' | '9:16' | '1:1' | '4:5'
export type T2vSourceKind = 'prompt' | 'script' | 'url' | 'blog' | 'ppt' | 'audio'
export type T2vMediaProvider = 'pexels' | 'pixabay' | 'upload' | 'ai_image' | 'ai_video' | 'color'
export type T2vTransition =
  | 'cut'
  | 'fade'
  | 'dissolve'
  | 'fade_black'
  | 'fade_white'
  | 'slide_left'
  | 'slide_right'
  | 'slide_up'
  | 'wipe_left'
  | 'circle_open'
  | 'zoom_in'
  | 'smooth_left'
export type T2vKenBurns = 'zoom_in' | 'zoom_out' | 'pan_left' | 'pan_right' | 'none'

export type T2vSceneMedia = {
  provider: T2vMediaProvider
  kind: 'video' | 'image' | 'color'
  assetId?: string
  providerId?: string
  thumbUrl?: string
  previewUrl?: string
  width?: number
  height?: number
  durationMs?: number
  srcInMs?: number
  focalX?: number
  focalY?: number
  kenBurns?: T2vKenBurns
  color?: string
  locked?: boolean
  storageKey?: string
  attribution?: { author: string; pageUrl: string; provider: 'pexels' | 'pixabay' }
  query?: string
}

export type T2vTextItem = {
  id: string
  kind: 'title' | 'lower_third'
  text: string
  subtitle?: string
  startMs: number
  endMs: number
  animation: 'fade' | 'slide_up' | 'none'
}

export type T2vScene = {
  id: string
  slot: number
  narration: string
  onScreenText?: string
  keywords: string[]
  visualQuery: string
  media: T2vSceneMedia
  minDurMs?: number
  padMs: number
  transition: T2vTransition
  transitionMs: number
  texts: T2vTextItem[]
  voice?: { clipId?: string; hash: string; durationMs?: number; status: 'ready' | 'pending' | 'failed' | 'stale' }
  muted?: boolean
  fineEditedAt?: string
}

export type T2vVoiceSettings = {
  provider: 'elevenlabs'
  voiceId: string
  voiceName: string
  modelId: 'eleven_v4' | 'eleven_v4_turbo' | 'eleven_multilingual_v2' | 'eleven_flash_v2_5'
  stability: number
  similarityBoost: number
  style: number
  speed: number
  languageCode?: string
}

export type T2vDraftV1 = {
  v: 1
  title: string
  source: { kind: T2vSourceKind; prompt?: string; script?: string; url?: string; uploadId?: string }
  settings: {
    aspect: T2vAspect
    targetDurationS: 30 | 60 | 90 | 120 | 180 | null
    language: string
    tone: 'friendly' | 'professional' | 'energetic' | 'calm' | 'inspirational' | 'humorous'
    audience?: string
    platform?: 'youtube' | 'youtube_shorts' | 'tiktok' | 'reels' | 'linkedin' | 'generic'
    sceneSplit: 'sentence' | 'line_break' | 'ai'
    mediaSources: Array<'pexels' | 'pixabay' | 'ai_image'>
    mediaMix: 'video_first' | 'images_ok'
    templateId?: string
    brandTemplateId?: string
    captionPresetId?: string
    captionsEnabled: boolean
  }
  voice: T2vVoiceSettings | null
  music: { assetId?: string; generationId?: string; volume: number; duck: boolean; label?: string } | null
  scenes: T2vScene[]
  nextSlot: number
}

export const T2V_WORD_BLOCK = 10_000
