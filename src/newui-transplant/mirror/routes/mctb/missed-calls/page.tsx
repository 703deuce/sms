import { Page, PageHeader, Stat } from '@/newui-transplant/components/app/kit'
import { ButtonLink } from '@/newui-transplant/components/app/button-link'
import { MissedCallsBrowser } from '@/newui-transplant/components/mctb/missed-calls-browser'
import type { MissedCall } from '@/newui-transplant/lib/view-models'

export type MctbMissedCallsListWiring = {
  query: string
  recovery: string
  date: string
  trigger: string
  sort: string
  page: number
  pageCount: number
  total: number
  loading?: boolean
  onQueryChange: (q: string) => void
  onRecoveryChange: (v: string) => void
  onDateChange: (v: string) => void
  onTriggerChange: (v: string) => void
  onSortChange: (v: string) => void
  onPageChange: (page: number) => void
  onAddExclusion?: (phoneE164: string, label?: string) => Promise<void>
  onMarkHandled?: (conversationId: string, eventId: string) => Promise<void>
}

export type MctbMissedCallsWired = {
  stats?: { missed: string; recoveryTexts: string; replies: string; needsReply: string }
  missedCalls: MissedCall[]
  listWiring?: MctbMissedCallsListWiring
}


export function TransplantMctbMissedCallsPage({ wired }: { wired?: MctbMissedCallsWired }) {
  const live = wired !== undefined
  const stats =
    wired?.stats ??
    (live ? { missed: '0', recoveryTexts: '0', replies: '0', needsReply: '0' } : { missed: '87', recoveryTexts: '81', replies: '52', needsReply: '4' })
  const missedCalls = wired?.missedCalls ?? []
  const useLiveStats = live
  return (
    <Page>
      <PageHeader
        title="Missed Calls"
        description="Every call your team couldn't answer, and what happened next."
        actions={<ButtonLink href="/mctb/setup" variant="outline">Manage setup</ButtonLink>}
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Missed calls" value={stats.missed} delta={useLiveStats ? undefined : -6} />
        <Stat label="Recovery texts" value={stats.recoveryTexts} delta={useLiveStats ? undefined : 9} />
        <Stat label="Replies" value={stats.replies} delta={useLiveStats ? undefined : 14} />
        <Stat label="Needs reply" value={stats.needsReply} href="/mctb/conversations?filter=needs_reply" />
      </div>
      <MissedCallsBrowser missedCalls={missedCalls} wiring={wired?.listWiring} />
    </Page>
  )
}
