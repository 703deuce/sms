import Link from 'next/link'
import {LiveProjectEditorPage} from '@/components/motion-studio/live-project-editor-page'

export const metadata={title:'Transovo Live Video Editor'}
export default async function LiveVideoPage({params}:{
  params:Promise<{projectId:string}>
}){
  const {projectId}=await params
  return <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 p-4 md:p-6">
    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
      <Link href="/app/motion-studio" className="hover:underline">Back to projects</Link>
      <Link href={'/app/motion-studio/'+encodeURIComponent(projectId)+'?view=workspace'} className="hover:underline">
        Assistant and version history
      </Link>
    </div>
    <LiveProjectEditorPage projectId={projectId}/>
  </main>
}
