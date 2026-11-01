import { Badge } from '@/components/ui/badge'

export function FreeToolBadge({ className }: { className?: string }) {
  return (
    <Badge variant="secondary" className={`text-[10px] font-normal ${className ?? ''}`}>
      Free
    </Badge>
  )
}
