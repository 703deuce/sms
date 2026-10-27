import { cn } from '@/lib/utils'

export function ProjectKindBadge({
  kind,
  className,
}: {
  kind: 'video' | 'clips'
  className?: string
}) {
  if (kind !== 'video') return null
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300',
        className,
      )}
    >
      Video
    </span>
  )
}
