import { cn } from '@/lib/utils'

export function Callout({
  title,
  children,
  tone = 'info',
  className,
}: {
  title?: string
  children: React.ReactNode
  tone?: 'info' | 'warning' | 'success'
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3 text-sm',
        tone === 'info' && 'border-info/30 bg-info/10 text-foreground',
        tone === 'warning' && 'border-warning/30 bg-warning/10 text-foreground',
        tone === 'success' && 'border-success/30 bg-success/10 text-foreground',
        className,
      )}
    >
      {title ? <p className="mb-1 font-medium">{title}</p> : null}
      <div className="text-muted-foreground">{children}</div>
    </div>
  )
}
