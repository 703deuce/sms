import { Scissors } from 'lucide-react'
import { cn } from '@/lib/utils'

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'grid place-items-center rounded-lg bg-brand-gradient ring-1 ring-inset ring-white/20',
        className,
      )}
    >
      <Scissors className="size-4 text-white" aria-hidden />
    </span>
  )
}
