import { Suspense } from 'react'
import { BuyWizard } from '@/components/numbers/buy-wizard'

export const metadata = { title: 'Get a number · Transovo' }

export default function NewNumberPage() {
  return (
    <Suspense>
      <BuyWizard />
    </Suspense>
  )
}
