import { Suspense } from 'react'
import { ConnectWizard } from '@/components/numbers/connect-wizard'

export const metadata = { title: 'Connect a number · Transovo' }

export default function ConnectNumberPage() {
  return (
    <Suspense>
      <ConnectWizard />
    </Suspense>
  )
}
