import 'server-only'

export function t2vProjectPrefix(workspaceId: string, projectId: string): string {
  return `ws/${workspaceId}/projects/${projectId}/t2v/`
}

export function isT2vAssembledSourceKey(workspaceId: string, projectId: string, key: string): boolean {
  const prefix = t2vProjectPrefix(workspaceId, projectId)
  if (!key.startsWith(prefix)) return false
  const rest = key.slice(prefix.length)
  return /^source_r\d+_[^/]+\.mp4$/.test(rest)
}
