/** Per-workspace / per-project compose spec v1 (T4.7). Test projects first — never ws_1 default. */
const ALL_OFF = process.env.COMPOSE_SPEC_ALL_OFF === '1'

function parseList(raw: string | undefined): Set<string> {
  if (!raw?.trim()) return new Set()
  return new Set(
    raw
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  )
}

const ON_WORKSPACES = parseList(process.env.COMPOSE_SPEC_ON_WORKSPACES)
const ON_PROJECTS = parseList(process.env.COMPOSE_SPEC_ON_PROJECTS)

export function composeSpecV1Enabled(workspaceId: string, projectId?: string | null): boolean {
  if (ALL_OFF) return false
  if (ON_WORKSPACES.has(workspaceId)) return true
  if (projectId && ON_PROJECTS.has(projectId)) return true
  return false
}

export function composeSpecPreviewEnabled(workspaceId: string, projectId?: string | null): boolean {
  return composeSpecV1Enabled(workspaceId, projectId)
}
