import { MotionStudioCreate } from '../../../../components/motion-studio/motion-studio-create'

export const metadata = { title: 'New documentary · Motion Studio' }

/** v1 entry: /app/motion-studio/new?type=documentary (documentaries only, ST-WF-005). */
export default function MotionStudioNewRoute() {
  console.info('[motion-studio:ui] load', { step: 'route', view: 'create' })
  return <MotionStudioCreate initialView="create" />
}
