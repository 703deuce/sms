import { MotionStudioCreate } from '../../../components/motion-studio/motion-studio-create'

export const metadata = { title: 'Motion Studio' }

export default function MotionStudioRoute() {
  console.info('[motion-studio:ui] load', { step: 'route', view: 'projects' })
  return <MotionStudioCreate initialView="projects" />
}
