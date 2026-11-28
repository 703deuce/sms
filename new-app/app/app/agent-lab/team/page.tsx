import { Suspense } from 'react'
import { TeamPage } from '@/components/agent-lab/team/team-pages'

export const metadata = { title: 'Team' }
export const dynamic = 'force-dynamic'

export default function Page() {
  return (
    <Suspense>
      <TeamPage />
    </Suspense>
  )
}
