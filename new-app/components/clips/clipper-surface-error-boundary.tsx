'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

type Props = {
  surface: string
  children: ReactNode
}

export class ClipperSurfaceErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[clipper:ui-error]', {
      surface: this.props.surface,
      message: error.message,
      componentStack: info.componentStack,
    })
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm">
          <p className="font-medium text-destructive">Something went wrong</p>
          <p className="mt-1 text-muted-foreground">
            {this.props.surface} hit an unexpected error. Your project is still saved on the server when possible.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => this.setState({ error: null })}>
              Try again
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => window.location.reload()}>
              Reload page
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
