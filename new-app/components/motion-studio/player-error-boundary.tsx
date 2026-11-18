'use client'
import { Component, type ReactNode } from 'react'

/** Keeps a playback bug inside the player box instead of replacing the whole page. */
export class PlayerErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: unknown) {
    console.error('[motion-studio:player] crashed', error instanceof Error ? error.message : String(error))
  }
  componentDidUpdate(prev: { resetKey?: string }) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false })
  }
  render() {
    if (this.state.failed) return (
      <div role="status" className="grid aspect-video w-full place-items-center rounded-md border border-border bg-muted p-4 text-center text-sm text-muted-foreground" data-testid="ms-player-error">
        Playback could not start. Your project is saved. Reload the page to try again.
      </div>
    )
    return this.props.children
  }
}
