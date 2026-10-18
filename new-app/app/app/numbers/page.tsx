import { Suspense } from 'react'
import { Page, PageHeader } from '@/components/app/page-primitives'
import { NumbersActions, NumbersInventory } from '@/components/numbers/numbers-inventory'

export const metadata = { title: 'Numbers · Transovo' }

export default function NumbersPage() {
  return (
    <Page>
      <PageHeader
        eyebrow="Workspace"
        title="Numbers"
        description="Every line your business uses — numbers you own with us, lines you keep and forward, and ports in progress."
        actions={<NumbersActions />}
      />
      <Suspense>
        <NumbersInventory />
      </Suspense>
    </Page>
  )
}
