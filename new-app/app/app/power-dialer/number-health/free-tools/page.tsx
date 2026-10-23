import Link from 'next/link'
import { Page, PageHeader, Panel } from '@/components/app/page-primitives'

const STEPS = [
  {
    name: 'Hiya Business Registration',
    href: 'https://hiya.com/business',
    steps: ['Create a business profile', 'Register your outbound numbers', 'Monitor listing status in Hiya portal'],
  },
  {
    name: 'First Orion / Transaction Verified',
    href: 'https://www.freecallerregistry.com/',
    steps: ['Submit business legal name and numbers', 'Complete carrier verification workflow', 'Allow several weeks for propagation'],
  },
  {
    name: 'Free Caller Registry',
    href: 'https://www.freecallerregistry.com/fcr/',
    steps: ['Register numbers with participating carriers', 'Keep business identity consistent with CNAM/STIR data'],
  },
]

export default function PowerDialerFreeReputationToolsPage() {
  return (
    <Page>
      <PageHeader
        title="Free reputation tools"
        description="External portals — not integrated with Transovo. We cannot see scores or approval status from these sites."
        breadcrumbs={[
          { label: 'Number health', href: '/app/power-dialer/number-health' },
          { label: 'Free tools' },
        ]}
      />
      {STEPS.map((tool) => (
        <Panel key={tool.href} title={tool.name}>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            {tool.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <p className="mt-3 text-sm">
            <a href={tool.href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Open {tool.name}
            </a>
          </p>
        </Panel>
      ))}
      <p className="text-xs text-muted-foreground">
        <Link href="/app/power-dialer/number-health" className="text-primary hover:underline">Back to number health</Link>
      </p>
    </Page>
  )
}
