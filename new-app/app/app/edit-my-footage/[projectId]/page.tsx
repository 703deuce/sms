import {ByoProject} from '@/components/motion-studio/byo-project'
export const metadata={title:'Your footage · Transovo'}
export default async function FootageProject({params}:{params:Promise<{projectId:string}>}){
  const {projectId}=await params
  return <ByoProject projectId={projectId}/>
}
