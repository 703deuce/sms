/**
 * T2V draft document (authoring truth for the storyboard editor). Stored in T2vDraft.document.
 * Versioned like ScriptDocumentV1. All times in ms. Scene `slot` is a stable integer assigned at
 * creation and never reused; it seeds transcript word ids (i = slot * 10_000 + k).
 */
export type T2vAspect = '16:9' | '9:16' | '1:1' | '4:5'
export type T2vSourceKind = 'prompt' | 'script' | 'url' | 'blog' | 'ppt' | 'audio'
export type T2vMediaProvider = 'pexels' | 'pixabay' | 'upload' | 'ai_image' | 'ai_video' | 'color'
export type T2vTransition =
  | 'cut' | 'fade' | 'dissolve' | 'fade_black' | 'fade_white' | 'slide_left' | 'slide_right'
  | 'slide_up' | 'wipe_left' | 'circle_open' | 'zoom_in' | 'smooth_left'
export type T2vKenBurns = 'zoom_in' | 'zoom_out' | 'pan_left' | 'pan_right' | 'none'

export type T2vSceneMedia = {
  provider: T2vMediaProvider
  kind: 'video' | 'image' | 'color'
  /** StockAsset.id for pexels/pixabay, ClipUpload.id for upload, AiGeneration.id for ai_* */
  assetId?: string
  providerId?: string
  thumbUrl?: string
  previewUrl?: string
  width?: number
  height?: number
  durationMs?: number
  srcInMs?: number
  focalX?: number // 0..1 (InVideo "center point")
  focalY?: number
  kenBurns?: T2vKenBurns
  color?: string
  /** User picked this media by hand: storyboard re-match must not replace it. */
  locked?: boolean
  /** Our storage copy (StockAsset/ClipUpload/AiGeneration). Worker downloads this; never hotlink Pixabay. */
  storageKey?: string
  attribution?: { author: string; pageUrl: string; provider: 'pexels' | 'pixabay' }
  /** Search query that produced this pick; kept so "Shuffle" can page the same query. */
  query?: string
}

export type T2vTextItem = {
  id: string
  kind: 'title' | 'lower_third'
  text: string
  subtitle?: string
  startMs: number // relative to scene start
  endMs: number
  animation: 'fade' | 'slide_up' | 'none'
}

export type T2vScene = {
  id: string
  slot: number
  /** Narration for this scene (what TTS speaks + captions show). */
  narration: string
  /** Optional on-screen headline (Pictory "highlight keywords"/text layer). */
  onScreenText?: string
  keywords: string[]
  visualQuery: string
  media: T2vSceneMedia
  /** Min scene length when narration is empty (title cards); otherwise VO length + padMs. */
  minDurMs?: number
  padMs: number
  transition: T2vTransition
  transitionMs: number
  texts: T2vTextItem[]
  /** Filled by T2V_TTS. hash = sha256(text|voiceId|modelId|settings). */
  voice?: { clipId?: string; hash: string; durationMs?: number; status: 'ready' | 'pending' | 'failed' | 'stale' }
  muted?: boolean
  /** Set when the user edited this scene in the Descript editor (warn before re-voice). */
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
  speed: number // 0.7..1.2 (ElevenLabs voice_settings.speed)
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
    brandTemplateId?: string // ClipBrandTemplate.id (REUSE)
    captionPresetId?: string // CaptionPreset.id (REUSE)
    captionsEnabled: boolean
  }
  voice: T2vVoiceSettings | null
  music: { assetId?: string; generationId?: string; volume: number; duck: boolean; label?: string } | null
  scenes: T2vScene[]
  nextSlot: number
}

export const T2V_WORD_BLOCK = 10_000
