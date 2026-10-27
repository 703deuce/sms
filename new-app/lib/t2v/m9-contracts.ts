/**
 * Shared M9 API contracts (Agent A web ↔ Agent B worker). Import from client + server.
 */
import type { T2vAspect, T2vSceneMedia } from '@/lib/t2v/types'

export type T2vExtractDeckJobPayload = {
  workspaceId: string
  uploadId: string
  draftId?: string
}

export type T2vExtractDeckSlide = {
  index: number
  title?: string
  narration: string
  speakerNotes?: string
  thumbKey?: string
}

export type T2vExtractDeckResult = {
  title?: string
  slides: T2vExtractDeckSlide[]
}

export type T2vVoiceCloneJobPayload = {
  workspaceId: string
  name: string
  sampleUploadId: string
  consentAt: string
  consentById: string
}

export type T2vVoiceCloneResult = {
  voiceId: string
  previewUrl?: string | null
}

export type T2vSceneAiImagePayload = {
  workspaceId: string
  draftId: string
  sceneId: string
  prompt: string
  aspect: T2vAspect
}

export type T2vSceneAiVideoPayload = T2vSceneAiImagePayload

export type T2vSceneAiJobResult = {
  media: T2vSceneMedia
  generationId?: string
}

export type T2vTemplateCategory =
  | 'explainer'
  | 'listicle'
  | 'promo'
  | 'news'
  | 'tutorial'
  | 'quote'
  | 'story'

export type T2vTemplateListItem = {
  id: string
  name: string
  category: T2vTemplateCategory
  aspect: T2vAspect
  thumbUrl: string | null
  previewUrl: string | null
  sampleScript?: string | null
  description?: string | null
}

/** Settings merged on apply — never replaces `scenes` or narration source. */
export type T2vTemplateStylePatch = {
  settings: Record<string, unknown>
  music?: { volume?: number; duck?: boolean; mood?: string }
  defaultTransitions?: { transition?: string; transitionMs?: number }
}

export type T2vStockMediaType = 'video' | 'photo'
