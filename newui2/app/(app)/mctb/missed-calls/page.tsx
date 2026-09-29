import type { Metadata } from 'next'
import Link from 'next/link'
import { MessageSquareReply, MessagesSquare, PhoneMissed, Send, Wrench } from 'lucide-react'
import { PageHeader, StatCard } from '@/components/app/primitives'
import { MissedCallsView } from '@/components/mctb/missed-calls-view'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Missed Calls' }

export default function MissedCallsPage() {
  return (
    <>
      <PageHeader
        title="Missed Calls"
        description="Every call you couldn’t answer, and what happened after the text back."
        actions={
          <Link href="/mctb/setup" className={cn(buttonVariants({ variant: 'outline' }), 'h-9')}>
            <Wrench aria-hidden="true" /> Manage setup
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Missed calls" value="24" sub="Last 7 days" icon={PhoneMissed} />
        <StatCard label="Recovery texts" value="21" sub="3 suppressed or failed" icon={Send} />
        <StatCard label="Replies" value="11" sub="52% reply rate" icon={MessageSquareReply} />
        <StatCard label="Needs reply" value="3" sub="Open in inbox" icon={MessagesSquare} href="/mctb/conversations?filter=needs_reply" />
      </div>
      <MissedCallsView />
    </>
  )
}
