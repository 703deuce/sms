import Link from 'next/link'
import { Page, PageHeader } from '@/components/app/page-primitives'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { getPrisma } from '@/lib/server/db'

export const metadata = { title: 'AI Motion Graphics · Transovo' }
export const dynamic = 'force-dynamic'

/** Standalone entry into the existing editable AI Motion panel. */
export default async function MotionGraphicsPage() {
  console.info('[motion:launcher] load_begin')
  const workspaceId = await resolveWorkspaceId()
  console.info('[motion:launcher] clips_load_begin', { workspaceId })
  const clips = await getPrisma().clip.findMany({
    where: { workspaceId, deletedAt: null, project: { deletedAt: null } },
    orderBy: { createdAt: 'desc' },
    take: 60,
    select: {
      id: true,
      projectId: true,
      title: true,
      project: { select: { title: true } },
    },
  })
  console.info('[motion:launcher] load_complete', { clips: clips.length })
  return (
    <Page>
      <div className="mx-auto max-w-4xl space-y-6 p-4">
        <PageHeader
          title="AI Motion Graphics"
          description="Add motion graphics to an existing edit or upload a video without running the AI clipper again."
        />
        <section className="space-y-3 rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold">Upload a video for graphics</h2>
          <p className="text-sm text-muted-foreground">
            Open the full-video editor, then select Text → AI Motion. The original footage and timing remain yours to edit.
          </p>
          <Link href="/app/clips/new?intent=full" className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Upload a video
          </Link>
        </section>
        <section className="space-y-3 rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold">Use an existing clip</h2>
          <p className="text-sm text-muted-foreground">
            Select a clip to open its existing AI Motion panel. Review generated layers before saving or exporting.
          </p>
          {clips.length === 0 ? (
            <p className="text-sm">No existing clips yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {clips.map((clip) => (
                <li key={clip.id} className="py-3">
                  <Link className="text-sm font-medium underline underline-offset-4" href={`/app/clips/${clip.projectId}/edit/${clip.id}`}>
                    {clip.title}
                  </Link>
                  <span className="ml-3 text-xs text-muted-foreground">{clip.project.title}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Page>
  )
}
