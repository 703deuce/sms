import Link from 'next/link'
import {LiveProjectEditorPage} from '@/components/motion-studio/live-project-editor-page'

export const metadata={title:'Transovo Live Video Editor'}
export default async function LiveVideoPage({params}:{
  params:Promise<{projectId:string}>
}){
  const {projectId}=await params
  return <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 p-4 md:p-6">
    <Link href="/app" className="text-sm text-muted-foreground hover:underline">
      Back to projects
    </Link>
    <LiveProjectEditorPage projectId={projectId}/>
  </main>
}
