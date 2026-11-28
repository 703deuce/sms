import { cn } from '@/lib/utils'

/** Emoji avatar in a soft tile; falls back to the agent's initials. */
export function AgentAvatar({ avatar, name, size = 'md', running, className }: { avatar?: string | null; name: string; size?: 'sm' | 'md' | 'lg'; running?: boolean; className?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || 'A'
  const dims = size === 'sm' ? 'size-6 text-sm' : size === 'lg' ? 'size-12 text-2xl' : 'size-8 text-base'
  return (
    <span className={cn('relative inline-grid shrink-0 place-items-center rounded-lg bg-primary/10 font-semibold text-primary', dims, className)} aria-hidden>
      {avatar ? <span className="leading-none">{avatar}</span> : <span className="text-[0.7em]">{initials}</span>}
      {running ? <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-success ring-2 ring-background" /> : null}
    </span>
  )
}
