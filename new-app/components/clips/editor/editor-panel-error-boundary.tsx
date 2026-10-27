'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

type Props = { label: string; children: ReactNode }

export class EditorPanelErrorBoundary extends Component<
  Props,
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const tag = '[clip-editor-panel-error]'
    console.error(tag, {
      panel: this.props.label,
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    })
    if (typeof window !== 'undefined') {
      void fetch('/api/clips/client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          panel: this.props.label,
          message: error.message,
          stack: error.stack,
          componentStack: info.componentStack,
          href: window.location.href,
        }),
      }).catch(() => {})
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">{this.props.label} couldn&apos;t load</p>
          <p className="mt-1 text-muted-foreground">
            Other editor panels still work. Try undoing recent changes or reload the page.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={() => this.setState({ error: null })}
          >
            Retry panel
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
