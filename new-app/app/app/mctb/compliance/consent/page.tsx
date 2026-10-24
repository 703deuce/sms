import { Page, PageHeader } from '@/components/app/page-primitives'

export const metadata = { title: 'Consent log · Missed Call Text Back' }

export default function MctbConsentLogPage() {
  return (
    <Page>
      <PageHeader
        title="Consent log"
        description="Audit trail for press-1 and existing-consent capture events (workspace-scoped)."
      />
      <p className="text-sm text-muted-foreground">
        Consent events are recorded in the MCTB runtime when callers press 1 or when you attest existing permission.
        Export and detailed filtering remain available via the legacy compliance API; this route is wired for navigation
        parity while the full New UI consent table is ported.
      </p>
    </Page>
  )
}
