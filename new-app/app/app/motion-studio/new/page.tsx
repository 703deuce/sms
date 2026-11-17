import { MotionStudioCreate } from '../../../../components/motion-studio/motion-studio-create'

export const metadata = { title: 'Create a video · Motion Studio' }

/** v1 entry: /app/motion-studio/new?type=documentary (general creative categories (legacy documentary query still supported)). */
export default function MotionStudioNewRoute() {
  console.info('[motion-studio:ui] load', { step: 'route', view: 'create' })
  return <MotionStudioCreate initialView="create" />
}
