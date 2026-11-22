import {notFound} from 'next/navigation'
import {isByoFeatureEnabled} from '@/lib/server/clips/feature-gates'
import {ByoProject} from '@/components/motion-studio/byo-project'
export const metadata={title:'Your footage · Transovo'}
export default async function FootageProject({params}:{params:Promise<{projectId:string}>}){
  if(!isByoFeatureEnabled())notFound()
  const {projectId}=await params
  return <ByoProject projectId={projectId}/>
}
