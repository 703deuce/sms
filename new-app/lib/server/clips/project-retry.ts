import type { ClipProjectStatus } from '@prisma/client'
import { isTranscriptReadyOrphan } from '@/lib/server/clips/recover-project'

export function transcriptWordCount(transcriptWords: unknown): number {
  if (!transcriptWords) return 0
  if (Array.isArray(transcriptWords)) return transcriptWords.length
  return 0
}

/** Safe to skip transcribe and re-run picker/reframe (B2 source cache still applies on download). */
export function shouldResumeClipperFromTranscript(project: {
  transcriptWords: unknown
  stage?: string | null
  status: ClipProjectStatus
}): boolean {
  if (isTranscriptReadyOrphan(project.stage, project.status)) return true
  return transcriptWordCount(project.transcriptWords) > 0
}

export function clipperRetryProjectPatch(project: {
  progress: number
  transcriptWords: unknown
  stage?: string | null
  status: ClipProjectStatus
}): { resume: boolean; progress: number; stage: string } {
  const resume = shouldResumeClipperFromTranscript(project)
  if (!resume) {
    return { resume: false, progress: 0, stage: 'queued' }
  }
  return {
    resume: true,
    progress: Math.max(project.progress, 45),
    stage: 'queued',
  }
}

export function clipperRetryJobPayload(resume: boolean): Record<string, unknown> {
  return resume ? { resume: true, retry: true } : { retry: true }
}
