import type { UnifiedClipKind } from '../../lib/clips/unified-clip-results'

const BADGE: Record<UnifiedClipKind, { label: string; className: string }> = {
  story: {
    label: 'Story',
    className:
      'border-violet-500/30 bg-violet-500/15 text-violet-100 shadow-[0_0_0_1px_rgba(139,92,246,0.08)]',
  },
  continuous: {
    label: 'Continuous',
    className:
      'border-sky-500/30 bg-sky-500/15 text-sky-100 shadow-[0_0_0_1px_rgba(14,165,233,0.08)]',
  },
}

export function UnifiedClipTypeBadge({
  kind,
  className = '',
}: {
  kind: UnifiedClipKind
  className?: string
}) {
  const badge = BADGE[kind]
  return (
    <span
      data-testid="unified-clip-type-badge"
      data-kind={kind}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide ${badge.className} ${className}`}
    >
      {badge.label}
    </span>
  )
}
