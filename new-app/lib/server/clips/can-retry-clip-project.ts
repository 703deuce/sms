import type { ClipProjectStatus } from '@prisma/client'

/** User may re-queue processing after a hard failure or a soft-empty READY outcome. */
export function canRetryClipProject(project: {
  status: ClipProjectStatus
  error?: string | null
  clipCount?: number
}): boolean {
  if (project.status === 'FAILED' || project.status === 'CANCELED') {
    return true
  }
  if (project.status !== 'READY') {
    return false
  }
  const clips = project.clipCount ?? 0
  if (clips > 0) {
    return false
  }
  const err = (project.error ?? '').toLowerCase()
  return (
    err.includes('no complete') ||
    err.includes('no moments') ||
    err.includes('no clips') ||
    err.includes('no transcript')
  )
}
