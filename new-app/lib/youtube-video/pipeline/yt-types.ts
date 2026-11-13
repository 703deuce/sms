import type { YoutubeVideoCut, YoutubeVideoOption } from '@/lib/youtube-video/types'

export type YtObservation = {
  startMs: number
  endMs: number
  description: string
  whyInteresting: string
  category: string
  score: number
  tier: 'coarse' | 'focused'
}

export type YtOutline = {
  title: string
  premise: string
  opening: string
  development: string
  ending: string
  exclusions: string[]
}

export type YtSelectedCut = YoutubeVideoCut & {
  beat: string
  kind: 'speech' | 'visual'
  reason: string
  /** Short source-grounded transcript or observed-video evidence used only for chapter naming. */
  groundedEvidence?: string
}

export type YtStep = {
  at: string
  stage: string
  event: string
  sourceIndex?: number
  windowIndex?: number
  windowCount?: number
  count?: number
  accepted?: number
  rejected?: number
  code?: string
  issues?: string[]
}

export type YtActiveWindow = {
  sourceIndex: number
  startMs: number
  endMs: number
  stage: 'coarse_queue' | 'coarse_wait' | 'focus_queue' | 'focus_wait' |
    'story' | 'footage' | 'dialogue' | 'finisher' | 'qa' | 'commit'
  coarseJobId?: string
  focusJobId?: string
  coarse?: YtObservation[]
  focused?: YtObservation[]
  outline?: YtOutline
  cuts?: YtSelectedCut[]
  rejected?: Array<{ startMs: number; endMs: number; code: string }>
  qaRevisionAttempted?: boolean
  qaRevisionCount?: number
  qaRounds?: Array<{round:number;issues:string[];resolution:string;beforeRanges?:number[][];revisionChanges?:string}>
  qaPassed?: boolean
  qaIssueHistory?: string[]
  qaIssues?: string[]
}

export type YtFinishedWindow = {
  sourceIndex: number
  startMs: number
  endMs: number
  outline: YtOutline
  cuts: YtSelectedCut[]
  rejected: Array<{ startMs: number; endMs: number; code: string }>
  coarseCount: number
  focusedCount: number
  qaIssues?: string[]
  qaPassed?: boolean
  qaRounds?: Array<{round:number;issues:string[];resolution:string;beforeRanges?:number[][];revisionChanges?:string}>
  qaIssueHistory?: string[]
  observedScenes?: YtObservation[]
}

export type YtCheckpoint = {
  version: 1
  sourcesKey: string
  active: YtActiveWindow | null
  /** Bounded parallel per-window checkpoints; active is retained for older runs. */
  activeWindows?: YtActiveWindow[]
  finished: YtFinishedWindow[]
  steps: YtStep[]
  final?: {
    title: string
    premise: string
    selectedIndices: number[]
    chapterTitles?: string[]
    qaPassed: boolean
    qaRevisionCount?: number
    qaRounds?: Array<{round:number;issues:string[];resolution:string;beforeRanges?:number[][];revisionChanges?:string}>
    qaIssues?: string[]
    qaIssueHistory?: string[]
    needsReview?: boolean
  }
}

export type YtProgress =
  | { done: false; checkpoint: YtCheckpoint }
  | { done: true; checkpoint: YtCheckpoint; options: YoutubeVideoOption[] }

export type YtPlanArgs = {
  runId: string
  workspaceId: string
  createdById: string | null
  instruction: string | null
  sources: import('@/lib/youtube-video/types').YoutubeVideoIngestedSource[]
  checkpoint: YtCheckpoint | null
  save: (checkpoint: YtCheckpoint) => Promise<void>
}

export type YtTranscriptWord = { w: string; s: number; e: number }

export type YtWindowContext = {
  windowIndex?: number
  windowCount?: number
  sourceId: string
  startMs: number
  endMs: number
  words: YtTranscriptWord[]
  observations: YtObservation[]
  instruction: string | null
  qaIssues?: string[]
}
