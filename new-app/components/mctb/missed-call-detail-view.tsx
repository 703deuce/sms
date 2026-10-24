import Link from 'next/link'
import { Page, PageHeader, Panel, KeyValue } from '@/components/app/page-primitives'
import { StatusBadge } from '@/components/app/status'
import { buttonVariants } from '@/components/ui/button'
import { formatPhone, formatWhen } from '@/lib/format'
import type { MctbMissedCallDetail } from '@/lib/server/mctb/missed-call-detail'

export function MctbMissedCallDetailView({ detail }: { detail: MctbMissedCallDetail }) {
  const tone =
    detail.status.toUpperCase() === 'SUPPRESSED'
      ? 'warning'
      : detail.smsSentAt
        ? 'success'
        : 'muted'

  return (
    <Page>
      <PageHeader
        breadcrumbs={[
          { label: 'Missed Call Text Back · Missed Calls', href: '/app/mctb/calls' },
          { label: formatPhone(detail.callerE164) },
        ]}
        title={formatPhone(detail.callerE164)}
        eyebrow={<StatusBadge tone={tone}>{detail.status.replace(/_/g, ' ')}</StatusBadge>}
        description={`Missed ${formatWhen(detail.detectedAt)} on ${formatPhone(detail.businessE164)}`}
        actions={
          detail.conversationId ? (
            <Link href={`/app/mctb/conversations?thread=${detail.conversationId}`} className={buttonVariants()}>
              Open conversation
            </Link>
          ) : null
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Recovery">
          <KeyValue label="Eligible" value={detail.eligible ? 'Yes' : 'No'} />
          <KeyValue label="Text sent" value={detail.smsSentAt ? formatWhen(detail.smsSentAt) : 'Not sent'} />
          <KeyValue label="Suppression" value={detail.suppressionReason ?? '—'} />
          <KeyValue label="Trigger" value={detail.reason} />
          {detail.disposition && <KeyValue label="Disposition" value={detail.disposition} />}
        </Panel>
        <Panel title="Identifiers">
          <KeyValue label="Event id" value={detail.id} mono />
          {detail.phoneNumberId && <KeyValue label="Business line id" value={detail.phoneNumberId} mono />}
        </Panel>
      </div>
    </Page>
  )
}
