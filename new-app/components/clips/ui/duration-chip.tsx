import { formatDur } from '@/lib/clips/format'

export function DurationChip({ ms, className }: { ms: number; className?: string }) {
  return (
    <span
      className={
        className ??
        'absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[11px] font-medium tabular-nums text-white backdrop-blur-sm'
      }
    >
      {formatDur(ms)}
    </span>
  )
}
