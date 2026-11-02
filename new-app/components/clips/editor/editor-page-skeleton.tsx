import { Skeleton } from '@/components/ui/skeleton'

/** Matches EditorShell chrome (top bar + left rail + main column) for loading / Suspense. */
export function EditorPageSkeleton() {
  return (
    <div
      className="flex h-[calc(100dvh-3.5rem)] max-w-[100vw] flex-col overflow-x-hidden bg-background"
      aria-busy
      aria-label="Loading clip editor"
    >
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3">
        <Skeleton className="size-9 shrink-0 rounded-md" />
        <Skeleton className="h-9 max-w-md flex-1" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-14 shrink-0 flex-col gap-2 border-r border-border p-2 md:flex">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="mx-auto size-9 rounded-md" />
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3 p-3">
          <Skeleton className="aspect-video w-full max-w-3xl rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}
