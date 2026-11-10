import { Skeleton } from '@/components/ui/skeleton'

export function ClipGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 opacity-60 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
          <Skeleton className="aspect-[9/16] w-full rounded-none" />
          <div className="flex flex-1 flex-col gap-2 p-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
            <div className="mt-auto flex gap-2 pt-2">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-24" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
