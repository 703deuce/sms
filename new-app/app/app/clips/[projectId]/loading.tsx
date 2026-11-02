import { Skeleton } from '@/components/ui/skeleton'
import { ClipGridSkeleton } from '@/components/clips/clip-grid-skeleton'

export default function ClipProjectLoading() {
  return (
    <div className="space-y-6 p-4 md:p-6" aria-busy aria-label="Loading project">
      <div className="space-y-2">
        <Skeleton className="h-8 w-2/3 max-w-md" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-24" />
      </div>
      <ClipGridSkeleton count={8} />
    </div>
  )
}
