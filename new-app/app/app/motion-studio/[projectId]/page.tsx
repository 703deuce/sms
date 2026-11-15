import { MotionStudioWorkspace } from '../../../../components/motion-studio/motion-studio-workspace'

export const metadata = { title: 'Motion Studio' }

export default async function MotionStudioProjectRoute({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  console.info('[motion-studio:ui] load', { step: 'route', view: 'workspace' })
  return <MotionStudioWorkspace projectId={projectId} />
}
