import { Suspense } from 'react'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { EditorPageSkeleton } from '@/components/clips/editor/editor-page-skeleton'
import { EditorPayloadSection } from './editor-payload-section'

export const metadata = { title: 'Text editor' }

async function withLoadTimeout<T>(promise: Promise<T>, ms: number, step: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Text editor load timed out at ' + step)), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export default async function TextEditorPage({ params, searchParams }: { params: Promise<{ projectId: string; clipId: string }>; searchParams: Promise<{ from?: string }> }) {
  const { projectId, clipId } = await params
  console.info('[editor:text-gaps] load-step', { projectId, clipId, step: 'route-params' })
  const { from } = await searchParams
  console.info('[editor:text-gaps] load-step', { projectId, clipId, step: 'search-params' })
  console.info('[editor:text-gaps] load-step', { projectId, clipId, step: 'workspace-start' })
  const workspaceId = await withLoadTimeout(resolveWorkspaceId(), 15_000, 'workspace')
  console.info('[editor:text-gaps] load-step', { projectId, clipId, step: 'workspace-ready' })
  return <Suspense fallback={<EditorPageSkeleton />}><EditorPayloadSection workspaceId={workspaceId} projectId={projectId} clipId={clipId} clipperStudio={from === 'studio'} /></Suspense>
}
