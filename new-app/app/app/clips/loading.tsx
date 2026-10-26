import { Page, PageHeader } from '@/components/app/page-primitives'

export default function ClipsProjectsLoading() {
  return (
    <Page>
      <PageHeader title="Projects" description="Your long videos and the clips we found in them." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-xl border border-border p-4">
            <div className="mb-3 size-10 rounded-lg bg-muted" />
            <div className="mb-2 h-4 w-3/4 rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted" />
          </div>
        ))}
      </div>
    </Page>
  )
}
