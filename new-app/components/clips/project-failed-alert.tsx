import Link from 'next/link'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ProjectFailedAlert({
  errorMessage,
  retryAction,
}: {
  errorMessage: string
  retryAction?: React.ReactNode
}) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/8 p-4 sm:flex-row sm:items-start">
      <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-destructive/15 text-destructive">
        <AlertTriangle className="size-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Processing failed</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{errorMessage}</p>
      </div>
      {retryAction ?? (
        <Button variant="outline" size="sm" className="shrink-0" render={<Link href="/app/clips/new" />}>
          <RotateCcw className="size-3.5" aria-hidden />
          Start over
        </Button>
      )}
    </div>
  )
}
