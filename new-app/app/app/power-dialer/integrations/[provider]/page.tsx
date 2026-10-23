'use client'

import { Component, type ReactNode } from 'react'
import { useParams } from 'next/navigation'
import { Page, PageHeader } from '@/components/app/page-primitives'
import { Button } from '@/components/ui/button'
import { IntegrationDetailContent } from '@/components/power-dialer/integration-detail-content'
import { ZapierIntegrationDetail } from '@/components/power-dialer/zapier-integration-detail'

class IntegrationDetailErrorBoundary extends Component<
  { children: ReactNode; provider: string },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <Page>
          <PageHeader title={this.props.provider} description="CRM integration" />
          <p className="text-sm text-destructive" role="alert">
            This page could not load. {this.state.error.message}
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </Button>
        </Page>
      )
    }
    return this.props.children
  }
}

export default function IntegrationDetailPage() {
  const params = useParams()
  const provider = String(params.provider || '')

  if (provider.toLowerCase() === 'zapier') {
    return <ZapierIntegrationDetail />
  }

  return (
    <IntegrationDetailErrorBoundary provider={provider}>
      <IntegrationDetailContent provider={provider} />
    </IntegrationDetailErrorBoundary>
  )
}
