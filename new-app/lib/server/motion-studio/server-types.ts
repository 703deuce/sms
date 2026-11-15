/** Motion Studio (documentaries) API types — contract docs/contracts/motion-studio-v1.md. No `$` anywhere. */
export const MS_WORKFLOWS = ['idea', 'script', 'footage'] as const
export type MsWorkflow = (typeof MS_WORKFLOWS)[number]
export const MS_LENGTHS = [3, 5, 10, 15] as const
export const MS_BETA_LENGTHS = [10, 15] as const
export const MS_VISUAL_DIRECTIONS = [
  { id: 'auto', label: 'Let the Director choose' },
  { id: 'cinematic_documentary', label: 'Cinematic documentary' },
  { id: 'netflix_financial', label: 'Financial thriller' },
  { id: 'archival_history', label: 'Archival history' },
  { id: 'modern_explainer', label: 'Modern explainer' },
  { id: '3d_technical', label: 'Technical' },
  { id: 'minimal_editorial', label: 'Minimal editorial' },
] as const
export const MS_VOICEOVERS = [
  { id: 'ai_brian', label: 'AI narrator (Brian)' },
  { id: 'upload', label: 'Upload my narration' },
  { id: 'none', label: 'No narration' },
] as const
export const MS_ASPECTS = ['16:9', '9:16', '1:1'] as const
export const MS_AUTOMATION = ['checkpoint', 'auto'] as const
/** music: generated (default, code-generated beat-keyed score) | upload | elevenlabs (optional tier, #1230) | none */
export const MS_MUSIC = ['generated', 'upload', 'elevenlabs', 'none'] as const
export const MS_STAGES = [
  { id: 'story', label: 'Develop the story' },
  { id: 'assets', label: 'Prepare the footage and assets' },
  { id: 'direct', label: 'Direct the documentary' },
  { id: 'graphics', label: 'Generate motion graphics' },
  { id: 'assemble', label: 'Assemble and mix' },
  { id: 'review', label: 'Review and export' },
] as const
export type MsStage = (typeof MS_STAGES)[number]['id']
export type MsStatus = 'queued' | 'running' | 'awaiting_approval' | 'review' | 'failed' | 'cancelled'

export type MsSettings = {
  lengthMin: 3 | 5 | 10 | 15
  visualDirection: string
  visualNotes: string
  voiceover: 'ai_brian' | 'upload' | 'none'
  narrationUploadId: string | null
  aspect: '16:9' | '9:16' | '1:1'
  automation: 'checkpoint' | 'auto'
  music: (typeof MS_MUSIC)[number]
  musicUploadId: string | null
  mediaPolicy: 'uploads_only'
  tone?: string
}

export type MsTrack = { id: string; kind: string; label: string; items: Record<string, unknown>[] }
export type MsEditorExtension = {
  v: 1
  projectId: string
  timelineVersion: number
  durationMs: number
  fps: number
  tracks: MsTrack[]
  segments: Record<string, unknown>[]
}

export type MsProjectSummary = {
  id: string; title: string; status: MsStatus; stage: MsStage; workflow: MsWorkflow
  createdAt: string; updatedAt: string; thumbnailUrl: string | null; durationMs: number | null
}
