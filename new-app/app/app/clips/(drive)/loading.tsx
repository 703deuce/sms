import { Skeleton } from '@/components/ui/skeleton'

export default function ClipsDriveLoading() {
  return (
    <div className="p-4 md:p-6">
      <Skeleton className="mb-4 h-8 w-48" />
      <div className="flex flex-wrap gap-2 pb-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-48" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-xl border border-border p-4">
            <Skeleton className="size-10 rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  )
}
