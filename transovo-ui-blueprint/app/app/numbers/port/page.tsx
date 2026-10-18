import { Suspense } from 'react'
import { PortWizard } from '@/components/numbers/port-wizard'

export const metadata = { title: 'Port a number · Transovo' }

export default function PortNumberPage() {
  return (
    <Suspense>
      <PortWizard />
    </Suspense>
  )
}
