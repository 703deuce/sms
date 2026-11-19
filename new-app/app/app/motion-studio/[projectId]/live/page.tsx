import Link from 'next/link'
import {LiveProjectPreviewPage} from '@/components/motion-studio/live-project-preview-page'

export const metadata={title:'Transovo Video Preview'}

/** The live landing screen is for watching; Compact is the one editor. */
export default async function LiveVideoPage({params}:{
  params:Promise<{projectId:string}>
}){
  const {projectId}=await params
  return <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 p-4 md:p-6">
    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
      <Link href="/app/motion-studio" className="hover:underline">Back to projects</Link>
    </div>
    <LiveProjectPreviewPage projectId={projectId}/>
  </main>
}
