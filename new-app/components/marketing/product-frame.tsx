import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function ProductFrame({
  title,
  children,
  className,
  label,
}: {
  title?: string
  label?: string
  children: ReactNode
  className?: string
}) {
  return (
    <figure
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border bg-panel shadow-lg shadow-glow',
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-border bg-card/80 px-3 py-2">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2 rounded-full bg-white/15" />
          <span className="size-2 rounded-full bg-white/15" />
          <span className="size-2 rounded-full bg-white/15" />
        </span>
        <figcaption className="flex-1 truncate text-center font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">
          {label ?? title ?? 'Transovo Clips'}
        </figcaption>
        <span className="w-10" aria-hidden />
      </div>
      <div className="relative">{children}</div>
    </figure>
  )
}
