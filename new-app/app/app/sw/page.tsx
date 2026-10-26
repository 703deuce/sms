import Link from 'next/link'
import { Page, PageHeader, Panel } from '@/components/app/page-primitives'
import { Button } from '@/components/ui/button'
import { getActor } from '@/lib/screenwriting/server/actor'
import { listSwProjects } from '@/lib/screenwriting/server/projects'
import { SwProjectCreateButton } from '@/components/screenwriting/project-create-button'
import { FileText } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Screenwriting' }

export default async function ScreenwritingHomePage() {
  const actor = getActor()
  const projects = await listSwProjects(actor.id)

  return (
    <Page>
      <PageHeader
        icon={FileText}
        title="Screenwriting"
        description="Final Draft–style scripts. HTTP autosave always on; live Yjs collab when SW_COLLAB_WS_URL + services/collab are deployed (status shown in the editor)."
        meta={<SwProjectCreateButton />}
      />
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        {projects.length === 0 ? (
          <Panel className="p-6 text-sm text-muted-foreground">
            No projects yet. Create one to open the screenplay editor.
          </Panel>
        ) : (
          projects.map((p) => {
            const script = p.scripts[0]
            return (
              <Panel key={p.id} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <h2 className="font-semibold">{p.title}</h2>
                  <p className="text-xs text-muted-foreground">{p.kind}</p>
                </div>
                {script ? (
                  <Button size="sm" render={<Link href={`/app/sw/scripts/${script.id}`} />}>
                    Open script
                  </Button>
                ) : null}
              </Panel>
            )
          })
        )}
      </div>
    </Page>
  )
}
