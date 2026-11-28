import { Suspense } from 'react'
import { GoalsPage } from '@/components/agent-lab/team/team-pages'

export const metadata = { title: 'Goals' }
export const dynamic = 'force-dynamic'

export default function Page() {
  return (
    <Suspense>
      <GoalsPage />
    </Suspense>
  )
}
