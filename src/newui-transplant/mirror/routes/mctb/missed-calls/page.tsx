import { Page, PageHeader, Stat } from '@/newui-transplant/components/app/kit'
import { ButtonLink } from '@/newui-transplant/components/app/button-link'
import { MissedCallsBrowser } from '@/newui-transplant/components/mctb/missed-calls-browser'
import type { MissedCall } from '@/newui-transplant/lib/view-models'

export type MctbMissedCallsWired = {
  stats?: { missed: string; recoveryTexts: string; replies: string; needsReply: string }
  missedCalls: MissedCall[]
}


export function TransplantMctbMissedCallsPage({ wired }: { wired?: MctbMissedCallsWired }) {
  const stats = wired?.stats ?? { missed: '87', recoveryTexts: '81', replies: '52', needsReply: '4' }
  const missedCalls = wired?.missedCalls ?? []
  return (
    <Page>
      <PageHeader
        title="Missed Calls"
        description="Every call your team couldn't answer, and what happened next."
        actions={<ButtonLink href="/mctb/setup" variant="outline">Manage setup</ButtonLink>}
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Missed calls" value={stats.missed} delta={-6} />
        <Stat label="Recovery texts" value={stats.recoveryTexts} delta={9} />
        <Stat label="Replies" value={stats.replies} delta={14} />
        <Stat label="Needs reply" value={stats.needsReply} href="/mctb/conversations?filter=needs_reply" />
      </div>
      <MissedCallsBrowser missedCalls={missedCalls} />
    </Page>
  )
}
