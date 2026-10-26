import { Clapperboard } from 'lucide-react'
import { Page, PageHeader } from '@/components/app/page-primitives'
import { Skeleton } from '@/components/ui/skeleton'

export default function ClipsProjectsLoading() {
  return (
    <Page>
      <PageHeader
        icon={Clapperboard}
        iconTone="brand"
        title="Projects"
        description="Your long videos and the clips we found in them."
      />
      <div className="flex flex-wrap gap-2 pb-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-48" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="project-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-xl border border-border p-4">
            <Skeleton className="size-10 rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </Page>
  )
}
