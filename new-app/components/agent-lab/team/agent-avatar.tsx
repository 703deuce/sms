import { cn } from '@/lib/utils'

/** Emoji avatar in a soft tile; falls back to the agent's initials. */
const TILE = ['bg-sky-500/15', 'bg-violet-500/15', 'bg-amber-500/15', 'bg-emerald-500/15', 'bg-rose-500/15', 'bg-indigo-500/15', 'bg-teal-500/15', 'bg-orange-500/15']

/** A stable soft tile colour per agent (the record's named colour when set, else one picked from its name). */
const NAMED: Record<string, string> = { sky: TILE[0], blue: TILE[0], violet: TILE[1], purple: TILE[1], amber: TILE[2], yellow: TILE[2], emerald: TILE[3], green: TILE[3], rose: TILE[4], red: TILE[4], pink: TILE[4], indigo: TILE[5], teal: TILE[6], orange: TILE[7] }

function tileClass(name: string, color?: string | null) {
  if (color && NAMED[color.toLowerCase()]) return NAMED[color.toLowerCase()]
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return TILE[h % TILE.length]
}

export function AgentAvatar({ avatar, name, size = 'md', running, className, color }: { avatar?: string | null; name: string; size?: 'sm' | 'md' | 'lg'; running?: boolean; className?: string; color?: string | null }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || 'A'
  const dims = size === 'sm' ? 'size-6 text-sm' : size === 'lg' ? 'size-12 text-2xl' : 'size-8 text-base'
  return (
    <span className={cn('relative inline-grid shrink-0 place-items-center rounded-full font-semibold text-foreground', tileClass(name, color), dims, className)} aria-hidden>
      {avatar ? <span className="leading-none">{avatar}</span> : <span className="text-[0.7em]">{initials}</span>}
      {running ? <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-success ring-2 ring-background" /> : null}
    </span>
  )
}
