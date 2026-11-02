import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function ProjectKindBadge({
  kind,
  className,
  onMedia = false,
}: {
  kind: 'video' | 'clips'
  className?: string
  onMedia?: boolean
}) {
  if (kind !== 'video') return null
  return (
    <Badge variant={onMedia ? 'onMedia' : 'secondary'} className={cn('font-semibold tracking-wide', className)}>
      AI Video
    </Badge>
  )
}
