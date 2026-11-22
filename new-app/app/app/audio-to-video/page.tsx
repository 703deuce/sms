import {notFound} from 'next/navigation'
import {isByoFeatureEnabled} from '@/lib/server/clips/feature-gates'
import {MotionStudioCreate} from '@/components/motion-studio/motion-studio-create'
export const metadata={title:'Audio to Video · Transovo'}
export default function AudioToVideoStart(){
  if(!isByoFeatureEnabled())notFound()
  return <MotionStudioCreate initialView="create" audioStart/>
}
