import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function OptionCard({
  selected,
  icon: Icon,
  title,
  hint,
  children,
  className,
  ...rest
}: React.ComponentProps<'label'> & { selected?: boolean; icon?: LucideIcon; title: string; hint?: string }) {
  return (
    <label
      data-selected={selected ? '' : undefined}
      className={cn(
        'flex h-full min-h-[76px] cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-foreground/20',
        'data-[selected]:border-primary data-[selected]:bg-primary/10 data-[selected]:ring-1 data-[selected]:ring-primary/40',
        className,
      )}
      {...rest}
    >
      {Icon ? (
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-secondary">
          <Icon className="size-5 text-foreground" />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        {hint ? <span className="mt-0.5 block text-[13px] text-muted-foreground">{hint}</span> : null}
      </span>
      {children}
    </label>
  )
}
