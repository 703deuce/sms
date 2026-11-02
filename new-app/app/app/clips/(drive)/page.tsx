import { DriveHome } from '@/components/drive/drive-home'
import { DriveProjectsSync } from '@/components/drive/drive-projects-sync'
import { ProjectsAutoRefresh } from '@/components/clips/projects-auto-refresh'
import { PageContainer } from '@/components/app/page-primitives'
import { getClipsDriveFolders, getClipsDriveProjects, getClipsWorkspaceId } from '@/lib/server/clips/drive-data'
import { isClipProjectProcessing } from '@/lib/clips/project-processing'
import { promiseWithTimeout } from '@/lib/server/promise-timeout'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Projects' }

const DRIVE_LOAD_TIMEOUT_MS = 30_000

export default async function ClipsProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; kind?: string; view?: string; folder?: string }>
}) {
  const { q, status, kind, folder, view } = await searchParams
  const workspaceId = await promiseWithTimeout(getClipsWorkspaceId(), DRIVE_LOAD_TIMEOUT_MS, 'clips_workspace')
  const [projects, folders] = await promiseWithTimeout(
    Promise.all([
      getClipsDriveProjects(workspaceId, {
        q,
        status,
        kind,
        limit: view === 'all' ? 200 : 50,
        folderId: folder ?? undefined,
      }),
      getClipsDriveFolders(workspaceId),
    ]),
    DRIVE_LOAD_TIMEOUT_MS,
    'clips_drive_projects',
  )
  const anyProcessing = projects.some((p) => isClipProjectProcessing(p.status))

  return (
    <PageContainer>
      <DriveProjectsSync projects={projects} />
      <ProjectsAutoRefresh enabled={anyProcessing} />
      <DriveHome initialProjects={projects} folders={folders} q={q} status={status} kind={kind} showAll={view === 'all'} />
    </PageContainer>
  )
}
