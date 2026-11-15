import type {
  MsActivityStepId,
  MsLengthMin,
  MsMediaPolicy,
  MsProductionMode,
  MsStageId,
  MsVisualDirection,
  MsVoiceover,
  MsWorkflow,
} from './types'

/** Product name (John, 15 Nov 2026): "It's not AI Studio, it's Motion Studio." */
export const MOTION_STUDIO_NAME = 'Motion Studio'
export const MOTION_STUDIO_ROUTE = '/app/motion-studio'
/** v1 entry (FE-12, #1242). */
export const MOTION_STUDIO_NEW_ROUTE = '/app/motion-studio/new?type=documentary'
/** API namespace (John 12:53 AM, supersedes D3: /api/motion-studio/*). */
export const MOTION_STUDIO_API_BASE = '/api/motion-studio'

/** Vision statement, verbatim (ST-VIS-001). */
export const MOTION_STUDIO_VISION =
  'Give Transovo an idea. It researches the subject, finds usable media, writes the story, designs professional motion graphics, assembles real footage, and produces an editable documentary.'

/** Exact UI labels from the binding concept (spec §2.1, "must appear verbatim"). */
export const MS_LABELS = {
  myProjects: 'My projects',
  headline: 'What are we creating today?',
  subhead: 'Turn an idea, script, or footage into a cinematic documentary.',
  promptPlaceholder: 'Describe the documentary you want to make. You can attach photos and clips.',
  attach: 'Add photos, footage, script or audio',
  start: 'Start',
  modeIdea: 'Start with idea',
  modeScript: 'Use a script',
  modeFootage: 'Edit my footage',
  exampleProject: 'Example project',
  length: 'Documentary length',
  visualDirection: 'Visual direction',
  voiceover: 'Voiceover',
  format: 'Format',
  media: 'Media',
  webResearch: 'Web research',
  formatValue: '16:9 · 480p',
  /** v1 read-only media row (ST-UX-028 / ST-UI-107). */
  mediaValueV1: 'Use only my uploaded media',
  nextPlan: 'Next: Create production plan',
  nextPlanHelper: 'Review the story, chapters, visuals and proposed motion graphics before full production.',
  project: 'PROJECT',
  aiDirector: 'AI Director',
  directorPlaceholder: 'Make the stock chart more dramatic.',
  currentScene: 'Current scene',
  visualTreatment: 'Visual treatment:',
  camera: 'Camera:',
  source: 'Source:',
  inspector: 'INSPECTOR',
  sceneGraphics: 'Scene graphics',
  timing: 'Timing',
  style: 'Style',
  cameraMovement: 'Camera movement',
  text: 'Text',
  regenerate: 'Regenerate graphic',
  editTimeline: 'Edit timeline',
  storyboard: 'Storyboard',
  timeline: 'Timeline',
  visualStoryboard: 'Visual Storyboard',
  selectHint: 'Select a scene to edit or regenerate.',
  proposedChanges: 'Proposed changes',
  productionActivity: 'Production Activity',
  mediaLibrary: 'Media Library',
  checkpoint: 'Checkpoint',
  fullyAutomatic: 'Fully automatic',
  exportMp4: 'Export MP4',
  openAdvanced: 'Open in advanced editor',
} as const

export const MS_PROJECT_SECTIONS = ['Story', 'Media', 'Scenes', 'Graphics', 'Audio'] as const
export type MsProjectSection = (typeof MS_PROJECT_SECTIONS)[number]

/** Timeline tracks (ST-UX-056) plus the Motion Studio scene and handoff lanes. */
export const MS_TRACK_LABELS = {
  scenes: 'SCENES',
  video: 'VIDEO',
  graphics: 'GRAPHICS',
  voice: 'VOICE',
  music: 'MUSIC',
} as const

export const MS_WORKFLOWS: { id: MsWorkflow; label: string; description: string }[] = [
  { id: 'idea', label: MS_LABELS.modeIdea, description: 'Research, script, narration and code-rendered graphics from a single prompt.' },
  { id: 'script', label: MS_LABELS.modeScript, description: 'Paste or upload your script or narration. Your words stay exactly as written.' },
  { id: 'footage', label: MS_LABELS.modeFootage, description: 'Upload interviews and clips. Graphics are added where they improve the story.' },
]

