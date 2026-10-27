import type { ClipProjectListItem } from '@/lib/clips/project-list-item'

export function t2vProjectHref(project: Pick<ClipProjectListItem, 'id' | 'sourceKind' | 'status' | 't2vDraftStatus'>): string {
  if (project.sourceKind !== 't2v') return `/app/clips/${project.id}`
  const ready =
    project.status === 'READY' ||
    project.t2vDraftStatus === 'READY' ||
    project.t2vDraftStatus === 'ASSEMBLED'
  return ready ? `/app/clips/${project.id}/script` : `/app/clips/${project.id}/video`
}

export function t2vStatusLabel(project: Pick<ClipProjectListItem, 'sourceKind' | 'status' | 't2vDraftStatus' | 't2vDraftProgress'>): string | null {
  if (project.sourceKind !== 't2v') return null
  if (project.t2vDraftStatus === 'ASSEMBLING') {
    const p = project.t2vDraftProgress ?? 0
    return p > 0 ? `Building ${p}%` : 'Building…'
  }
  if (project.t2vDraftStatus === 'READY' || project.status === 'READY') return 'Ready'
  if (project.t2vDraftStatus === 'FAILED') return 'Failed'
  return 'Draft'
}
