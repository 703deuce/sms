import Link from 'next/link'
import { Panel } from '@/components/app/page-primitives'
import { BUSINESS } from '@/lib/data'

function to12(t: string) {
  const [h, m] = t.split(':').map(Number)
  const suffix = h >= 12 ? 'pm' : 'am'
  return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''}${suffix}`
}

export function BusinessHours() {
  return (
    <Panel
      title="Business hours"
      description={`${BUSINESS.timezoneLabel} · shared by every product`}
      actions={<Link href="/app/settings?tab=business" className="text-xs font-medium text-primary hover:underline">Edit</Link>}
    >
      <dl className="grid grid-cols-[3rem_1fr] gap-y-1.5 text-sm">
        {BUSINESS.hours.map((h) => (
          <div key={h.day} className="contents">
            <dt className="text-muted-foreground">{h.day}</dt>
            <dd className="tabular">{h.closed ? <span className="text-muted-foreground">Closed</span> : `${to12(h.open)} – ${to12(h.close)}`}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  )
}
