import 'server-only'
import { cache } from 'react'
import { listFolders } from '@/lib/server/clips/drive-projects'
import { listClipProjectsForPage } from '@/lib/server/clips/project-list'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export const getClipsWorkspaceId = cache(async () => resolveWorkspaceId())

export const getClipsDriveFolders = cache(async (workspaceId: string) => {
  const folders = await listFolders(workspaceId)
  return folders.map((f) => ({ id: f.id, name: f.name }))
})

export type DriveProjectListOpts = {
  q?: string
  status?: string
  limit?: number
  folderId?: string
}

export const getClipsDriveProjects = cache(async (workspaceId: string, opts: DriveProjectListOpts) => {
  return listClipProjectsForPage(workspaceId, opts)
})
