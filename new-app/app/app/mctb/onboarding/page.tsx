import Link from 'next/link'
import { Page, PageHeader, Panel } from '@/components/app/page-primitives'
import { buttonVariants } from '@/components/ui/button'

export const metadata = { title: 'MCTB setup guide' }

const steps = [
  { title: 'Assign a business line', href: '/app/numbers', body: 'Enable MCTB on the number callers dial and set inbound product mode.' },
  { title: 'Call forwarding', href: '/app/phone/forwarding', body: 'Verify conditional forwarding to Transovo ingress.' },
  { title: 'Consent & template', href: '/app/mctb/setup', body: 'Press-1 or existing permission, plus first recovery message template.' },
  { title: 'Recovery rules', href: '/app/mctb/recovery', body: 'Triggers, cooldown, and pause.' },
  { title: 'Test', href: '/app/mctb/calls', body: 'Missed call from another phone → consent → SMS in Conversations.' },
]

export default function MctbOnboardingPage() {
  return (
    <Page>
      <PageHeader title="Finish Missed Call Text Back setup" description="Same runtime as legacy MCTB — configure here, operate under MCTB in the product switcher." />
      <ol className="flex flex-col gap-4">
        {steps.map((s, i) => (
          <li key={s.href}>
            <Panel title={`${i + 1}. ${s.title}`}>
              <p className="text-sm text-muted-foreground">{s.body}</p>
              <Link href={s.href} className={buttonVariants({ variant: 'outline', className: 'mt-3' })}>
                Open
              </Link>
            </Panel>
          </li>
        ))}
      </ol>
    </Page>
  )
}