export const MS_LENGTHS: { value: MsLengthMin; label: string; beta: boolean }[] = [
  { value: 3, label: '3 min', beta: false },
  { value: 5, label: '5 min', beta: false },
  { value: 10, label: '10 min', beta: true },
  { value: 15, label: '15 min', beta: true },
]

export const MS_DIRECTIONS: { value: MsVisualDirection; label: string }[] = [
  { value: 'cinematic', label: 'Cinematic documentary' },
  { value: 'explainer', label: 'Modern explainer' },
  { value: 'investigative', label: 'Investigative' },
  { value: 'technical_3d', label: '3D technical' },
]

export const MS_VOICEOVER: { value: MsVoiceover; label: string }[] = [
  { value: 'ai', label: 'AI voice' },
  { value: 'upload', label: 'Upload own' },
]

export const MS_PRODUCTION_MODES: { value: MsProductionMode; label: string; description: string }[] = [
  { value: 'checkpoint', label: MS_LABELS.checkpoint, description: 'Pause after the story and visual plan so you can review the script.' },
  { value: 'auto', label: MS_LABELS.fullyAutomatic, description: 'Produce straight through to review. The script stays viewable in Story.' },
]

/** Six stages inside one project (ST-UX-060). */
export const MS_STAGES: { id: MsStageId; label: string }[] = [
  { id: 'story', label: 'Develop the story' },
  { id: 'assets', label: 'Prepare the footage and assets' },
  { id: 'direct', label: 'Direct the documentary' },
  { id: 'graphics', label: 'Generate motion graphics' },
  { id: 'assemble', label: 'Assemble and mix' },
  { id: 'review', label: 'Review and export' },
]

/** ST-UI-104 v1 steps (media candidates step hidden until the Media Researcher ships). */
export const MS_ACTIVITY_STEPS: { id: MsActivityStepId; label: string }[] = [
  { id: 'story_research', label: 'Story research' },
  { id: 'uploads_analyzed', label: 'Uploads analyzed' },
  { id: 'storyboard', label: 'Storyboard' },
  { id: 'motion_graphics', label: 'Motion graphics' },
  { id: 'assembly_review', label: 'Assembly and review' },
]

/** ST-UI-107: the media-source picker is hidden in v1; flipping this is the later config change. */
export const MS_MEDIA_PICKER_ENABLED = false
export const MS_V1_MEDIA_POLICY: MsMediaPolicy = 'uploads_only'
export const MS_MEDIA_POLICY_LABELS: Record<MsMediaPolicy, string> = {
  auto_plus_uploads: 'Find media automatically + use my uploads',
  auto_only: 'Find photos and videos automatically',
  uploads_only: 'Use only my uploaded media',
}

/** Credit placeholders until John sets the integers (D2). Never currency. */
export const MS_COSTS = {
  perFinishedMinute: null as number | null,
  sceneRegenerate: null as number | null,
  researchRun: null as number | null,
}

/** Selected workflow line (ST-UI-103), v1 = uploads_only for every mode. */
export function selectedWorkflowLine(workflow: MsWorkflow, opts: { lengthMin?: MsLengthMin; uploads?: number } = {}): string {
  const len = `${opts.lengthMin ?? 5}-minute documentary`
  const media = opts.uploads && opts.uploads > 0
    ? `use your ${opts.uploads} uploaded ${opts.uploads === 1 ? 'file' : 'files'}`
    : 'use the photos, images and clips you upload'
  switch (workflow) {
    case 'idea':
      return `Selected workflow: Transovo will research the topic, write the script, ${media}, and produce a ${len}.`
    case 'script':
      return `Selected workflow: Transovo will keep your script word for word, ${media}, design the motion graphics, and produce a ${len}.`
    case 'footage':
      return `Selected workflow: Transovo will analyze your footage, ${media}, add motion graphics where they help the story, and produce a ${len}.`
  }
}

/** Upload accept list: video, photos and music (plus scripts as text/doc). */
export const MS_UPLOAD_ACCEPT = 'video/*,image/*,audio/*,.txt,.md,.doc,.docx,.pdf'

/** Visible format label from the actual render size, not a hardcoded 1080p string. */
export function formatLabel(settings?: { format?: string; renderSize?: string } | null): string {
  const size = (settings?.renderSize || (settings?.format || '').split('_')[1] || '480p').toLowerCase()
  const aspect = (settings?.format || '16:9_480p').split('_')[0] || '16:9'
  return `${aspect} · ${size}`
}
