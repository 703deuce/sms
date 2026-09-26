import type { Metadata } from 'next'
import { Panel } from '@/components/app/kit'
import { ExclusionsTable } from '@/components/mctb/exclusions-table'

export const metadata: Metadata = { title: 'Exclusions' }

export default function ExclusionsPage() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <ExclusionsTable />
      <Panel title="How exclusions work" className="h-fit">
        <ul className="flex list-disc flex-col gap-2 pl-4 text-pretty text-sm text-muted-foreground">
          <li>Excluded numbers never receive recovery texts.</li>
          <li>Anyone who replies STOP is added automatically.</li>
          <li>Use this for vendors, family, and internal lines.</li>
        </ul>
      </Panel>
    </div>
  )
}
