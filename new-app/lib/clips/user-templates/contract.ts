import type { ClipEditsV2 } from '@/lib/clips/edits'

export type UserTemplateSlotTarget =
  | { kind: 'main' }
  | { kind: 'source'; sourceId: string }
  | { kind: 'broll'; itemId: string }

export type UserTemplateSlotV1 = {
  id: string
  ordinal: number
  label: string
  media: 'video' | 'image' | 'either'
  target: UserTemplateSlotTarget
  minDurationMs: number
}

export type UserTemplateTextFieldV1 = {
  id: string
  itemId: string
  label: string
  exampleText: string
  maxChars: number
}

export type UserTemplateDecorativeAssetV1 = {
  key: string
  kind: 'upload' | 'stock' | 'generation' | 'font'
  assetId: string
  media?: 'video' | 'image' | 'audio'
  redistributionCleared: boolean
}

export type UserTemplateAssetManifestV1 = {
  v: 1
  slots: UserTemplateSlotV1[]
  decorative: UserTemplateDecorativeAssetV1[]
  musicPolicy: 'keep' | 'replace' | 'mute'
}

export type UserTemplateDefinitionV1 = {
  v: 1
  snapshot: {
    edits: ClipEditsV2
    editsSaveVersion: number
    clipStartMs: number
    clipEndMs: number
    aspect: string
  }
  slots: UserTemplateSlotV1[]
  textFields: UserTemplateTextFieldV1[]
  previewRange: { startMs: number; endMs: number }
  capabilities: {
    transitions: boolean
    keyframes: boolean
    sourcePlayback: boolean
    textLayers: boolean
    graphics: boolean
    music: boolean
  }
}

export type UserTemplateInspectionV1 = {
  clipId: string
  editsSaveVersion: number
  durationMs: number
  aspect: string
  replaceable: Array<{
    key: string
    label: string
    media: 'video' | 'image' | 'either'
    minDurationMs: number
  }>
  textFields: Array<{ id: string; label: string; text: string; maxChars: number }>
  decorativeDependencies: Array<{ key: string; label: string; kind: string }>
  musicPresent: boolean
  warnings: string[]
}
