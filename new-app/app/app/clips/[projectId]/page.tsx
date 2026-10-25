import { Page, PageHeader, Panel } from '@/components/app/page-primitives'

export const metadata = { title: 'Project · Clips' }

export default async function ClipProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  return (
    <Page>
      <PageHeader title="Project" description={`ID ${projectId}`} />
      <Panel title="Processing">
        <p className="text-sm text-muted-foreground">Status UI ships in milestone M3.</p>
      </Panel>
    </Page>
  )
}
